/**
 * 100 random agency profiles × 10 games each; Season 1 clients solved by **globally** optimizing
 * the whole queue: among all feasible sequences of (reject | solution_1..4) per client, maximize
 * total Σ(0.5×reach + 0.5×effectiveness) on executed solutions; ties → more executions, then higher sum.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-optimal-solution-outcomes.ts
 */

import { applySpouseAtStart, STARTING_BUILD_STATS, type BuildId, type SpouseType } from "../lib/gameEconomy";
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
  generateCandidates,
  getSalaryBands,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "../lib/hiring";

const REP = 5;
const SEASON = 1;
const SEASON_KEY = "1";
const HIRE_CAP = 2;

type Activity = "network" | "workshop" | "none";

type Stats = { eur: number; competence: number; visibility: number; firmCapacity: number };

function applyActivity(base: Stats, activity: Activity): Stats {
  if (activity === "network") return { ...base, visibility: base.visibility + 10 };
  if (activity === "workshop") return { ...base, competence: base.competence + 10 };
  return base;
}

function applyHire(stats: Stats, c: Candidate, mode: "intern" | "full_time"): Stats {
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

function randomProfile(
  rng: () => number,
  seedBase: string
): { stats: Stats; label: string } {
  const builds: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
  const spouses: SpouseType[] = ["supportive", "influential", "rich", "none"];
  const b = builds[Math.floor(rng() * builds.length)]!;
  const sp = spouses[Math.floor(rng() * spouses.length)]!;
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
        reputation: REP,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP,
        visibility: stats.visibility,
      });
    }
    const pick = cands[Math.floor(rng() * 3)]!;
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    stats = applyHire(stats, pick, mode);
    hires += 1;
  }

  return { stats, label: `${b}|${sp}|${activity}` };
}

function mulberry32(a: number) {
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

/** Population σ: sqrt(mean of squared deviations). */
function populationStdDev(arr: number[], mean: number): number {
  if (arr.length === 0) return NaN;
  if (arr.length === 1) return 0;
  const v = arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function comboScore(o: { messageSpread: number; messageEffectiveness: number }): number {
  return 0.5 * o.messageSpread + 0.5 * o.messageEffectiveness;
}

type OutRec = { spread: number; eff: number };

function bestSeasonPlan(
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  visibility: number,
  competence: number,
  createdAt: string
): { outcomes: OutRec[]; slotRejects: number } {
  const n = clients.length;
  const executableByClient = clients.map((client) =>
    buildSolutionOptionsForClient(client).filter((o) => !o.isRejectOption)
  );

  let bestScore = -Infinity;
  let bestExec = -1;
  let bestRawSum = -Infinity;
  let bestOutcomes: OutRec[] = [];

  const dfs = (
    i: number,
    eur: number,
    cap: number,
    accScore: number,
    execCount: number,
    rawSum: number,
    outs: OutRec[]
  ) => {
    if (i >= n) {
      if (
        accScore > bestScore ||
        (accScore === bestScore && execCount > bestExec) ||
        (accScore === bestScore && execCount === bestExec && rawSum > bestRawSum)
      ) {
        bestScore = accScore;
        bestExec = execCount;
        bestRawSum = rawSum;
        bestOutcomes = [...outs];
      }
      return;
    }

    const client = clients[i]!;
    const b1 = client.budgetSeason1;
    const liquid = eur + b1;

    // Reject (decline): no outcome contribution
    dfs(i + 1, eur, cap, accScore, execCount, rawSum, outs);

    for (const solution of executableByClient[i]!) {
      if (!canAffordSolution(solution, liquid, cap)) continue;
      const seed = `${createdAt}-${SEASON_KEY}-${client.id}-${solution.id}`;
      const outcome = resolveClientOutcome({
        seed,
        solution,
        visibility,
        competence,
        discipline: client.hiddenDiscipline,
        satisfactionReachWeight: getSatisfactionReachWeight(client),
      });
      const sc = comboScore(outcome);
      const rs = outcome.messageSpread + outcome.messageEffectiveness;
      dfs(
        i + 1,
        eur + b1 - solution.costBudget,
        cap - solution.costCapacity,
        accScore + sc,
        execCount + 1,
        rawSum + rs,
        [...outs, { spread: outcome.messageSpread, eff: outcome.messageEffectiveness }]
      );
    }
  };

  dfs(0, startEur, startCap, 0, 0, 0, []);

  return {
    outcomes: bestOutcomes,
    slotRejects: n - bestOutcomes.length,
  };
}

const PROFILES = 100;
const GAMES_PER_PROFILE = 10;

const reachSamples: number[] = [];
const effSamples: number[] = [];
let totalClientSlots = 0;
let executedSolutions = 0;
let slotPassCount = 0;

const rngMaster = mulberry32(0x20260409);

for (let p = 0; p < PROFILES; p += 1) {
  const profileRng = mulberry32((rngMaster() * 0xffffffff) >>> 0);
  const profileSeed = `prof-${p}|${(profileRng() * 1e9).toFixed(0)}`;
  const { stats: baseStats } = randomProfile(profileRng, profileSeed);

  for (let g = 0; g < GAMES_PER_PROFILE; g += 1) {
    const seedBase = `${profileSeed}|g${g}`;
    const createdAt = seedBase;

    const startEur = baseStats.eur;
    const startCap = baseStats.firmCapacity;
    const visibility = baseStats.visibility;
    const competence = baseStats.competence;

    const planned = plannedClientCountForSeason(SEASON, visibility, seedBase);
    const { clients } = buildSeasonClients(
      seedBase,
      SEASON,
      planned,
      { reputation: REP, visibility },
      []
    );

    totalClientSlots += clients.length;

    const plan = bestSeasonPlan(clients, startEur, startCap, visibility, competence, createdAt);
    executedSolutions += plan.outcomes.length;
    slotPassCount += plan.slotRejects;

    for (const o of plan.outcomes) {
      reachSamples.push(o.spread);
      effSamples.push(o.eff);
    }
  }
}

function summarize(name: string, arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
  const stdev = populationStdDev(arr, mean);
  console.log(`${name} (0–100 scores from resolveClientOutcome / computeSeason1SolutionMetrics):`);
  console.log(`  mean:        ${mean.toFixed(2)}`);
  console.log(`  stdev (σ):   ${Number.isFinite(stdev) ? stdev.toFixed(2) : "n/a"}`);
  console.log(`  median:      ${percentile(s, 0.5).toFixed(2)}`);
  console.log(`  Q1:          ${percentile(s, 0.25).toFixed(2)}`);
  console.log(`  Q3:          ${percentile(s, 0.75).toFixed(2)}`);
}

console.log("Optimal-play simulation (100 random profiles × 10 games = 1000 games)");
console.log(
  `Per season: globally maximize total Σ(0.5×reach + 0.5×effectiveness) over the client queue; ties favor more executions.`
);
console.log(
  `Client slots: ${totalClientSlots} · Executed solutions: ${executedSolutions} · Slots passed/declined: ${slotPassCount}\n`
);

summarize("Reach (message spread %)", reachSamples);
console.log("");
summarize("Effectiveness (message effectiveness %)", effSamples);
