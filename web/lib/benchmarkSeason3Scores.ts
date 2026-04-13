/**
 * Season 3-only benchmark normalization for raw visibility, competence, and reputation.
 * Same z → score shape as Season 2 (50 at μ, +10 per +1σ, clamped 0–100); different μ/σ only.
 */

import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";

/** μ for raw visibility at Season 3 entry. */
export const SEASON3_BENCHMARK_VISIBILITY_MEAN = 175;
/** σ for raw visibility at Season 3 entry. */
export const SEASON3_BENCHMARK_VISIBILITY_STD = 75;

/** μ for raw competence at Season 3 entry. */
export const SEASON3_BENCHMARK_COMPETENCE_MEAN = 145;
/** σ for raw competence at Season 3 entry. */
export const SEASON3_BENCHMARK_COMPETENCE_STD = 70;

/** μ for raw reputation at Season 3 rolls (game reputation scale, see `metricScales.ts`). */
export const SEASON3_REPUTATION_BENCHMARK_MEAN = 45;
/** σ for raw reputation at Season 3 rolls. */
export const SEASON3_REPUTATION_BENCHMARK_STD = 40;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Raw stat → 0–100 score: 50 at the benchmark mean, +10 per +1σ (clamped).
 * Matches Season 2 shape; Season 3 constants only.
 */
export function benchmarkRawVisibilityToScoreSeason3(raw: number): number {
  const z = (Math.max(0, raw) - SEASON3_BENCHMARK_VISIBILITY_MEAN) / SEASON3_BENCHMARK_VISIBILITY_STD;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score));
}

export function benchmarkRawCompetenceToScoreSeason3(raw: number): number {
  const z = (Math.max(0, raw) - SEASON3_BENCHMARK_COMPETENCE_MEAN) / SEASON3_BENCHMARK_COMPETENCE_STD;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score));
}

/**
 * Raw reputation → 0–100 score (same z-shape as V/C). Used where a normalized reputation score is needed for Season 3.
 */
export function benchmarkRawReputationToScoreSeason3(reputation: number): number {
  const r = clampToScale(reputation, METRIC_SCALES.reputation);
  const z = (r - SEASON3_REPUTATION_BENCHMARK_MEAN) / SEASON3_REPUTATION_BENCHMARK_STD;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score));
}

/** Standardized reputation z for Season 3 (same definition as Season 2, different μ/σ). */
export function reputationZScoreSeason3(reputation: number): number {
  const r = clampToScale(reputation, METRIC_SCALES.reputation);
  return (r - SEASON3_REPUTATION_BENCHMARK_MEAN) / SEASON3_REPUTATION_BENCHMARK_STD;
}

/** Map z_R roughly into [0,1] for mixing (Season 3 calibration). */
export function reputationBlend01Season3(reputation: number): number {
  const z = reputationZScoreSeason3(reputation);
  return clamp01(0.5 + 0.22 * z);
}
