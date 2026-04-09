import type { NewGamePayload } from "@/components/NewGameWizard";
import { canAfford } from "@/lib/budgetGuard";
import { clampToScale, METRIC_SCALES } from "@/lib/metricScales";
import {
  computeSatisfactionFromWeights,
  getSatisfactionReachWeight,
  type SeasonClient,
  type SeasonClientRun,
  type SeasonLoopState,
} from "@/lib/seasonClientLoop";
import { competenceScoreForVariance } from "@/lib/solutionOutcomeMath";

export const POST_SEASON_REACH_BOOST_COST_EUR = 5000;
export const POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY = 5;

/**
 * Maps firm competence (same normalization as Season 1 solution variance) to an integer boost 1–5%.
 */
export function postSeasonBoostPointsFromCompetence(competence: number): number {
  const s = competenceScoreForVariance(competence);
  return Math.max(1, Math.min(5, Math.round(1 + (s / 100) * 4)));
}

/** Ledger rows for breakdown modals — one entry per completed post-season resolution. */
export type PostSeasonLedgerEntry = {
  seasonKey: string;
  scenarioTitle: string;
  reputationDelta: number;
  visibilityGain: number;
  eurSpentOnReachBoost: number;
  capacitySpentOnEffectivenessBoost: number;
};

export function collectPostSeasonLedger(save: { seasonLoopBySeason?: Partial<Record<string, SeasonLoopState>> }): PostSeasonLedgerEntry[] {
  const out: PostSeasonLedgerEntry[] = [];
  for (const [seasonKey, loop] of Object.entries(save.seasonLoopBySeason ?? {})) {
    if (!loop?.runs) continue;
    for (const r of loop.runs) {
      if (!r.postSeason) continue;
      const client = loop.clientsQueue.find((c) => c.id === r.clientId);
      const ps = r.postSeason;
      out.push({
        seasonKey,
        scenarioTitle: client?.scenarioTitle ?? r.clientId,
        reputationDelta: ps.reputationDelta ?? 0,
        visibilityGain: ps.visibilityGain ?? 0,
        eurSpentOnReachBoost: ps.choice === "reach" ? POST_SEASON_REACH_BOOST_COST_EUR : 0,
        capacitySpentOnEffectivenessBoost: ps.choice === "effectiveness" ? POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY : 0,
      });
    }
  }
  return out;
}

/** Queue order; later: may reorder so rollover scenarios from prior seasons appear first. */
export function acceptedRunsWithOutcomes(loop: SeasonLoopState): SeasonClientRun[] {
  return loop.runs.filter((r) => r.accepted && r.solutionId !== "reject" && r.outcome != null);
}

/** Index of the next scenario to resolve in post-season order, or `accepted.length` if all done. */
export function postSeasonNextRunIndex(accepted: SeasonClientRun[]): number {
  const idx = accepted.findIndex((r) => !r.postSeason);
  return idx === -1 ? accepted.length : idx;
}

export function postSeasonCompletedCount(accepted: SeasonClientRun[]): number {
  return accepted.filter((r) => r.postSeason).length;
}

/**
 * Scenario arc completeness for the progress bar (Season 1 post-season = 50%; later seasons can raise this when multi-season arcs resolve).
 */
export function postSeasonScenarioCompletenessPercent(season: number): number {
  if (season === 1) return 50;
  return 50;
}

export function reachEffectivenessLabels(reach: number, effectiveness: number): { reach: "high" | "low"; effectiveness: "high" | "low" } {
  return {
    reach: reach > 50 ? "high" : "low",
    effectiveness: effectiveness > 50 ? "high" : "low",
  };
}

function postSeasonArcKeyFromMetrics(reach: number, effectiveness: number):
  | "low_visibility_low_effectiveness"
  | "low_visibility_high_effectiveness"
  | "high_visibility_low_effectiveness"
  | "high_visibility_high_effectiveness" {
  const reachHigh = reach > 50;
  const effectivenessHigh = effectiveness > 50;
  if (!reachHigh && !effectivenessHigh) return "low_visibility_low_effectiveness";
  if (!reachHigh && effectivenessHigh) return "low_visibility_high_effectiveness";
  if (reachHigh && !effectivenessHigh) return "high_visibility_low_effectiveness";
  return "high_visibility_high_effectiveness";
}

