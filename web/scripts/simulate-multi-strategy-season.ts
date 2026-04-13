/**
 * 21 strategies × 10 simulations each: weighted objectives over Season 1 client queues.
 * Post-season deltas (reputation, visibility) use the same rules as choice "none" in
 * `postSeasonResults.ts` (half-arc reputation from effectiveness, visibility from satisfaction).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-multi-strategy-season.ts
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { applySpouseAtStart, STARTING_BUILD_STATS, type BuildId, type SpouseType } from "../lib/gameEconomy";
import { clampToScale, METRIC_SCALES } from "../lib/metricScales";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
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
  generateCandidates,
  getSalaryBands,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "../lib/hiring";

const REP_START = 5;
const SEASON = 1;
const SEASON_KEY = "1";
const HIRE_CAP = 2;
const SIMS_PER_STRATEGY = 10;

export type Activity = "network" | "workshop" | "none";

type AgencyStats = { eur: number; competence: number; visibility: number; firmCapacity: number };

function applyActivity(base: AgencyStats, activity: Activity): AgencyStats {
  if (activity === "network") return { ...base, visibility: base.visibility + 10 };
  if (activity === "workshop") return { ...base, competence: base.competence + 10 };
  return base;
}

function applyHire(stats: AgencyStats, c: Candidate, mode: "intern" | "full_time"): AgencyStats {
  const skill = Math.round(c.hiddenSkillScore);
  let competenceGain = 0;
  let visibilityGain = 0;
  if (mode === "intern") {
    competenceGain = 3;
    visibilityGain = 3;
  } else if (c.role === "data_analyst") {
    competenceGain = skill;
  } else if (c.role === "sales_representative") {
    visibilityGain = skill;
  } else {
    const split = splitBalancedSkill(skill, `${c.id}|split`);
    competenceGain = split.competence;
    visibilityGain = split.visibility;
  }
  return {
    eur: stats.eur - c.salary,
    competence: stats.competence + competenceGain,
    visibility: stats.visibility + visibilityGain,
    firmCapacity: stats.firmCapacity,
  };
}

type HireChoice =
  | { kind: "intern" }
  | { kind: "full_time"; role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number };

function listAffordableFullTime(eur: number): HireChoice[] {
  const out: HireChoice[] = [];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  for (const tier of tiers) {
    for (const anchor of getSalaryBands(tier).map((b) => b.anchor * 1000)) {
      if (anchor > eur) continue;
      for (const role of roles) {
        out.push({ kind: "full_time", role, tier, salary: anchor });
      }
    }
  }
  return out;
}

/** Same hire loop as randomProfile but build is fixed (for paired build analysis). */
export function randomProfileForBuild(rng: () => number, seedBase: string, buildId: BuildId): AgencyStats {
  const spouses: SpouseType[] = ["supportive", "influential", "rich", "none"];
  const sp = spouses[Math.floor(rng() * spouses.length)]!;
  const activity = (["network", "workshop", "none"] as const)[Math.floor(rng() * 3)]!;

  let stats = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[buildId], sp), activity);
  let hires = 0;
  while (hires < HIRE_CAP) {
    const canIntern = stats.eur >= 10_000;
    const ftOptions = listAffordableFullTime(stats.eur);
    const totalChoices = (canIntern ? 1 : 0) + ftOptions.length;
    if (totalChoices === 0) break;

    let pickIdx = Math.floor(rng() * totalChoices);
    let ch: HireChoice;
    if (canIntern && pickIdx === 0) {
      ch = { kind: "intern" };
    } else {
      if (canIntern) pickIdx -= 1;
      ch = ftOptions[Math.max(0, Math.min(ftOptions.length - 1, pickIdx))]!;
    }

    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    }
    const pick = cands[Math.floor(rng() * 3)]!;
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    stats = applyHire(stats, pick, mode);
    hires += 1;
  }

  return stats;
}

/** Shared spouse + pre-season activity across builds in the same paired run; hires still vary by `rng`. */
export function randomProfileForBuildWithSpouseActivity(
  rng: () => number,
  seedBase: string,
  buildId: BuildId,
  sp: SpouseType,
  activity: Activity
): AgencyStats {
  let stats = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[buildId], sp), activity);
  let hires = 0;
  while (hires < HIRE_CAP) {
    const canIntern = stats.eur >= 10_000;
    const ftOptions = listAffordableFullTime(stats.eur);
    const totalChoices = (canIntern ? 1 : 0) + ftOptions.length;
    if (totalChoices === 0) break;

    let pickIdx = Math.floor(rng() * totalChoices);
    let ch: HireChoice;
    if (canIntern && pickIdx === 0) {
      ch = { kind: "intern" };
    } else {
      if (canIntern) pickIdx -= 1;
      ch = ftOptions[Math.max(0, Math.min(ftOptions.length - 1, pickIdx))]!;
    }

    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    }
    const pick = cands[Math.floor(rng() * 3)]!;
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    stats = applyHire(stats, pick, mode);
    hires += 1;
  }

  return stats;
}

