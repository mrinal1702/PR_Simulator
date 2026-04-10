/**
 * Season 1 campaign outcome scores (reach + effectiveness), 0–100 each.
 *
 * Architecture (later hooks, not implemented here):
 * - These are the **Season 1 main** solution metrics.
 * - Optional **small** boost after Season 1 post-season.
 * - Optional **larger** boost in Season 2 main.
 * - Final values then feed **client satisfaction** and **reputation** deltas.
 *
 * **Season 1** C/V knots match `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` (empirical
 * Q1/median/Q3, ~80 benchmark, stacked ceilings). **Season 2** uses the same piecewise
 * + jitter + force math with recalibrated knots (median raw C/V at end of Pre-season 2
 * → ~50 pre-jitter).
 */

/** Reach driver core: 60% visibility + 35% competence (score jitter applied to V/C). */
const REACH_W_VIS = 0.6;
const REACH_W_COMP = 0.35;

/** Effectiveness driver core: 70% competence + 25% discipline (jitter applied to C). */
const EFF_W_COMP = 0.7;
const EFF_W_DISC = 0.25;

/**
 * Additive-force model:
 * final = base + force(centered_driver), so base is the midpoint and stat quality pushes up/down.
 *
 * Fixed variance span (independent of base):
 * total span = 40 points => force range [-20, +20] before clamp/round.
 */
const VARIANCE_HALF_SPAN_ABS = 20;
/** Season 2 carry-over improvement step: variance-only contribution is ±10 points (vs ±20 on full campaigns). */
const CARRYOVER_VARIANCE_HALF_SPAN_ABS = 10;
const FORCE_CURVE_K = 1.8;

/**
 * Seeded score jitter (small): applied around normalized scores instead of explicit random term.
 * Visibility jitter is intentionally a bit wider than competence jitter.
 */
const C_SCORE_JITTER_MAX = 3.5;
const V_SCORE_JITTER_MAX = 5.5;

/** Season 1: empirical Q1/median/Q3, benchmark ~80, stacked ceiling ~127, soft cap toward design max. */
const VISIBILITY_SCORE_KNOTS_SEASON1: [number, number][] = [
  [0, 3],
  [40, 22],
  [61.5, 48],
  [80, 62],
  [93, 72],
  [127, 88],
  [300, 96],
  [1000, 100],
];

/** Season 2: median raw visibility ~94 (end of Pre-season 2) → 50 pre-jitter. */
const VISIBILITY_SCORE_KNOTS_SEASON2: [number, number][] = [
  [0, 3],
  [40, 22],
  [61.5, 38],
  [80, 45],
  [94, 50],
  [127, 85],
  [300, 96],
  [1000, 100],
];

/** Season 1: same references as visibility (stacked pre-season ceilings). */
const COMPETENCE_SCORE_KNOTS_SEASON1: [number, number][] = [
  [0, 3],
  [38.8, 22],
  [54, 48],
  [80, 62],
  [90, 71],
  [124, 87],
  [300, 96],
  [1000, 100],
];

/** Season 2: median raw competence ~85.5 (end of Pre-season 2) → 50 pre-jitter. */
const COMPETENCE_SCORE_KNOTS_SEASON2: [number, number][] = [
  [0, 3],
  [38.8, 22],
  [54, 35],
  [80, 45.11],
  [90, 54],
  [124, 82],
  [300, 96],
  [1000, 100],
];

/**
 * Client discipline (typically ~30–85) → 0–100 for effectiveness variance.
 * Higher discipline = better execution contribution.
 */
const DISCIPLINE_SCORE_KNOTS: [number, number][] = [
  [0, 5],
  [25, 12],
  [30, 20],
  [50, 50],
  [85, 90],
  [100, 96],
];

function piecewiseLinear(knots: [number, number][], x: number): number {
  if (knots.length < 2) return knots[0]?.[1] ?? 0;
  if (x <= knots[0]![0]) return knots[0]![1];
  if (x >= knots[knots.length - 1]![0]) return knots[knots.length - 1]![1];
  for (let i = 0; i < knots.length - 1; i += 1) {
    const [x0, y0] = knots[i]!;
    const [x1, y1] = knots[i + 1]!;
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return knots[knots.length - 1]![1];
}

function hashToUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const u = (Math.abs(h) % 10001) / 10000;
  return u;
}

function jitterScore(seed: string, salt: string, baseScore: number, maxAbsDelta: number): number {
  const u = hashToUnit(`${seed}\0${salt}`);
  const delta = (u * 2 - 1) * maxAbsDelta;
  const out = baseScore + delta;
  return Math.max(0, Math.min(100, out));
}

/** Raw visibility → 0–100 for reach variance (**Season 1** knots). */
export function visibilityScoreForVariance(visibility: number): number {
  return piecewiseLinear(VISIBILITY_SCORE_KNOTS_SEASON1, Math.max(0, visibility));
}

/** Raw visibility → 0–100 (**Season 2** recalibrated knots). */
export function visibilityScoreForVarianceSeason2(visibility: number): number {
  return piecewiseLinear(VISIBILITY_SCORE_KNOTS_SEASON2, Math.max(0, visibility));
}