/** Post-season 1 scenario arc blurb (uses scenario arc_2 branches from reach/effectiveness thresholds). */
export function buildPostSeasonArcBlurb(client: SeasonClient, reach: number, effectiveness: number): string {
  const key = postSeasonArcKeyFromMetrics(reach, effectiveness);
  const branch = client.postSeasonArcOutcomes?.[key];
  if (branch && branch.trim().length > 0) return branch;
  const { reach: rLab, effectiveness: eLab } = reachEffectivenessLabels(reach, effectiveness);
  return [
    `Message reach was ${rLab} and message effectiveness was ${eLab} (above 50% counts as high).`,
    `${client.scenarioTitle} — ${client.problem}`,
    "How the story lands next depends on these outcomes: reach is how far the narrative spread; effectiveness is how convincing it was where it mattered.",
  ].join(" ");
}

export function canAffordReachBoost(currentEur: number): boolean {
  return canAfford(currentEur, POST_SEASON_REACH_BOOST_COST_EUR);
}

export function canAffordEffectivenessBoost(currentCapacity: number): boolean {
  return currentCapacity >= POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY;
}

/**
 * Round 1, ~50% arc completeness: reputation from effectiveness only.
 * Eight bands of 12.5 points on 0–100 → −2 … +5.
 */
export function reputationDeltaHalfArcFromEffectiveness(effectivenessPercent: number): number {
  const e = Math.max(0, Math.min(100, effectivenessPercent));
  const idx = Math.min(7, Math.floor(e / 12.5));
  return idx - 2;
}

/**
 * Firm visibility gain (1–10), based 50% on reach and 50% on client satisfaction.
 */
export function visibilityGainFromReachAndClientSatisfaction(
  reachPercent: number,
  satisfactionPercent: number
): number {
  const r = Math.max(0, Math.min(100, reachPercent));
  const s = Math.max(0, Math.min(100, satisfactionPercent));
  const blended = r * 0.5 + s * 0.5;
  return Math.max(1, Math.min(10, Math.round(1 + (blended / 100) * 9)));
}

/**
 * Apply post-season boost for one client run.
 * Reputation and visibility apply only here, using final effectiveness and satisfaction after boosts.
 * Returns null if the loop is missing or the choice is unaffordable.
 */
export function applyPostSeasonChoice(
  save: NewGamePayload,
  seasonKey: string,
  clientId: string,
  choice: "reach" | "effectiveness" | "none",
  seasonNumber: number
): NewGamePayload | null {
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) return null;
  const client = loop.clientsQueue.find((c) => c.id === clientId);
  const run = loop.runs.find((r) => r.clientId === clientId);
  if (!client || !run?.outcome) return null;

  const boost = postSeasonBoostPointsFromCompetence(save.resources.competence);
  let eur = save.resources.eur;
  let cap = save.resources.firmCapacity;
  let newReach = run.outcome.messageSpread;
  let newEff = run.outcome.messageEffectiveness;

  if (choice === "reach") {
    if (!canAffordReachBoost(eur)) return null;
    eur -= POST_SEASON_REACH_BOOST_COST_EUR;
    newReach = Math.min(100, newReach + boost);
  } else if (choice === "effectiveness") {
    if (!canAffordEffectivenessBoost(cap)) return null;
    cap -= POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY;
    newEff = Math.min(100, newEff + boost);
  }

  const satisfaction = computeSatisfactionFromWeights(newReach, newEff, getSatisfactionReachWeight(client));

  const arcCompleteness = postSeasonScenarioCompletenessPercent(seasonNumber);
  let reputationDelta = 0;
  let visibilityGain = 0;
  if (arcCompleteness === 50) {
    reputationDelta = reputationDeltaHalfArcFromEffectiveness(newEff);
    visibilityGain = visibilityGainFromReachAndClientSatisfaction(newReach, satisfaction);
  }

  const repScale = METRIC_SCALES.reputation;
  const visScale = METRIC_SCALES.visibility;
  const newReputation = clampToScale((save.reputation ?? 5) + reputationDelta, repScale);
  const newVisibility = clampToScale(save.resources.visibility + visibilityGain, visScale);

  const newRuns: SeasonClientRun[] = loop.runs.map((r) =>
    r.clientId === clientId
      ? {
          ...r,
          outcome: { messageSpread: newReach, messageEffectiveness: newEff, satisfaction },
          postSeason: {
            choice,
            boostPointsApplied: choice === "none" ? 0 : boost,
            reachPercent: newReach,
            effectivenessPercent: newEff,
            reputationDelta,
            visibilityGain,
          },
        }
      : r
  );

  return {
    ...save,
    reputation: newReputation,
    resources: {
      ...save.resources,
      eur: Math.max(0, eur),
      firmCapacity: Math.max(0, cap),
      visibility: newVisibility,
    },
    seasonLoopBySeason: {
      ...save.seasonLoopBySeason,
      [seasonKey]: {
        ...loop,
        runs: newRuns,
        lastOutcome: { messageSpread: newReach, messageEffectiveness: newEff, satisfaction },
      },
    },
  };
}
