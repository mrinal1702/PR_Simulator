import type { NewGamePayload } from "@/components/NewGameWizard";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { clampToScale, METRIC_SCALES } from "@/lib/metricScales";
import {
  reputationDeltaFromEffectivenessCurve,
  visibilityGainFromSatisfactionCurve,
} from "@/lib/postSeasonResults";
import {
  canAffordSolution,
  computeSatisfactionFromWeights,
  getSatisfactionReachWeight,
  type SeasonClient,
  type SeasonClientRun,
  type Season2CarryoverResolution,
  type SolutionId,
  type SolutionOption,
} from "@/lib/seasonClientLoop";
import type { BuildId } from "@/lib/gameEconomy";
import { computeCarryoverVarianceDeltasSeason2, computeCarryoverVarianceDeltasSeason3 } from "@/lib/solutionOutcomeMath";

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
  /** Season 2 benchmark (default) vs Season 3 when resolving rollovers in the Season 3+ hub. */
  carryoverVarianceSeason?: 2 | 3;
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

  const varianceInput = {
    visibility: args.visibility,
    competence: args.competence,
    discipline: args.discipline,
    seed: args.seed,
  };
  const { reachVarianceDelta, effectivenessVarianceDelta } =
    (args.carryoverVarianceSeason ?? 2) === 3
      ? computeCarryoverVarianceDeltasSeason3(varianceInput)
      : computeCarryoverVarianceDeltasSeason2(varianceInput);

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

export function carryoverSoftStatGainsFromResolution(
  resolution: Season2CarryoverResolution
): { reputationDelta: number; visibilityGain: number } {
  return {
    reputationDelta:
      resolution.reputationDelta ?? reputationDeltaFromEffectivenessCurve(resolution.messageEffectiveness),
    visibilityGain:
      resolution.visibilityGain ?? visibilityGainFromSatisfactionCurve(resolution.satisfaction),
  };
}

export function computeSeasonCloseCarryoverStatGains(
  save: NewGamePayload,
  season: number
): { reputation: number; visibility: number } {
  if (season <= 1) return { reputation: 0, visibility: 0 };
  let reputation = 0;
  let visibility = 0;
  for (const entry of getPostSeasonResolutionEntries(save, season)) {
    const gains = carryoverSoftStatGainsFromResolution(entry.run.season2CarryoverResolution!);
    reputation += gains.reputationDelta;
    visibility += gains.visibilityGain;
  }
  return { reputation, visibility };
}

export function applySeasonCloseCarryoverStatGains(save: NewGamePayload, season: number): NewGamePayload {
  if (season <= 1) return save;
  const seasonKey = String(season);
  if (save.seasonCloseCarryoverStatsAppliedBySeason?.[seasonKey] === true) return save;

  const gains = computeSeasonCloseCarryoverStatGains(save, season);
  const previousSeasonKey = String(season - 1);
  const previousLoop = save.seasonLoopBySeason?.[previousSeasonKey];
  const normalizedRuns = previousLoop?.runs.map((run) => {
    if (!run.season2CarryoverResolution) return run;
    const normalized = carryoverSoftStatGainsFromResolution(run.season2CarryoverResolution);
    if (
      run.season2CarryoverResolution.reputationDelta === normalized.reputationDelta &&
      run.season2CarryoverResolution.visibilityGain === normalized.visibilityGain
    ) {
      return run;
    }
    return {
      ...run,
      season2CarryoverResolution: {
        ...run.season2CarryoverResolution,
        ...normalized,
      },
    };
  });

  return {
    ...save,
    reputation: clampToScale((save.reputation ?? 5) + gains.reputation, METRIC_SCALES.reputation),
    resources: {
      ...save.resources,
      visibility: clampToScale(save.resources.visibility + gains.visibility, METRIC_SCALES.visibility),
    },
    seasonCloseCarryoverStatsAppliedBySeason: {
      ...(save.seasonCloseCarryoverStatsAppliedBySeason ?? {}),
      [seasonKey]: true,
    },
    seasonLoopBySeason: previousLoop && normalizedRuns
      ? {
          ...(save.seasonLoopBySeason ?? {}),
          [previousSeasonKey]: {
            ...previousLoop,
            runs: normalizedRuns,
          },
        }
      : save.seasonLoopBySeason,
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
    visibility: getEffectiveVisibilityForAgency(save),
    competence: getEffectiveCompetenceForAgency(save),
    discipline: client.hiddenDiscipline,
    seed,
    satisfactionReachWeight,
    carryoverVarianceSeason: currentSeason >= 3 ? 3 : 2,
  });
  const seasonCloseGains = carryoverSoftStatGainsFromResolution({
    ...resolved,
    solutionId: solution.id,
    costBudget: solution.isRejectOption ? 0 : solution.costBudget,
    costCapacity: solution.isRejectOption ? 0 : solution.costCapacity,
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
            reputationDelta: seasonCloseGains.reputationDelta,
            visibilityGain: seasonCloseGains.visibilityGain,
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

// ─── Season 2+ post-season resolution tracking ───────────────────────────────

/** S1 runs that have a completed Season 2 carryover resolution (to show in Season 2 post-season). */
export function getPostSeasonResolutionEntries(save: NewGamePayload, forSeason: number): CarryoverEntry[] {
  if (forSeason <= 1) return [];
  const prevKey = String(forSeason - 1);
  const prevLoop = save.seasonLoopBySeason?.[prevKey];
  if (!prevLoop) return [];
  const out: CarryoverEntry[] = [];
  for (const client of prevLoop.clientsQueue) {
    const run = prevLoop.runs.find((r) => r.clientId === client.id);
    if (!run?.accepted || run.solutionId === "reject" || !run.outcome || !run.season2CarryoverResolution) continue;
    out.push({ client, run: { ...run, outcome: run.outcome } });
  }
  return out;
}

export function getPostSeasonResolutionProgress(save: NewGamePayload, season: number): number {
  return Math.max(0, Math.floor(save.postSeasonResolutionProgressBySeason?.[String(season)] ?? 0));
}

export function isPostSeasonResolutionComplete(save: NewGamePayload, season: number): boolean {
  const entries = getPostSeasonResolutionEntries(save, season);
  if (entries.length === 0) return true;
  return getPostSeasonResolutionProgress(save, season) >= entries.length;
}

export function advancePostSeasonResolutionProgress(save: NewGamePayload, season: number): NewGamePayload {
  const key = String(season);
  const entries = getPostSeasonResolutionEntries(save, season);
  const current = getPostSeasonResolutionProgress(save, season);
  const next = Math.min(entries.length, current + 1);
  return {
    ...save,
    postSeasonResolutionProgressBySeason: {
      ...(save.postSeasonResolutionProgressBySeason ?? {}),
      [key]: next,
    },
  };
}
