/**
 * 1000 one-scenario trials: simulate only until first scenario is solved.
 * Strategy: prioritize effectiveness (80%), then profit/vis/rep/satisfaction (5% each).
 * Saves calibration output as JSON under scripts/results/.
 *
 * Run:
 * npx tsx --tsconfig tsconfig.json scripts/simulate-first-scenario-calibration.ts
 */

import fs from "node:fs";
import path from "node:path";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import type { BuildId } from "../lib/gameEconomy";
import {
  buildSeasonClients,
  buildSolutionOptionsForClient,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SeasonClient,
  type SolutionOption,
} from "../lib/seasonClientLoop";
import {
  reputationDeltaHalfArcFromEffectiveness,
  visibilityGainFromReachAndClientSatisfaction,
} from "../lib/postSeasonResults";
import {
  competenceScoreForVariance,
  visibilityScoreForVariance,
} from "../lib/solutionOutcomeMath";
import { mulberry32, randomProfileForBuild } from "./simulate-multi-strategy-season";

const TRIALS = 1000;
const REP_START = 5;
const SEASON = 1;
const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];

const W = {
  effectiveness: 0.8,
  profit: 0.05,
  visGain: 0.05,
  reputation: 0.05,
  satisfaction: 0.05,
} as const;

type TrialRec = {
  competence: number;
  visibility: number;
  cScore: number;
  vScore: number;
  chosenSolutionId: string;
  effectiveness: number;
  spread: number;
  satisfaction: number;
};

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo);
}

function stdDev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  return Math.sqrt(values.reduce((s, x) => s + (x - avg) ** 2, 0) / values.length);
}

function summarize(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const avg = mean(values);
  return {
    min: s[0]!,
    q1: percentile(s, 0.25),
    median: percentile(s, 0.5),
    q3: percentile(s, 0.75),
    max: s[s.length - 1]!,
    avg,
    stdDev: stdDev(values, avg),
  };
}

function chooseFirstScenarioSolution(
  client: SeasonClient,
  startEur: number,
  startCap: number,
  visibility: number,
  competence: number,
  seedBase: string
): { solution: SolutionOption | null; outcome: ReturnType<typeof resolveClientOutcome> | null } {
  const options = buildSolutionOptionsForClient(client).filter((o) => !o.isRejectOption);
  const affordable = options.filter((o) => canAffordSolution(o, startEur + client.budgetSeason1, startCap));
  if (affordable.length === 0) return { solution: null, outcome: null };

  let maxMargin = 0;
  for (const o of affordable) {
    maxMargin = Math.max(maxMargin, client.budgetSeason1 - o.costBudget);
  }
  const normProfitDen = Math.max(1e-9, maxMargin);

  let bestScore = -Infinity;
  let bestSol: SolutionOption | null = null;
  let bestOut: ReturnType<typeof resolveClientOutcome> | null = null;

  for (const o of affordable) {
    const out = resolveClientOutcome({
      seed: `${seedBase}-1-${client.id}-${o.id}`,
      solution: o,
      visibility,
      competence,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
    });
    const margin = client.budgetSeason1 - o.costBudget;
    const repDelta = reputationDeltaHalfArcFromEffectiveness(out.messageEffectiveness);
    const visGain = visibilityGainFromReachAndClientSatisfaction(out.messageSpread, out.satisfaction);

    const normE = out.messageEffectiveness / 100;
    const normP = margin / normProfitDen;
    const normV = visGain / 10;
    const normR = repDelta / 5;
    const normS = out.satisfaction / 100;

    const score =
      W.effectiveness * normE +
      W.profit * normP +
      W.visGain * normV +
      W.reputation * normR +
      W.satisfaction * normS;

    if (score > bestScore) {
      bestScore = score;
      bestSol = o;
      bestOut = out;
    }
  }

  return { solution: bestSol, outcome: bestOut };
}