function randomProfile(rng: () => number, seedBase: string): AgencyStats {
  const builds: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
  const b = builds[Math.floor(rng() * builds.length)]!;
  const sp = (["supportive", "influential", "rich", "none"] as SpouseType[])[Math.floor(rng() * 4)]!;
  const activity = (["network", "workshop", "none"] as const)[Math.floor(rng() * 3)]!;

  let stats = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[b], sp), activity);
  let hires = 0;
  while (hires < HIRE_CAP) {
    const canIntern = stats.eur >= 10_000;
    const ftOptions = listAffordableFullTime(stats.eur);
    const totalChoices = (canIntern ? 1 : 0) + ftOptions.length;
    if (totalChoices === 0) break;

    let pickIdx = Math.floor(rng() * totalChoices);
    let ch: HireChoice;
    if (canIntern && pickIdx === 0) {
      ch = { kind: "intern" };
    } else {
      if (canIntern) pickIdx -= 1;
      ch = ftOptions[Math.max(0, Math.min(ftOptions.length - 1, pickIdx))]!;
    }

    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP_START,
        visibility: stats.visibility,
      });
    }
    const pick = cands[Math.floor(rng() * 3)]!;
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    stats = applyHire(stats, pick, mode);
    hires += 1;
  }

  return stats;
}

export type StrategyWeights = {
  id: string;
  /** Operating profit (campaign margin) */
  wProfit: number;
  /** Sum of visibility gains from client satisfaction (post-season rule) */
  wVisGain: number;
  /** Net reputation change (post-season half-arc rule) */
  wReputation: number;
  /** Mean client satisfaction % (0–100) */
  wSatisfaction: number;
};

function queueMaxTheoreticalProfit(clients: { budgetSeason1: number }[], executableByClient: SolutionOption[][]): number {
  let sum = 0;
  for (let i = 0; i < clients.length; i += 1) {
    const b1 = clients[i]!.budgetSeason1;
    let maxM = 0;
    for (const sol of executableByClient[i]!) {
      maxM = Math.max(maxM, b1 - sol.costBudget);
    }
    sum += maxM;
  }
  return Math.max(sum, 1e-9);
}

type SimResult = {
  operatingProfit: number;
  avgClientSatisfaction: number;
  endingVisibility: number;
  endingReputation: number;
  executed: number;
};

function evaluatePlan(
  clients: import("../lib/seasonClientLoop").SeasonClient[],
  startEur: number,
  startCap: number,
  agencyVisForResolve: number,
  competence: number,
  startRep: number,
  createdAt: string,
  picks: (SolutionOption | "reject")[]
): SimResult {
  let eur = startEur;
  let cap = startCap;
  /** In-season resolve uses agency visibility unchanged between clients (matches client case screen). */
  const visForResolve = agencyVisForResolve;
  let visRunning = agencyVisForResolve;
  let reputation = startRep;
  let totalMargin = 0;
  const satisfactions: number[] = [];

  for (let i = 0; i < clients.length; i += 1) {
    const client = clients[i]!;
    const choice = picks[i]!;
    const b1 = client.budgetSeason1;
    if (choice === "reject") continue;

    const outcome = resolveClientOutcome({
      seed: `${createdAt}-${SEASON_KEY}-${client.id}-${choice.id}`,
      solution: choice,
      visibility: visForResolve,
      competence,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
    });

    totalMargin += b1 - choice.costBudget;
    eur = eur + b1 - choice.costBudget;
    cap = Math.max(0, cap - choice.costCapacity);
    satisfactions.push(outcome.satisfaction);

    const repDelta = reputationDeltaHalfArcFromEffectiveness(outcome.messageEffectiveness);
    const visGain = visibilityGainFromReachAndClientSatisfaction(outcome.messageSpread, outcome.satisfaction);
    reputation = clampToScale(reputation + repDelta, METRIC_SCALES.reputation);
    visRunning = clampToScale(visRunning + visGain, METRIC_SCALES.visibility);
  }

  const executed = satisfactions.length;
  return {
    operatingProfit: totalMargin,
    avgClientSatisfaction: executed ? satisfactions.reduce((a, b) => a + b, 0) / executed : 0,
    endingVisibility: visRunning,
    endingReputation: reputation,
    executed,
  };
}

