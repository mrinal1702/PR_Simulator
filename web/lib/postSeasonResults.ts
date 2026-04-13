import type { NewGamePayload } from "@/components/NewGameWizard";
import { canAfford } from "@/lib/budgetGuard";
import { clampToScale, METRIC_SCALES } from "@/lib/metricScales";
import { CLIENT_BUDGET_TIER_RANGES } from "@/lib/clientEconomyMath";
import {
  computeSatisfactionFromWeights,
  getSatisfactionReachWeight,
  type SeasonClient,
  type SeasonClientRun,
  type SeasonLoopState,
} from "@/lib/seasonClientLoop";
import { getEffectiveCompetenceForAgency } from "@/lib/agencyStatsEffective";
import { competenceScoreForVariance } from "@/lib/solutionOutcomeMath";

export const POST_SEASON_REACH_BOOST_COST_EUR = 5000;
export const POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY = 5;
export const POST_SEASON_SEASON2_REACH_BOOST_COST_EUR_TIER1 = 5000;
export const POST_SEASON_SEASON2_REACH_BOOST_COST_EUR_TIER2 = 10000;
export const POST_SEASON_SEASON2_EFFECTIVENESS_BOOST_COST_CAPACITY_TIER1 = 10;
export const POST_SEASON_SEASON2_EFFECTIVENESS_BOOST_COST_CAPACITY_TIER2 = 15;

const POST_SEASON_CURVE_STEEPNESS = 2.5;
const POST_SEASON_SEASON2_BOOST_JITTER_MAX = 0.65;

type PostSeasonCurveArgs = {
  metricPercent: number;
  min: number;
  max: number;
};

function hashToUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return (Math.abs(h) % 10001) / 10000;
}

function jitterValue(seed: string, salt: string, maxAbsDelta: number): number {
  const u = hashToUnit(`${seed}\0${salt}`);
  return (u * 2 - 1) * maxAbsDelta;
}

function curvedPostSeasonValue({ metricPercent, min, max }: PostSeasonCurveArgs): number {
  const clamped = Math.max(0, Math.min(100, metricPercent));
  const midpoint = (max + min) / 2;
  const halfSpan = (max - min) / 2;
  const centered = (clamped - 50) / 50;
  const curved = Math.tanh(POST_SEASON_CURVE_STEEPNESS * centered);
  return midpoint + halfSpan * curved;
}

/** Min/max reputation delta from effectiveness % (same tanh curve as Season 2 post-season). */
export type ReputationFromEffectivenessBounds = Readonly<{ min: number; max: number }>;

/** Season 2 post-season and carryovers resolved in hub season ≤2. */
export const REPUTATION_FROM_EFFECTIVENESS_SEASON2: ReputationFromEffectivenessBounds = {
  min: -10,
  max: 40,
};

/**
 * Hub season ≥3: wider reputation band for carryover outcomes in ledgers
 * ({@link collectPostSeasonLedger} via {@link carryoverHubReputationBounds}).
 * Fresh-campaign post-season boosts on season ≥2 loops use {@link REPUTATION_FROM_EFFECTIVENESS_SEASON2}
 * via {@link applyPostSeasonChoice}.
 */
export const REPUTATION_FROM_EFFECTIVENESS_SEASON3_CARRYOVER: ReputationFromEffectivenessBounds = {
  min: -50,
  max: 70,
};

/**
 * Reputation curve for a **rolled-over** scenario when the player finishes it in `hubSeason`.
 * Season 4+ defaults to the Season 3 carryover band until you retune here.
 */
export function carryoverHubReputationBounds(hubSeason: number): ReputationFromEffectivenessBounds {
  if (hubSeason <= 2) return REPUTATION_FROM_EFFECTIVENESS_SEASON2;
  if (hubSeason === 3) return REPUTATION_FROM_EFFECTIVENESS_SEASON3_CARRYOVER;
  return REPUTATION_FROM_EFFECTIVENESS_SEASON3_CARRYOVER;
}

/**
 * Maps firm competence (same normalization as Season 1 solution variance) to an integer boost 1–5%.
 */
