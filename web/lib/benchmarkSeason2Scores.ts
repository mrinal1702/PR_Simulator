/**
 * Season 2+ benchmark normalization for raw visibility and competence.
 * μ/σ were calibrated from a large scripted grid run; tweak here if you re-run a new calibration.
 */

/** μ for raw visibility at Season 2 entry (leeway vs prior grid average). */
export const SEASON2_BENCHMARK_VISIBILITY_MEAN = 81;
/** σ for raw visibility (Season 2 entry distribution). */
export const SEASON2_BENCHMARK_VISIBILITY_STD = 30.519854182245947;

/** μ for raw competence at Season 2 entry (leeway vs AI grid avg ~86.65). */
export const SEASON2_BENCHMARK_COMPETENCE_MEAN = 81;
/** σ for raw competence (Season 2 entry distribution). */
export const SEASON2_BENCHMARK_COMPETENCE_STD = 30.736628483871677;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Raw stat → 0–100 score: 50 at the benchmark mean, +10 per +1σ (clamped).
 * Same shape as reputation-style “centered on typical Season 2 entry.”
 */
export function benchmarkRawVisibilityToScore(raw: number): number {
  const z = (Math.max(0, raw) - SEASON2_BENCHMARK_VISIBILITY_MEAN) / SEASON2_BENCHMARK_VISIBILITY_STD;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score));
}

export function benchmarkRawCompetenceToScore(raw: number): number {
  const z = (Math.max(0, raw) - SEASON2_BENCHMARK_COMPETENCE_MEAN) / SEASON2_BENCHMARK_COMPETENCE_STD;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score));
}

/** Reputation reference for Season 2+ client rolls (μ, σ). */
export const REPUTATION_BENCHMARK_MEAN = 4.54;
export const REPUTATION_BENCHMARK_STD = 1.8;

export function reputationZScore(reputation: number): number {
  return (reputation - REPUTATION_BENCHMARK_MEAN) / REPUTATION_BENCHMARK_STD;
}

/** Map z_R roughly into [0,1] for mixing with normalized V/C (typical play −1…+2σ). */
export function reputationBlend01(reputation: number): number {
  const z = reputationZScore(reputation);
  return clamp01(0.5 + 0.22 * z);
}