/** Max executed campaigns achievable on this queue (any strategy). */
export function maxExecutionsPossible(
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  executableByClient: SolutionOption[][]
): number {
  const n = clients.length;
  let best = 0;
  const dfs = (i: number, eur: number, cap: number, count: number) => {
    if (i >= n) {
      best = Math.max(best, count);
      return;
    }
    const b1 = clients[i]!.budgetSeason1;
    const liquid = eur + b1;
    dfs(i + 1, eur, cap, count);
    for (const sol of executableByClient[i]!) {
      if (!canAffordSolution(sol, liquid, cap)) continue;
      dfs(i + 1, eur + b1 - sol.costBudget, cap - sol.costCapacity, count + 1);
    }
  };
  dfs(0, startEur, startCap, 0);
  return best;
}

export function bestSeasonPlanForWeights(
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  agencyVis: number,
  competence: number,
  startRep: number,
  createdAt: string,
  w: StrategyWeights
): SimResult {
  const n = clients.length;
  const executableByClient = clients.map((client) =>
    buildSolutionOptionsForClient(client).filter((o) => !o.isRejectOption)
  );

  const maxExec = maxExecutionsPossible(clients, startEur, startCap, executableByClient);
  /** Never accept "decline everyone" when at least one campaign is feasible (intentionally not sabotaging KPIs). */
  const minExecRequired = maxExec > 0 ? 1 : 0;

  const queueMaxProfit = queueMaxTheoreticalProfit(clients, executableByClient);
  const nq = Math.max(n, 1);
  const maxRepBand = 5 * nq;

  type Choice = SolutionOption | "reject";
  let bestScore = -Infinity;
  let bestExec = -1;
  let bestMargin = -Infinity;
  let bestPicks: Choice[] = [];

  const dfs = (i: number, eur: number, cap: number, picks: Choice[]) => {
    if (i >= n) {
      const evalRes = evaluatePlan(clients, startEur, startCap, agencyVis, competence, startRep, createdAt, picks);
      const totalMargin = evalRes.operatingProfit;
      const executed = evalRes.executed;
      if (executed < minExecRequired) return;

      const meanSat = evalRes.avgClientSatisfaction;
      const totalVisGain = evalRes.endingVisibility - agencyVis;
      const repNet = evalRes.endingReputation - startRep;

      const normP = totalMargin / queueMaxProfit;
      const normV = totalVisGain / (10 * nq);
      const normR = repNet / maxRepBand;
      const normS = meanSat / 100;

      const score =
        w.wProfit * normP + w.wVisGain * normV + w.wReputation * normR + w.wSatisfaction * normS;

      if (
        score > bestScore ||
        (score === bestScore && executed > bestExec) ||
        (score === bestScore && executed === bestExec && totalMargin > bestMargin)
      ) {
        bestScore = score;
        bestExec = executed;
        bestMargin = totalMargin;
        bestPicks = [...picks];
      }
      return;
    }

    const client = clients[i]!;
    const b1 = client.budgetSeason1;
    const liquid = eur + b1;

    dfs(i + 1, eur, cap, [...picks, "reject"]);

    for (const solution of executableByClient[i]!) {
      if (!canAffordSolution(solution, liquid, cap)) continue;
      dfs(i + 1, eur + b1 - solution.costBudget, cap - solution.costCapacity, [...picks, solution]);
    }
  };

  dfs(0, startEur, startCap, []);

  return evaluatePlan(clients, startEur, startCap, agencyVis, competence, startRep, createdAt, bestPicks);
}

export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo);
}