export function postSeasonBoostPointsFromCompetence(competence: number): number {
  const s = competenceScoreForVariance(competence);
  return Math.max(1, Math.min(5, Math.round(1 + (s / 100) * 4)));
}

export function getClientBudgetTier(client: SeasonClient): 1 | 2 | 3 {
  if (client.budgetTier === 1 || client.budgetTier === 2 || client.budgetTier === 3) return client.budgetTier;
  const r = CLIENT_BUDGET_TIER_RANGES[client.clientKind];
  const t = client.budgetTotal;
  if (t >= r[3].min) return 3;
  if (t >= r[2].min) return 2;
  return 1;
}

export function postSeasonSeason2BoostPointsFromCScore(cScore: number, seed: string): number {
  const clamped = Math.max(0, Math.min(100, cScore));
  const baseBoost = 1 + (clamped / 100) * 4;
  const jitteredBoost = baseBoost + jitterValue(seed, "season2-postseason-boost", POST_SEASON_SEASON2_BOOST_JITTER_MAX);
  return Math.max(1, Math.min(5, Math.round(jitteredBoost)));
}

export function getSeason2ReachBoostCostEur(client: SeasonClient): number {
  const tier = getClientBudgetTier(client);
  return tier >= 2
    ? POST_SEASON_SEASON2_REACH_BOOST_COST_EUR_TIER2
    : POST_SEASON_SEASON2_REACH_BOOST_COST_EUR_TIER1;
}

export function getSeason2EffectivenessBoostCostCapacity(client: SeasonClient): number {
  const tier = getClientBudgetTier(client);
  return tier >= 2
    ? POST_SEASON_SEASON2_EFFECTIVENESS_BOOST_COST_CAPACITY_TIER2
    : POST_SEASON_SEASON2_EFFECTIVENESS_BOOST_COST_CAPACITY_TIER1;
}

/** Ledger rows for breakdowns and summaries across fresh-scenario and carry-over season-close resolutions. */
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
      const client = loop.clientsQueue.find((c) => c.id === r.clientId);
      const seasonNum = Number(seasonKey);
      if (r.postSeason) {
        const ps = r.postSeason;
        const eurReachCost =
          ps.choice === "reach"
            ? seasonNum >= 2 && client
              ? getSeason2ReachBoostCostEur(client)
              : POST_SEASON_REACH_BOOST_COST_EUR
            : 0;
        const effCapCost =
          ps.choice === "effectiveness"
            ? seasonNum >= 2 && client
              ? getSeason2EffectivenessBoostCostCapacity(client)
              : POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY
            : 0;
        out.push({
          seasonKey,
          scenarioTitle: client?.scenarioTitle ?? r.clientId,
          reputationDelta: ps.reputationDelta ?? 0,
          visibilityGain: ps.visibilityGain ?? 0,
          eurSpentOnReachBoost: eurReachCost,
          capacitySpentOnEffectivenessBoost: effCapCost,
        });
      }
      if (r.season2CarryoverResolution) {
        const hubSeason = seasonNum + 1;
        out.push({
          seasonKey: String(hubSeason),
          scenarioTitle: client?.scenarioTitle ?? r.clientId,
          reputationDelta:
            r.season2CarryoverResolution.reputationDelta ??
            reputationDeltaFromEffectivenessCurve(
              r.season2CarryoverResolution.messageEffectiveness,
              carryoverHubReputationBounds(hubSeason)
            ),
          visibilityGain:
            r.season2CarryoverResolution.visibilityGain ??
            visibilityGainFromSatisfactionCurve(r.season2CarryoverResolution.satisfaction),
          eurSpentOnReachBoost: 0,
          capacitySpentOnEffectivenessBoost: 0,
        });
      }
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

// ─── Season 2 arc-resolution utilities ───────────────────────────────────────

/** 3-bucket reach label for the arc_resolution 3×3 grid. ≤35 = low, 36–67 = medium, ≥68 = high. */
export function arcResolutionReachLabel(reach: number): "low" | "medium" | "high" {
  if (reach <= 35) return "low";
  if (reach <= 67) return "medium";
  return "high";
}

