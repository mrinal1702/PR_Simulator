import type { NewGamePayload } from "@/components/NewGameWizard";
import {
  canAffordSolution,
  computeSatisfactionFromWeights,
  getSatisfactionReachWeight,
  type SeasonClient,
  type SeasonClientRun,
  type SolutionId,
  type SolutionOption,
} from "@/lib/seasonClientLoop";
import type { BuildId } from "@/lib/gameEconomy";
import { computeCarryoverVarianceDeltasSeason2 } from "@/lib/solutionOutcomeMath";

export type CarryoverEntry = {
  client: SeasonClient;
  run: SeasonClientRun & { outcome: NonNullable<SeasonClientRun["outcome"]> };
};

export function getSeasonCarryoverEntries(save: NewGamePayload, season: number): CarryoverEntry[] {
  if (season <= 1) return [];
  const previousSeasonKey = String(season - 1);
  const previousLoop = save.seasonLoopBySeason?.[previousSeasonKey];
  if (!previousLoop) return [];

  const runByClient = new Map(previousLoop.runs.map((r) => [r.clientId, r]));
  const out: CarryoverEntry[] = [];
  for (const client of previousLoop.clientsQueue) {
    const run = runByClient.get(client.id);
    if (!run?.accepted || run.solutionId === "reject" || !run.outcome) continue;
    out.push({
      client,
      run: {
        ...run,
        outcome: run.outcome,
      },
    });
  }
  return out;
}

export function getSeasonCarryoverProgress(save: NewGamePayload, season: number): number {
  const key = String(season);
  const raw = save.rolloverReviewProgressBySeason?.[key] ?? 0;
  return Math.max(0, Math.floor(raw));
}

export function isSeasonCarryoverComplete(save: NewGamePayload, season: number): boolean {
  const entries = getSeasonCarryoverEntries(save, season);
  if (entries.length === 0) return true;
  return getSeasonCarryoverProgress(save, season) >= entries.length;
}

export function advanceSeasonCarryoverProgress(save: NewGamePayload, season: number): NewGamePayload {
  const key = String(season);
  const entries = getSeasonCarryoverEntries(save, season);
  const current = getSeasonCarryoverProgress(save, season);
  const next = Math.min(entries.length, current + 1);
  return {
    ...save,
    rolloverReviewProgressBySeason: {
      ...(save.rolloverReviewProgressBySeason ?? {}),
      [key]: next,
    },
  };
}

/** Base change (percentage points) from carry-over archetype, before Season 2 variance. */
export const CARRYOVER_BASE_DELTA_BY_SOLUTION_ID = {
  solution_1: { reach: 1, effectiveness: 1 },
  solution_2: { reach: 2, effectiveness: 6 },
  solution_3: { reach: 6, effectiveness: 2 },
  solution_4: { reach: 8, effectiveness: 8 },
} as const;

const CARRYOVER_DO_NOTHING_DECAY_PCT = 5;

/**
 * New reach/effectiveness after carry-over choice: EM (after build shift) + (base + variance),
 * or −5 / −5 on each for do nothing. Variance uses Season 2 c/v scoring and ±10 max per metric.
 */
export function computeCarryoverOutcomeAfterChoice(args: {
  existingAfterBuildShift: { reach: number; effectiveness: number };
  solutionId: SolutionId;
  visibility: number;
  competence: number;
  discipline: number;
  seed: string;
  satisfactionReachWeight: number;
}): { messageSpread: number; messageEffectiveness: number; satisfaction: number } {
  if (args.solutionId === "reject" || args.solutionId === "pending") {
    const messageSpread = clampPercent(args.existingAfterBuildShift.reach - CARRYOVER_DO_NOTHING_DECAY_PCT);
    const messageEffectiveness = clampPercent(
      args.existingAfterBuildShift.effectiveness - CARRYOVER_DO_NOTHING_DECAY_PCT
    );
    return {
      messageSpread,
      messageEffectiveness,
      satisfaction: computeSatisfactionFromWeights(
        messageSpread,
        messageEffectiveness,
        args.satisfactionReachWeight
      ),
    };
  }

  const base = CARRYOVER_BASE_DELTA_BY_SOLUTION_ID[args.solutionId as keyof typeof CARRYOVER_BASE_DELTA_BY_SOLUTION_ID];
  if (!base) {
    const messageSpread = clampPercent(args.existingAfterBuildShift.reach);
    const messageEffectiveness = clampPercent(args.existingAfterBuildShift.effectiveness);
    return {
      messageSpread,
      messageEffectiveness,
      satisfaction: computeSatisfactionFromWeights(
        messageSpread,
        messageEffectiveness,
        args.satisfactionReachWeight
      ),
    };
  }

  const { reachVarianceDelta, effectivenessVarianceDelta } = computeCarryoverVarianceDeltasSeason2({
    visibility: args.visibility,
    competence: args.competence,
    discipline: args.discipline,
    seed: args.seed,
  });

  const changeReach = base.reach + reachVarianceDelta;
  const changeEffectiveness = base.effectiveness + effectivenessVarianceDelta;

  const messageSpread = clampPercent(args.existingAfterBuildShift.reach + changeReach);
  const messageEffectiveness = clampPercent(args.existingAfterBuildShift.effectiveness + changeEffectiveness);

  return {
    messageSpread,
    messageEffectiveness,
    satisfaction: computeSatisfactionFromWeights(
      messageSpread,
      messageEffectiveness,
      args.satisfactionReachWeight
    ),
  };
}