/** Raw competence → 0–100 for reach + effectiveness variance (**Season 1** knots). */
export function competenceScoreForVariance(competence: number): number {
  return piecewiseLinear(COMPETENCE_SCORE_KNOTS_SEASON1, Math.max(0, competence));
}

/** Raw competence → 0–100 (**Season 2** recalibrated knots). */
export function competenceScoreForVarianceSeason2(competence: number): number {
  return piecewiseLinear(COMPETENCE_SCORE_KNOTS_SEASON2, Math.max(0, competence));
}

export function disciplineScoreForVariance(discipline: number): number {
  return piecewiseLinear(DISCIPLINE_SCORE_KNOTS, Math.max(0, discipline));
}

type SolutionMetricsInput = {
  baseReach: number;
  baseEffectiveness: number;
  visibility: number;
  competence: number;
  discipline: number;
  seed: string;
};

function computeSolutionMetricsWithKnots(
  input: SolutionMetricsInput,
  visKnots: [number, number][],
  compKnots: [number, number][]
): { reach: number; effectiveness: number } {
  const vVisBase = piecewiseLinear(visKnots, Math.max(0, input.visibility));
  const vCompBase = piecewiseLinear(compKnots, Math.max(0, input.competence));
  const vVis = jitterScore(input.seed, "v-score-jitter", vVisBase, V_SCORE_JITTER_MAX);
  const vComp = jitterScore(input.seed, "c-score-jitter", vCompBase, C_SCORE_JITTER_MAX);
  const vDisc = disciplineScoreForVariance(input.discipline);

  const reachDriver = REACH_W_VIS * vVis + REACH_W_COMP * vComp;
  const effectivenessDriver = EFF_W_COMP * vComp + EFF_W_DISC * vDisc;

  const centerNorm = (score: number) => (Math.max(0, Math.min(100, score)) - 50) / 50;
  const forceFromDriver = (driver: number, maxAbs: number) =>
    Math.tanh(FORCE_CURVE_K * centerNorm(driver)) * maxAbs;

  const reachForceMax = VARIANCE_HALF_SPAN_ABS;
  const effectivenessForceMax = VARIANCE_HALF_SPAN_ABS;

  const reach = Math.round(input.baseReach + forceFromDriver(reachDriver, reachForceMax));
  const effectiveness = Math.round(
    input.baseEffectiveness + forceFromDriver(effectivenessDriver, effectivenessForceMax)
  );

  return {
    reach: Math.max(0, Math.min(100, reach)),
    effectiveness: Math.max(0, Math.min(100, effectiveness)),
  };
}

/**
 * Season 1 campaign outcomes (additive-force): **Season 1** C/V normalization knots.
 */
export function computeSeason1SolutionMetrics(input: SolutionMetricsInput): {
  reach: number;
  effectiveness: number;
} {
  return computeSolutionMetricsWithKnots(
    input,
    VISIBILITY_SCORE_KNOTS_SEASON1,
    COMPETENCE_SCORE_KNOTS_SEASON1
  );
}

/**
 * Season 2+ campaign outcomes: same force model; **Season 2** C/V knots (median-recalibrated).
 */
export function computeSeason2SolutionMetrics(input: SolutionMetricsInput): {
  reach: number;
  effectiveness: number;
} {
  return computeSolutionMetricsWithKnots(
    input,
    VISIBILITY_SCORE_KNOTS_SEASON2,
    COMPETENCE_SCORE_KNOTS_SEASON2
  );
}

/**
 * Reach/effectiveness variance deltas for Season 2 carry-over (same drivers, Season 2 C/V knots,
 * jitter, discipline mapping as full metrics) with force span ±10 percentage points each.
 */
export function computeCarryoverVarianceDeltasSeason2(input: {
  visibility: number;
  competence: number;
  discipline: number;
  seed: string;
}): { reachVarianceDelta: number; effectivenessVarianceDelta: number } {
  const vVisBase = piecewiseLinear(VISIBILITY_SCORE_KNOTS_SEASON2, Math.max(0, input.visibility));
  const vCompBase = piecewiseLinear(COMPETENCE_SCORE_KNOTS_SEASON2, Math.max(0, input.competence));
  const vVis = jitterScore(input.seed, "v-score-jitter", vVisBase, V_SCORE_JITTER_MAX);
  const vComp = jitterScore(input.seed, "c-score-jitter", vCompBase, C_SCORE_JITTER_MAX);
  const vDisc = disciplineScoreForVariance(input.discipline);

  const reachDriver = REACH_W_VIS * vVis + REACH_W_COMP * vComp;
  const effectivenessDriver = EFF_W_COMP * vComp + EFF_W_DISC * vDisc;

  const centerNorm = (score: number) => (Math.max(0, Math.min(100, score)) - 50) / 50;
  const forceFromDriver = (driver: number, maxAbs: number) =>
    Math.tanh(FORCE_CURVE_K * centerNorm(driver)) * maxAbs;

  const reachVarianceDelta = Math.round(forceFromDriver(reachDriver, CARRYOVER_VARIANCE_HALF_SPAN_ABS));
  const effectivenessVarianceDelta = Math.round(
    forceFromDriver(effectivenessDriver, CARRYOVER_VARIANCE_HALF_SPAN_ABS)
  );

  return { reachVarianceDelta, effectivenessVarianceDelta };
}