/** 3-bucket effectiveness label for the arc_resolution 3×3 grid. ≤35 = poor, 36–67 = good, ≥68 = convincing. */
export function arcResolutionEffLabel(effectiveness: number): "poor" | "good" | "convincing" {
  if (effectiveness <= 35) return "poor";
  if (effectiveness <= 67) return "good";
  return "convincing";
}

/** Pull the correct arc_resolution text from the scenario JSON object (accepts unknown for safety). */
export function buildArcResolutionText(arcResolution: unknown, reach: number, effectiveness: number): string {
  const reachLabel = arcResolutionReachLabel(reach);
  const effLabel = arcResolutionEffLabel(effectiveness);
  const arc = arcResolution as Record<string, Record<string, string>> | undefined;
  return arc?.[reachLabel]?.[effLabel] ?? `Reach ${reach}% — Effectiveness ${effectiveness}%`;
}

/** Pull the correct arc_1 text from the scenario JSON object. Uses same 50% threshold as Season 1 arc_2. */
export function buildArc1Text(arc1: unknown, reach: number, effectiveness: number): string {
  const key = postSeasonArcKeyFromMetrics(reach, effectiveness);
  const arc = arc1 as Record<string, string> | undefined;
  return arc?.[key] ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────

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

/** Season 2 follow-up scenario arc blurb (uses scenario arc_2 branches from reach/effectiveness thresholds). */
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

export function canAffordSeason2ReachBoost(currentEur: number, client: SeasonClient): boolean {
  return canAfford(currentEur, getSeason2ReachBoostCostEur(client));
}

export function canAffordSeason2EffectivenessBoost(currentCapacity: number, client: SeasonClient): boolean {
  return currentCapacity >= getSeason2EffectivenessBoostCostCapacity(client);
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

export function reputationDeltaFromEffectivenessCurve(
  effectivenessPercent: number,
  bounds: ReputationFromEffectivenessBounds = REPUTATION_FROM_EFFECTIVENESS_SEASON2
): number {
  return Math.round(curvedPostSeasonValue({ metricPercent: effectivenessPercent, min: bounds.min, max: bounds.max }));
}

export function visibilityGainFromSatisfactionCurve(satisfactionPercent: number): number {
  return Math.round(curvedPostSeasonValue({ metricPercent: satisfactionPercent, min: 0, max: 20 }));
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

  const seasonNum = Number(seasonKey);
  const cScore =
    seasonNum >= 2
      ? (save.seasonEntryScoresBySeason?.[seasonKey]?.cScore ?? 50)
      : undefined;
  const boostSeed = `${save.createdAt}|postseason|${seasonKey}|${clientId}|${choice}`;
  const boost =
    seasonNum >= 2
      ? postSeasonSeason2BoostPointsFromCScore(cScore ?? 50, boostSeed)
      : postSeasonBoostPointsFromCompetence(getEffectiveCompetenceForAgency(save));
  let eur = save.resources.eur;
  let cap = save.resources.firmCapacity;
  let newReach = run.outcome.messageSpread;
  let newEff = run.outcome.messageEffectiveness;

  if (choice === "reach") {
    const reachCost = seasonNum >= 2 ? getSeason2ReachBoostCostEur(client) : POST_SEASON_REACH_BOOST_COST_EUR;
    if (eur < reachCost) return null;
    eur -= reachCost;
    newReach = Math.min(100, newReach + boost);
  } else if (choice === "effectiveness") {
    const effCost =
      seasonNum >= 2
        ? getSeason2EffectivenessBoostCostCapacity(client)
        : POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY;
    if (cap < effCost) return null;
    cap -= effCost;
    newEff = Math.min(100, newEff + boost);
  }

  const satisfaction = computeSatisfactionFromWeights(newReach, newEff, getSatisfactionReachWeight(client));

  const arcCompleteness = postSeasonScenarioCompletenessPercent(seasonNumber);
  let reputationDelta = 0;
  let visibilityGain = 0;
  if (seasonNum >= 2) {
    reputationDelta = reputationDeltaFromEffectivenessCurve(newEff);
    visibilityGain = visibilityGainFromSatisfactionCurve(satisfaction);
  } else if (arcCompleteness === 50) {
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