const rows: TrialRec[] = [];
for (let t = 0; t < TRIALS; t += 1) {
  const rng = mulberry32(0x46534331 ^ (t + 1) * 2654435761);
  const build = BUILDS[Math.floor(rng() * BUILDS.length)]!;
  const profileSeed = `first-scn-cal|t${t}|${build}|${(rng() * 1e9).toFixed(0)}`;
  const base = randomProfileForBuild(rng, profileSeed, build);
  const seedBase = `${profileSeed}|game`;

  const planned = plannedClientCountForSeason(SEASON, base.visibility, seedBase);
  const clientCount = Math.max(1, planned);
  const { clients } = buildSeasonClients(
    seedBase,
    SEASON,
    clientCount,
    { reputation: REP_START, visibility: base.visibility },
    []
  );
  const first = clients[0]!;
  const pick = chooseFirstScenarioSolution(
    first,
    base.eur,
    base.firmCapacity,
    base.visibility,
    base.competence,
    seedBase
  );
  if (!pick.solution || !pick.outcome) continue;

  rows.push({
    competence: base.competence,
    visibility: base.visibility,
    cScore: competenceScoreForVariance(base.competence),
    vScore: visibilityScoreForVariance(base.visibility),
    chosenSolutionId: pick.solution.id,
    effectiveness: pick.outcome.messageEffectiveness,
    spread: pick.outcome.messageSpread,
    satisfaction: pick.outcome.satisfaction,
  });
}

const compStats = summarize(rows.map((r) => r.competence));
const visStats = summarize(rows.map((r) => r.visibility));
const cScoreStats = summarize(rows.map((r) => r.cScore));
const vScoreStats = summarize(rows.map((r) => r.vScore));
const reachStats = summarize(rows.map((r) => r.spread));
const effectivenessStats = summarize(rows.map((r) => r.effectiveness));

const report = {
  meta: {
    trialsRequested: TRIALS,
    trialsCompleted: rows.length,
    season: 1,
    strategyWeights: W,
    note: "First scenario only; random build + spouse + pre-season activity + hire draws.",
  },
  scoringReference: {
    cScore: "C_score = competenceScoreForVariance(rawCompetence), piecewise-linear knots [0->3, 38.8->22, 54->48, 80->62, 90->71, 124->87, 300->96, 1000->100]",
    vScore: "V_score = visibilityScoreForVariance(rawVisibility), piecewise-linear knots [0->3, 40->22, 61.5->48, 80->62, 93->72, 127->88, 300->96, 1000->100]",
    reachVariance: "0.6*V_score + 0.35*C_score + 0.05*rand(0..100)",
    effectivenessVariance: "0.7*C_score + 0.25*disciplineScore + 0.05*rand(0..100)",
  },
  stats: {
    competence: compStats,
    visibility: visStats,
    cScore: cScoreStats,
    vScore: vScoreStats,
    scenarioReach: reachStats,
    scenarioEffectiveness: effectivenessStats,
  },
};

const resultsDir = path.resolve(process.cwd(), "scripts", "results");
fs.mkdirSync(resultsDir, { recursive: true });
const outPath = path.join(resultsDir, "first-scenario-calibration-1000.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

function line(label: string, s: ReturnType<typeof summarize>) {
  console.log(
    `${label}: min=${s.min.toFixed(2)} q1=${s.q1.toFixed(2)} median=${s.median.toFixed(2)} q3=${s.q3.toFixed(2)} max=${s.max.toFixed(2)} avg=${s.avg.toFixed(2)} sd=${s.stdDev.toFixed(2)}`
  );
}

console.log(`Trials completed: ${rows.length}/${TRIALS}`);
line("Competence", compStats);
line("Visibility", visStats);
line("C_score", cScoreStats);
line("V_score", vScoreStats);
line("Scenario reach", reachStats);
line("Scenario effectiveness", effectivenessStats);
console.log(`Saved calibration report: ${outPath}`);
