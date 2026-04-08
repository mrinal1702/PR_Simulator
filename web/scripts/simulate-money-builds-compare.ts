/**
 * Compare end-of-Season-1 bank balance (EUR) across build strategies.
 * Each playthrough: Network pre-season, solution_1 per client when affordable, else reject.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-money-builds-compare.ts
 */

import { applySpouseAtStart, STARTING_BUILD_STATS, type BuildId, type SpouseType } from "../lib/gameEconomy";
import { capacityGainFromProductivity } from "../lib/hiring";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import { buildSeasonClients, buildSolutionOptionsForClient, type SeasonClient } from "../lib/seasonClientLoop";

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}
function rand01(seed: string): number {
  return (hash32(seed) >>> 0) / 4294967295;
}
function resolveProductivity(seed: string): number {
  return Math.round(rand01(`${seed}|prod`) * 80);
}

const SEASON = 1;
const REP = 5;

type Strategy = {
  id: string;
  label: string;
  buildId: BuildId;
  spouse: SpouseType;
  hireIntern: boolean;
};

const STRATEGIES: Strategy[] = [
  {
    id: "pivot-none-net-nointern",
    label: "Portfolio Pivot · No spouse · Network · No intern (100 capacity, keep 80k)",
    buildId: "portfolio_pivot",
    spouse: "none",
    hireIntern: false,
  },
  {
    id: "pivot-none-net-intern",
    label: "Portfolio Pivot · No spouse · Network · 1 intern (high capacity, −10k)",
    buildId: "portfolio_pivot",
    spouse: "none",
    hireIntern: true,
  },
  {
    id: "basement-rich-net-intern",
    label: "Summa Cum Basement · Rich · Network · 1 intern (low cash, +20k spouse)",
    buildId: "summa_cum_basement",
    spouse: "rich",
    hireIntern: true,
  },
  {
    id: "pivot-rich-net-intern",
    label: "REFERENCE: Portfolio Pivot · Rich · Network · 1 intern (baseline)",
    buildId: "portfolio_pivot",
    spouse: "rich",
    hireIntern: true,
  },
];

function afterPreseason(s: Strategy, seedBase: string) {
  const base = applySpouseAtStart(STARTING_BUILD_STATS[s.buildId], s.spouse);
  let eur = base.eur;
  let visibility = base.visibility + 10;
  let firmCapacity = base.firmCapacity;

  if (s.hireIntern) {
    const bucketSeed = `${seedBase}|s${SEASON}|intern|10000`;
    const cand0 = `${bucketSeed}|c0`;
    const productivity = resolveProductivity(cand0);
    const capGain = capacityGainFromProductivity(productivity);
    eur -= 10_000;
    visibility += 3;
    firmCapacity += capGain;
  }

  return { eur, competence: base.competence + (s.hireIntern ? 3 : 0) + 0, visibility, firmCapacity };
}

function solution1Costs(client: SeasonClient) {
  const opts = buildSolutionOptionsForClient(client);
  const s1 = opts.find((o) => o.id === "solution_1");
  if (!s1) throw new Error("missing solution_1");
  return s1;
}

function resolveQueue(startEur: number, startCap: number, clients: SeasonClient[]) {
  let eur = startEur;
  let cap = startCap;
  let solved = 0;
  let rejected = 0;
  for (const client of clients) {
    const b1 = client.budgetSeason1;
    const sol = solution1Costs(client);
    const eurAfterCredit = eur + b1;
    if (eurAfterCredit >= sol.costBudget && cap >= sol.costCapacity) {
      eur = eurAfterCredit - sol.costBudget;
      cap -= sol.costCapacity;
      solved += 1;
    } else {
      rejected += 1;
    }
  }
  return { eurEnd: eur, solved, rejected };
}

function runStrategy(s: Strategy, seeds: string[]) {
  const ends: number[] = [];
  const slots2 = { n: 0, sum: 0 };
  const slots3 = { n: 0, sum: 0 };

  for (const seedBase of seeds) {
    const pre = afterPreseason(s, seedBase);
    const planned = plannedClientCountForSeason(SEASON, pre.visibility, seedBase);
    const { clients } = buildSeasonClients(seedBase, SEASON, planned, { reputation: REP, visibility: pre.visibility }, []);
    const { eurEnd } = resolveQueue(pre.eur, pre.firmCapacity, clients);
    ends.push(eurEnd);
    if (planned === 2) {
      slots2.n += 1;
      slots2.sum += eurEnd;
    } else {
      slots3.n += 1;
      slots3.sum += eurEnd;
    }
  }

  const avg = ends.reduce((a, b) => a + b, 0) / ends.length;
  const min = Math.min(...ends);
  const max = Math.max(...ends);
  return { ends, avg, min, max, slots2, slots3 };
}

const seeds = Array.from({ length: 10 }, (_, i) => `20260408T180000Z|bank-run-${i}`);

console.log("Season 1 · end bank balance (EUR) · 10 seeds per strategy");
console.log("Pre-season: Network (+10 visibility). Each client: solution_1 if affordable, else decline.\n");

const results: { s: Strategy; stats: ReturnType<typeof runStrategy> }[] = [];

for (const s of STRATEGIES) {
  const stats = runStrategy(s, seeds);
  results.push({ s, stats });
  console.log("— ".repeat(40));
  console.log(s.label);
  console.log(
    `  avg ${stats.avg.toFixed(0)} · min ${stats.min.toFixed(0)} · max ${stats.max.toFixed(0)} EUR | 2-slot games avg end: ${
      stats.slots2.n ? (stats.slots2.sum / stats.slots2.n).toFixed(0) : "n/a"
    } | 3-slot: ${stats.slots3.n ? (stats.slots3.sum / stats.slots3.n).toFixed(0) : "n/a"} (${stats.slots2.n}×2 / ${stats.slots3.n}×3)`
  );
}

console.log("\n" + "=".repeat(80));
const sorted = [...results].sort((a, b) => b.stats.avg - a.stats.avg);
console.log("Rank by average end bank (highest first):");
sorted.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.s.label.split("(")[0].trim()} → avg ${r.stats.avg.toFixed(0)} EUR`);
});

const ref = results.find((r) => r.s.id === "pivot-rich-net-intern");
const others = results.filter((r) => !r.s.label.startsWith("REFERENCE"));
const bestOther = others.reduce((a, b) => (a.stats.avg >= b.stats.avg ? a : b));
if (ref && bestOther.s.id !== ref.s.id) {
  const gap = bestOther.stats.avg - ref.stats.avg;
  console.log(
    `\nBest non-reference strategy (${bestOther.s.id}) vs reference: ${gap >= 0 ? "+" : ""}${gap.toFixed(0)} EUR average.`
  );
} else {
  console.log("\nReference (Pivot + Rich + intern) remains the top average in this set.");
}
