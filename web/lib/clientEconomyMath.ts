/**
 * Client economy: type skew, budget tier, within-tier budgets, and season-1 client count.
 * Reputation bounds match {@link METRIC_SCALES} (single source of truth).
 * Visibility has no design maximum; we use an asymptotic map so high values never hit a fake ceiling.
 */

import {
  benchmarkRawCompetenceToScore,
  benchmarkRawVisibilityToScore,
  reputationBlend01,
  reputationZScore,
  SEASON2_BENCHMARK_VISIBILITY_STD,
} from "@/lib/benchmarkSeason2Scores";
import { METRIC_SCALES } from "@/lib/metricScales";
import { visibilityScoreForVarianceSeason2 } from "@/lib/solutionOutcomeMath";

export type ClientKind = "individual" | "small_business" | "corporate";

/** Canonical reputation range (see `metricScales.ts` / README). */
export const REPUTATION_MIN = METRIC_SCALES.reputation.min;
export const REPUTATION_MAX = METRIC_SCALES.reputation.max;

/** Reference k for V/(V+k); higher k = slower approach to 1. Tunable. */
export const DEFAULT_VISIBILITY_ASYMPTOTE_K = 150;

/** Seasons 1–2: budget tier cannot exceed this (no tier 3+ until later seasons). */
export const EARLY_GAME_MAX_BUDGET_TIER = 2 as const;

/**
 * Tier-2 vs tier-1 threshold on combined score (seasons ≤2). Tunable.
 * Keeps early game mostly tier 1; tier 2 reachable with strong vis/rep.
 */
export const BUDGET_TIER2_SCORE_THRESHOLD = 0.52;

/** Small deterministic jitter amplitude (±) applied to tier score from seed. */
export const BUDGET_TIER_SCORE_JITTER = 0.06;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Map reputation into [0,1] using fixed min/max (handles negative rep). */
export function normalizeReputation(reputation: number): number {
  const r = clampToReputation(reputation);
  return clamp01((r - REPUTATION_MIN) / (REPUTATION_MAX - REPUTATION_MIN));
}

function clampToReputation(reputation: number): number {
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, reputation));
}

/**
 * Visibility has no maximum in design. This maps [0,∞) → [0,1) with diminishing returns.
 * `visibilityInfluence(v) → 1` as v → ∞.
 */
export function visibilityInfluence(visibility: number, k = DEFAULT_VISIBILITY_ASYMPTOTE_K): number {
  const v = Math.max(0, visibility);
  return v / (v + k);
}

/**
 * Season 1 (first client round): fixed “early pipeline” mix — mostly individuals, rare corporates,
 * SMB bumps when visibility influence is low. Agency stats barely vary; keep weights stable.
 */
function typeSkewWeightsSeason1(R: number, V: number): Record<ClientKind, number> {
  const wInd = (1.8 + 4.0 * V) * (1.35 - 0.55 * R);
  const wSmb = (0.5 + 1.0 * (1 - V)) * (0.72 + 0.28 * R);
  const wCorp = (0.14 + 0.52 * R + 0.12 * V) * 0.11;
  return {
    individual: Math.max(0.01, wInd),
    small_business: Math.max(0.01, wSmb),
    corporate: Math.max(0.001, wCorp),
  };
}

/**
 * Season 2: bridge toward stat-driven mix — more corporate/rep sensitivity than season 1, still tempered.
 */
function typeSkewWeightsSeason2(R: number, V: number): Record<ClientKind, number> {
  const a = typeSkewWeightsSeason1(R, V);
  const b = typeSkewWeightsSeason3Plus(R, V);
  const t = 0.45;
  return {
    individual: a.individual * (1 - t) + b.individual * t,
    small_business: a.small_business * (1 - t) + b.small_business * t,
    corporate: a.corporate * (1 - t) + b.corporate * t,
  };
}

/**
 * Season 3+: agency stats are more varied — classic visibility/reputation skew with full corporate channel.
 */
function typeSkewWeightsSeason3Plus(R: number, V: number): Record<ClientKind, number> {
  return {
    individual: Math.max(0.01, 0.65 * V + 0.35 * (1 - R)),
    small_business: Math.max(0.01, 0.5 * V + 0.5 * R),
    corporate: Math.max(0.01, 0.35 * V + 0.65 * R),
  };
}

