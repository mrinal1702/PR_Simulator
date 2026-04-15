/**
 * Hiring-time “attract” normalization: maps raw agency stats to 0–1 channels used in
 * `hiring.ts` `resolveSkill` role blends.
 *
 * **Season 1:** visibility/competence use the same Season 1 score knots as client variance;
 * reputation uses a legacy clamp (backward compatible with early hiring).
 *
 * **Season 2:** same benchmarks as Season 2 client / entry scores.
 *
 * **Season ≥ 3:** μ and σ are the **arithmetic mean** of Season 2 and Season 3 benchmark
 * constants so hiring is not tied to a grid that omits shopping (S2) or includes post-hire
 * roster inflation (S3) alone. Reused for Season 4+ until separate calibration exists.
 */

import {
  SEASON2_BENCHMARK_VISIBILITY_MEAN,
  SEASON2_BENCHMARK_VISIBILITY_STD,
  SEASON2_BENCHMARK_COMPETENCE_MEAN,
  SEASON2_BENCHMARK_COMPETENCE_STD,
  REPUTATION_BENCHMARK_MEAN,
  REPUTATION_BENCHMARK_STD,
  benchmarkRawVisibilityToScore,
  benchmarkRawCompetenceToScore,
  reputationBlend01,
} from "@/lib/benchmarkSeason2Scores";
import {
  SEASON3_BENCHMARK_VISIBILITY_MEAN,
  SEASON3_BENCHMARK_VISIBILITY_STD,
  SEASON3_BENCHMARK_COMPETENCE_MEAN,
  SEASON3_BENCHMARK_COMPETENCE_STD,
  SEASON3_REPUTATION_BENCHMARK_MEAN,
  SEASON3_REPUTATION_BENCHMARK_STD,
} from "@/lib/benchmarkSeason3Scores";
import { clampToScale, METRIC_SCALES } from "@/lib/metricScales";
import { competenceScoreForVariance, visibilityScoreForVariance } from "@/lib/solutionOutcomeMath";

/** Blended visibility μ (Season 2 and Season 3 benchmark means averaged). */
export const HIRING_ATTRACT_VISIBILITY_MEAN =
  (SEASON2_BENCHMARK_VISIBILITY_MEAN + SEASON3_BENCHMARK_VISIBILITY_MEAN) / 2;

/** Blended visibility σ for hiring attract. */
export const HIRING_ATTRACT_VISIBILITY_STD =
  (SEASON2_BENCHMARK_VISIBILITY_STD + SEASON3_BENCHMARK_VISIBILITY_STD) / 2;

/** Blended competence μ for hiring attract. */
export const HIRING_ATTRACT_COMPETENCE_MEAN =
  (SEASON2_BENCHMARK_COMPETENCE_MEAN + SEASON3_BENCHMARK_COMPETENCE_MEAN) / 2;

/** Blended competence σ for hiring attract. */
export const HIRING_ATTRACT_COMPETENCE_STD =
  (SEASON2_BENCHMARK_COMPETENCE_STD + SEASON3_BENCHMARK_COMPETENCE_STD) / 2;

/**
 * Blended reputation μ (Season 2 client-roll anchor and Season 3 raw-rep grid, averaged;
 * same `save.reputation` field for both).
 */
export const HIRING_ATTRACT_REPUTATION_MEAN =
  (REPUTATION_BENCHMARK_MEAN + SEASON3_REPUTATION_BENCHMARK_MEAN) / 2;

/** Blended reputation σ for hiring attract. */
export const HIRING_ATTRACT_REPUTATION_STD =
  (REPUTATION_BENCHMARK_STD + SEASON3_REPUTATION_BENCHMARK_STD) / 2;

function rawToScore01(raw: number, mean: number, std: number): number {
  const z = (Math.max(0, raw) - mean) / std;
  const score = 50 + 10 * z;
  return Math.max(0, Math.min(100, score)) / 100;
}

export type HiringAttractChannels = { rep01: number; vis01: number; comp01: number };

/**
 * Normalized 0–1 attract channels for hiring hidden-skill rolls.
 */
export function hiringAttractChannels(args: {
  season: number;
  reputation: number;
  visibility: number;
  competence: number;
}): HiringAttractChannels {
  const { season, reputation, visibility, competence } = args;
  const repRaw = clampToScale(reputation, METRIC_SCALES.reputation);

  if (season <= 1) {
    return {
      rep01: Math.max(0, Math.min(1, repRaw / 100)),
      vis01: visibilityScoreForVariance(visibility) / 100,
      comp01: competenceScoreForVariance(competence) / 100,
    };
  }

  if (season === 2) {
    return {
      vis01: benchmarkRawVisibilityToScore(visibility) / 100,
      comp01: benchmarkRawCompetenceToScore(competence) / 100,
      rep01: reputationBlend01(repRaw),
    };
  }

  return {
    vis01: rawToScore01(visibility, HIRING_ATTRACT_VISIBILITY_MEAN, HIRING_ATTRACT_VISIBILITY_STD),
    comp01: rawToScore01(competence, HIRING_ATTRACT_COMPETENCE_MEAN, HIRING_ATTRACT_COMPETENCE_STD),
    rep01: rawToScore01(repRaw, HIRING_ATTRACT_REPUTATION_MEAN, HIRING_ATTRACT_REPUTATION_STD),
  };
}