/**
 * Apply carry-over choice: spend EUR/capacity (except do nothing), write resolution on Season 1 run, advance rollover progress.
 */
export function applySeason2CarryoverChoice(
  save: NewGamePayload,
  currentSeason: number,
  clientId: string,
  solution: SolutionOption,
  seed: string
): NewGamePayload | null {
  if (currentSeason < 2) return null;
  const previousSeasonKey = String(currentSeason - 1);
  const loop = save.seasonLoopBySeason?.[previousSeasonKey];
  if (!loop) return null;
  const client = loop.clientsQueue.find((c) => c.id === clientId);
  const run = loop.runs.find((r) => r.clientId === clientId);
  if (!client || !run?.outcome) return null;

  const afterShift = applyBuildOutcomeShift(
    save.buildId,
    run.outcome.messageSpread,
    run.outcome.messageEffectiveness
  );
  const satisfactionReachWeight = getSatisfactionReachWeight(client);

  const resolved = computeCarryoverOutcomeAfterChoice({
    existingAfterBuildShift: afterShift,
    solutionId: solution.id,
    visibility: save.resources.visibility,
    competence: save.resources.competence,
    discipline: client.hiddenDiscipline,
    seed,
    satisfactionReachWeight,
  });

  // Season N carryover spends agency cash only. The client's `budgetSeason1` was already credited
  // during that season's campaign; `budgetSeason2` was credited at Start season N+1 settlement.
  if (!solution.isRejectOption) {
    if (!canAffordSolution(solution, save.resources.eur, save.resources.firmCapacity)) return null;
  }

  const eurCost = solution.isRejectOption ? 0 : solution.costBudget;
  const capCost = solution.isRejectOption ? 0 : solution.costCapacity;
  const eurAfter = save.resources.eur - eurCost;

  const newRuns: SeasonClientRun[] = loop.runs.map((r) =>
    r.clientId === clientId
      ? {
          ...r,
          season2CarryoverResolution: {
            messageSpread: resolved.messageSpread,
            messageEffectiveness: resolved.messageEffectiveness,
            satisfaction: resolved.satisfaction,
            solutionId: solution.id,
            costBudget: eurCost,
            costCapacity: capCost,
          },
        }
      : r
  );

  let nextSave: NewGamePayload = {
    ...save,
    resources: {
      ...save.resources,
      eur: Math.max(0, eurAfter),
      firmCapacity: Math.max(0, save.resources.firmCapacity - capCost),
    },
    seasonLoopBySeason: {
      ...save.seasonLoopBySeason,
      [previousSeasonKey]: {
        ...loop,
        runs: newRuns,
      },
    },
  };

  nextSave = advanceSeasonCarryoverProgress(nextSave, currentSeason);
  return nextSave;
}

export function applyBuildOutcomeShift(
  buildId: BuildId,
  reach: number,
  effectiveness: number
): { reach: number; effectiveness: number } {
  let reachDelta = 0;
  let effectivenessDelta = 0;
  if (buildId === "summa_cum_basement") {
    reachDelta = -5;
    effectivenessDelta = 5;
  } else if (buildId === "velvet_rolodex") {
    reachDelta = 5;
    effectivenessDelta = -5;
  }
  return {
    reach: clampPercent(reach + reachDelta),
    effectiveness: clampPercent(effectiveness + effectivenessDelta),
  };
}

export function highLowLabelsFromThreshold(
  reach: number,
  effectiveness: number
): { reach: "high" | "low"; effectiveness: "high" | "low" } {
  return {
    reach: reach >= 50 ? "high" : "low",
    effectiveness: effectiveness >= 50 ? "high" : "low",
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