function popStdDev(arr: number[], mean: number): number {
  if (arr.length === 0) return NaN;
  if (arr.length === 1) return 0;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

function statLine(name: string, values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const σ = popStdDev(values, mean);
  console.log(`  ${name}:`);
  console.log(`    avg: ${mean.toFixed(2)} · median: ${percentile(s, 0.5).toFixed(2)} · σ: ${σ.toFixed(2)}`);
  console.log(`    min: ${Math.min(...values).toFixed(2)} · max: ${Math.max(...values).toFixed(2)} · Q1: ${percentile(s, 0.25).toFixed(2)} · Q3: ${percentile(s, 0.75).toFixed(2)}`);
}

export const STRATEGIES: StrategyWeights[] = [
  { id: "max-profit", wProfit: 1, wVisGain: 0, wReputation: 0, wSatisfaction: 0 },
  { id: "max-vis-gain", wProfit: 0, wVisGain: 1, wReputation: 0, wSatisfaction: 0 },
  { id: "max-reputation", wProfit: 0, wVisGain: 0, wReputation: 1, wSatisfaction: 0 },
  { id: "max-satisfaction", wProfit: 0, wVisGain: 0, wReputation: 0, wSatisfaction: 1 },
  { id: "balanced-25", wProfit: 0.25, wVisGain: 0.25, wReputation: 0.25, wSatisfaction: 0.25 },
  { id: "skew-p-55", wProfit: 0.55, wVisGain: 0.15, wReputation: 0.15, wSatisfaction: 0.15 },
  { id: "skew-v-55", wProfit: 0.15, wVisGain: 0.55, wReputation: 0.15, wSatisfaction: 0.15 },
  { id: "skew-r-55", wProfit: 0.15, wVisGain: 0.15, wReputation: 0.55, wSatisfaction: 0.15 },
  { id: "skew-s-55", wProfit: 0.15, wVisGain: 0.15, wReputation: 0.15, wSatisfaction: 0.55 },
  { id: "skew-pv-40", wProfit: 0.4, wVisGain: 0.4, wReputation: 0.1, wSatisfaction: 0.1 },
  { id: "skew-pr-40", wProfit: 0.4, wVisGain: 0.1, wReputation: 0.4, wSatisfaction: 0.1 },
  { id: "skew-ps-40", wProfit: 0.4, wVisGain: 0.1, wReputation: 0.1, wSatisfaction: 0.4 },
  { id: "skew-vr-40", wProfit: 0.1, wVisGain: 0.4, wReputation: 0.4, wSatisfaction: 0.1 },
  { id: "skew-vs-40", wProfit: 0.1, wVisGain: 0.4, wReputation: 0.1, wSatisfaction: 0.4 },
  { id: "skew-rs-40", wProfit: 0.1, wVisGain: 0.1, wReputation: 0.4, wSatisfaction: 0.4 },
  { id: "skew-pvv-35", wProfit: 0.35, wVisGain: 0.35, wReputation: 0.2, wSatisfaction: 0.1 },
  { id: "skew-pvs-35", wProfit: 0.35, wVisGain: 0.35, wReputation: 0.1, wSatisfaction: 0.2 },
  { id: "skew-prv-35", wProfit: 0.35, wVisGain: 0.2, wReputation: 0.35, wSatisfaction: 0.1 },
  { id: "skew-prs-35", wProfit: 0.35, wVisGain: 0.2, wReputation: 0.1, wSatisfaction: 0.35 },
  { id: "skew-vrp-35", wProfit: 0.2, wVisGain: 0.35, wReputation: 0.35, wSatisfaction: 0.1 },
  { id: "skew-vsp-35", wProfit: 0.2, wVisGain: 0.35, wReputation: 0.1, wSatisfaction: 0.35 },
];

/** Avoid running the 21×10 harness when this file is imported (e.g. paired-build script). */
function isMainScript(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isMainScript()) {
console.log("Multi-strategy Season 1 simulation");
console.log(
  `Weights (profit, visGain, reputation, satisfaction) normalize: margin/queueMaxProfit, Δvis/(10n), Δrep/(5n), meanSat/100.`
);
console.log(`Post-season rule: rep from effectiveness, vis from satisfaction (no boost). ${SIMS_PER_STRATEGY} sims each.\n`);

for (let si = 0; si < STRATEGIES.length; si += 1) {
  const strat = STRATEGIES[si]!;
  const profits: number[] = [];
  const sats: number[] = [];
  const vis: number[] = [];
  const reps: number[] = [];

  for (let sim = 0; sim < SIMS_PER_STRATEGY; sim += 1) {
    const rng = mulberry32(0x4d554c54 ^ (si * 100 + sim) * 2654435761);
    const profileSeed = `mss|s${si}|sim${sim}|${(rng() * 1e9).toFixed(0)}`;
    const base = randomProfile(rng, profileSeed);
    const seedBase = `${profileSeed}|game`;

    const planned = plannedClientCountForSeason(SEASON, base.visibility, seedBase);
    const { clients } = buildSeasonClients(
      seedBase,
      SEASON,
      planned,
      { reputation: REP_START, visibility: base.visibility },
      []
    );

    const res = bestSeasonPlanForWeights(
      clients,
      base.eur,
      base.firmCapacity,
      base.visibility,
      base.competence,
      REP_START,
      seedBase,
      strat
    );

    profits.push(res.operatingProfit);
    sats.push(res.avgClientSatisfaction);
    vis.push(res.endingVisibility);
    reps.push(res.endingReputation);
  }

  console.log("=".repeat(72));
  console.log(`Strategy: ${strat.id}`);
  console.log(
    `  weights [profit, visGain, rep, sat] = [${strat.wProfit}, ${strat.wVisGain}, ${strat.wReputation}, ${strat.wSatisfaction}]`
  );
  statLine("Operating profit (EUR margin: Σ(budgetS1 − solution cost))", profits);
  statLine("Avg client satisfaction (0–100)", sats);
  statLine("Ending visibility (agency stat)", vis);
  statLine("Ending reputation", reps);
  console.log("");
}
}