/** Unnormalized weights before normalization; branch by season so round 1 stays fixed vs later rounds. */
export function typeSkewWeights(reputation: number, visibility: number, season: number): Record<ClientKind, number> {
  const R = normalizeReputation(reputation);
  const V = visibilityInfluence(visibility);
  if (season <= 1) return typeSkewWeightsSeason1(R, V);
  if (season === 2) return typeSkewWeightsSeason2(R, V);
  return typeSkewWeightsSeason3Plus(R, V);
}

export function typeSkewProbabilities(reputation: number, visibility: number, season: number): Record<ClientKind, number> {
  const w = typeSkewWeights(reputation, visibility, season);
  const sum = w.individual + w.small_business + w.corporate;
  if (sum <= 0) {
    return { individual: 0.7, small_business: 0.28, corporate: 0.02 };
  }
  return {
    individual: w.individual / sum,
    small_business: w.small_business / sum,
    corporate: w.corporate / sum,
  };
}

/** Deterministic client kind from agency stats + seed (for repeatable runs). */
export function sampleClientKindDeterministic(
  seed: string,
  reputation: number,
  visibility: number,
  season: number
): ClientKind {
  const p = typeSkewProbabilities(reputation, visibility, season);
  const u = hash01(`${seed}|kind`);
  if (u < p.individual) return "individual";
  if (u < p.individual + p.small_business) return "small_business";
  return "corporate";
}

/** Combined score for budget tier (visibility + reputation; rep slightly heavier for tier). */
export function budgetTierScore(visibility: number, reputation: number): number {
  const R = normalizeReputation(reputation);
  const V = visibilityInfluence(visibility);
  return 0.45 * V + 0.55 * R;
}

export function maxBudgetTierForSeason(season: number): number {
  if (season <= 2) return EARLY_GAME_MAX_BUDGET_TIER;
  return 7;
}

/**
 * Budget tier for early seasons (1–2): only 1 or 2. Hard-capped; no tier 3+ here.
 * Later seasons: extend mapping when higher tiers unlock.
 */
export function computeBudgetTierDeterministic(
  seed: string,
  season: number,
  visibility: number,
  reputation: number
): 1 | 2 {
  const cap = maxBudgetTierForSeason(season);
  if (cap <= 1) return 1;

  if (season <= 2) {
    let s = budgetTierScore(visibility, reputation);
    s += (hash01(`${seed}|tier`) - 0.5) * 2 * BUDGET_TIER_SCORE_JITTER;
    s = clamp01(s);
    const tier: 1 | 2 = s >= BUDGET_TIER2_SCORE_THRESHOLD ? 2 : 1;
    return Math.min(tier, cap) as 1 | 2;
  }

  // Placeholder until tiers 3–7 are wired.
  return 1;
}

/** Min/max total contract (EUR, whole thousands in practice) per type and tier. */
export const CLIENT_BUDGET_TIER_RANGES: Record<ClientKind, Record<1 | 2, { min: number; max: number }>> = {
  individual: {
    1: { min: 43_000, max: 47_000 },
    2: { min: 60_000, max: 70_000 },
  },
  small_business: {
    1: { min: 42_000, max: 46_000 },
    2: { min: 64_000, max: 74_000 },
  },
  corporate: {
    1: { min: 60_000, max: 66_000 },
    2: { min: 70_000, max: 80_000 },
  },
};

/** Extra EUR for Season 2 tier-1 individual contracts after the within-tier roll. */
export const SEASON2_TIER1_INDIVIDUAL_BUDGET_BOOST_EUR = 5_000;

/** Second corporate slot: rep at/above this keeps a meaningful second corporate chance. */
export const SEASON2_CORPORATE_ELITE_REP_THRESHOLD = 7;

/**
 * Within-tier total budget: visibility only (no reputation).
 * Uses asymptotic visibility so there is no visibility ceiling in the formula.
 */
export function rollClientBudgetTotalInTier(kind: ClientKind, tier: 1 | 2, visibility: number): number {
  const { min, max } = CLIENT_BUDGET_TIER_RANGES[kind][tier];
  const t = visibilityInfluence(visibility);
  const raw = min + (max - min) * t;
  return Math.round(raw / 1000) * 1000;
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Smooth base P(corporate) from standardized reputation; nil below μ−σ. */
function season2BaseCorporateProbability(zR: number): number {
  if (zR < -1) return 0;
  return 0.06 + 0.34 * logistic(2 * (zR - 0.1));
}

function season2AdjustCorporateAfterPrior(p: number, reputation: number, hadCorporateBefore: boolean): number {
  if (!hadCorporateBefore) return p;
  if (reputation >= SEASON2_CORPORATE_ELITE_REP_THRESHOLD) return p * 0.42;
  return p * 0.08;
}

/** P(small business | not corporate): reputation-weighted mix vs benchmark V. */
function season2ProbabilitySmallBusinessGivenNotCorporate(rBlend: number, vNorm: number): number {
  const mix = 0.62 * rBlend + 0.38 * vNorm;
  return logistic(4.2 * (mix - 0.48));
}

/** Tier-2 probability for individual or SMB (corporate never tier 2 in Season 2). */
function season2Tier2ProbabilityNonCorporate(
  kind: "individual" | "small_business",
  rBlend: number,
  vNorm: number,
  cNorm: number,
  seed: string,
  slotIndex: number
): number {
  const noise = (hash01(`${seed}|tiern|${slotIndex}`) - 0.5) * 0.14;
  if (kind === "small_business") {
    const s = 0.6 * rBlend + 0.25 * vNorm + 0.15 * cNorm + noise;
    return logistic(5 * (s - 0.5));
  }
  const s = 0.5 * rBlend + 0.35 * vNorm + 0.15 * cNorm + noise;
  return logistic(4.5 * (s - 0.48));
}

function season2DownweightTier2IfPriorTier2(priorTier2: boolean, pTier2: number): number {
  if (!priorTier2) return pTier2;
  return pTier2 * 0.32;
}

export type Season2ClientRollArgs = {
  seedBase: string;
  reputation: number;
  entryVScore: number;
  entryCScore: number;
  slotIndex: number;
  plannedClientCount: number;
  hadCorporateBeforeSlot: boolean;
  hadTier2BeforeSlot: boolean;
};

/**
 * Season 2 client type + budget tier: logistic corporate odds, SMB vs individual, tier 2 for non-corporate,
 * slot 3 forced individual tier 1, no corporate tier 2.
 */
export function season2RollClientKindAndTier(args: Season2ClientRollArgs): { kind: ClientKind; tier: 1 | 2 } {
  const { seedBase, reputation, entryVScore, entryCScore, slotIndex, plannedClientCount } = args;
  const zR = reputationZScore(reputation);
  const vNorm = Math.max(0, Math.min(1, entryVScore / 100));
  const cNorm = Math.max(0, Math.min(1, entryCScore / 100));
  const rBlend = reputationBlend01(reputation);

  if (plannedClientCount === 3 && slotIndex === 2) {
    return { kind: "individual", tier: 1 };
  }

  let pCorp = season2BaseCorporateProbability(zR);
  pCorp = season2AdjustCorporateAfterPrior(pCorp, reputation, args.hadCorporateBeforeSlot);

  const uKind = hash01(`${seedBase}|s2|kind|${slotIndex}`);
  if (uKind < pCorp) {
    return { kind: "corporate", tier: 1 };
  }

  const pSmb = season2ProbabilitySmallBusinessGivenNotCorporate(rBlend, vNorm);
  const uSmb = hash01(`${seedBase}|s2|smb|${slotIndex}`);
  const kind: ClientKind = uSmb < pSmb ? "small_business" : "individual";

  let pTier = season2Tier2ProbabilityNonCorporate(kind, rBlend, vNorm, cNorm, seedBase, slotIndex);
  pTier = season2DownweightTier2IfPriorTier2(args.hadTier2BeforeSlot, pTier);

  const uTier = hash01(`${seedBase}|s2|tier|${slotIndex}`);
  const tier: 1 | 2 = uTier < pTier ? 2 : 1;
  return { kind, tier };
}

/**
 * Within-tier budget for Season 2: mostly entry V_score + deterministic roll; tier-1 individuals get a flat boost.
 */
export function rollSeason2ClientBudget(
  kind: ClientKind,
  tier: 1 | 2,
  seed: string,
  slotIndex: number,
  entryVScore: number
): number {
  const { min, max } = CLIENT_BUDGET_TIER_RANGES[kind][tier];
  const vNorm = Math.max(0, Math.min(1, entryVScore / 100));
  const u = hash01(`${seed}|s2|bud|${slotIndex}`);
  const frac = clamp01(0.72 * vNorm + 0.28 * u);
  let total = min + frac * (max - min);
  total = Math.round(total / 1000) * 1000;
  if (kind === "individual" && tier === 1) {
    total += SEASON2_TIER1_INDIVIDUAL_BUDGET_BOOST_EUR;
  }
  return total;
}

/**
 * Resolve entry V/C scores for Season 2 rolls when `seasonEntryScoresBySeason` is missing.
 */
export function season2EntryScoresFromRawStats(visibility: number, competence: number): {
  vScore: number;
  cScore: number;
} {
  return {
    vScore: benchmarkRawVisibilityToScore(visibility),
    cScore: benchmarkRawCompetenceToScore(competence),
  };
}

/**
 * Reference distribution for Season 2+ V_score (third-client probability).
 * Proxies from `cv-season2-entry-grid.json` `gridAll1200`: median raw vis 88 → P50 score; Q3 raw 108 → P75 score
 * under benchmark normalization (μ=81, σ = {@link SEASON2_BENCHMARK_VISIBILITY_STD}).
 */
export const SEASON2_REFERENCE_V_SCORE_P50 = 50 + (10 * (88 - 81)) / SEASON2_BENCHMARK_VISIBILITY_STD;
export const SEASON2_REFERENCE_V_SCORE_P75 = 50 + (10 * (108 - 81)) / SEASON2_BENCHMARK_VISIBILITY_STD;

/** Mid-game visibility anchor (~60): target ~30% chance of a third client in season 1. */
const SEASON1_P3_VIS_MID = 60;
const SEASON1_P3_AT_MID = 0.3;
const SEASON1_P3_VIS_LOW = 20;
const SEASON1_P3_AT_LOW = 0.08;
const SEASON1_P3_VIS_HIGH = 115;
const SEASON1_P3_AT_HIGH = 0.92;

/**
 * Season 1: third client slot probability — flat at low vis, ~30% around mid visibility (~60),
 * only approaches ~90% with strong visibility (saved for heavy investment). Piecewise linear.
 */
export function season1ThirdClientProbability(visibility: number): number {
  const v = Math.max(0, visibility);
  if (v <= SEASON1_P3_VIS_LOW) return SEASON1_P3_AT_LOW;
  if (v <= SEASON1_P3_VIS_MID) {
    const span = SEASON1_P3_VIS_MID - SEASON1_P3_VIS_LOW;
    const u = (v - SEASON1_P3_VIS_LOW) / span;
    return SEASON1_P3_AT_LOW + (SEASON1_P3_AT_MID - SEASON1_P3_AT_LOW) * u;
  }
  if (v <= SEASON1_P3_VIS_HIGH) {
    const span = SEASON1_P3_VIS_HIGH - SEASON1_P3_VIS_MID;
    const u = (v - SEASON1_P3_VIS_MID) / span;
    return SEASON1_P3_AT_MID + (SEASON1_P3_AT_HIGH - SEASON1_P3_AT_MID) * u;
  }
  return SEASON1_P3_AT_HIGH;
}

/**
 * Probability of rolling **3** clients (vs 2) for Season 2+, from entry **V_score** vs benchmark quantiles.
 * @see SEASON2_REFERENCE_V_SCORE_P50, SEASON2_REFERENCE_V_SCORE_P75
 */
export function season2PlusThirdClientProbabilityFromVScore(vScore: number): number {
  if (vScore >= SEASON2_REFERENCE_V_SCORE_P75) return 0.8;
  if (vScore >= SEASON2_REFERENCE_V_SCORE_P50) return 0.5;
  return 0.25;
}

/**
 * How many clients appear in a season.
 * Season 1: 2 or 3; third slot is probabilistic from **raw visibility** (see {@link season1ThirdClientProbability}).
 * Season 2+: always 2 or 3; third slot is probabilistic from **entry V_score** vs reference curve (see
 * {@link season2PlusThirdClientProbabilityFromVScore}). Pass `entryVScore` from {@link seasonEntryScoresBySeason}
 * when available; otherwise pass `undefined` to derive from current visibility (Season 2 knots).
 */
export function plannedClientCountForSeason(
  season: number,
  visibility: number,
  seed: string,
  entryVScore?: number
): number {
  if (season === 1) {
    const p3 = season1ThirdClientProbability(visibility);
    const u = hash01(`${seed}|season1|slots`);
    return u < p3 ? 3 : 2;
  }
  const v =
    entryVScore !== undefined && Number.isFinite(entryVScore)
      ? entryVScore
      : visibilityScoreForVarianceSeason2(visibility);
  const p3 = season2PlusThirdClientProbabilityFromVScore(v);
  const u = hash01(`${seed}|s${season}|slots`);
  return u < p3 ? 3 : 2;
}

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
