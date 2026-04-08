/**
 * Season 1 money simulation: Rich spouse + Network + 1 intern, then "worst" solution (solution_1) per client.
 * Compare Portfolio Pivot vs Velvet Rolodex across 10 seeded games.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-money-season1.ts
 */

import { applySpouseAtStart, STARTING_BUILD_STATS, type BuildId } from "../lib/gameEconomy";
import { capacityGainFromProductivity } from "../lib/hiring";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import { buildSeasonClients, buildSolutionOptionsForClient, type SeasonClient } from "../lib/seasonClientLoop";

/** Match `hiring.ts` (resolveProductivity + rand01). */
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

/** Pre-season: Network (+10 vis). Hire one intern (-10k EUR, +3/+3 vis, +capacity). */
function afterPreseason(buildId: BuildId, seedBase: string) {
  const base = applySpouseAtStart(STARTING_BUILD_STATS[buildId], "rich");
  const bucketSeed = `${seedBase}|s${SEASON}|intern|10000`;
  const cand0 = `${bucketSeed}|c0`;
  const productivity = resolveProductivity(cand0);
  const capGain = capacityGainFromProductivity(productivity);
  return {
    eur: base.eur - 10_000,
    competence: base.competence + 3,
    visibility: base.visibility + 10 + 3,
    firmCapacity: base.firmCapacity + capGain,
    internProductivity: productivity,
    internCapGain: capGain,
  };
}

function solution1NetIfUnlimited(client: SeasonClient) {
  const opts = buildSolutionOptionsForClient(client);
  const s1 = opts.find((o) => o.id === "solution_1");
  if (!s1) throw new Error("missing solution_1");
  return client.budgetSeason1 - s1.costBudget;
}

function solution1Costs(client: SeasonClient) {
  const opts = buildSolutionOptionsForClient(client);
  const s1 = opts.find((o) => o.id === "solution_1");
  if (!s1) throw new Error("missing solution_1");
  return s1;
}

/**
 * Resolve queue with worst solution when affordable after credit; otherwise reject (net 0 for that client).
 */
function resolveQueueCashAndCapacity(startEur: number, startCap: number, clients: SeasonClient[]) {
  let eur = startEur;
  let cap = startCap;
  let solved = 0;
  let rejected = 0;
  let netFromClients = 0;

  for (const client of clients) {
    const b1 = client.budgetSeason1;
    const sol = solution1Costs(client);
    const eurAfterCredit = eur + b1;
    if (eurAfterCredit >= sol.costBudget && cap >= sol.costCapacity) {
      const net = b1 - sol.costBudget;
      netFromClients += net;
      eur = eurAfterCredit - sol.costBudget;
      cap -= sol.costCapacity;
      solved += 1;
    } else {
      rejected += 1;
    }
  }

  return { eurEnd: eur, capEnd: cap, solved, rejected, netFromClients };
}

type Row = {
  seed: string;
  visibility: number;
  planned: number;
  unlimitedPipelineNet: number;
  netFromClients: number;
  eurEnd: number;
  solved: number;
  rejected: number;
};

function runBuild(buildId: BuildId, label: string) {
  const rows: Row[] = [];
  for (let i = 0; i < 10; i += 1) {
    const seedBase = `20260408T120000Z|money-run-${i}`;
    const pre = afterPreseason(buildId, seedBase);
    const vis = pre.visibility;
    const planned = plannedClientCountForSeason(SEASON, vis, seedBase);
    const { clients } = buildSeasonClients(
      seedBase,
      SEASON,
      planned,
      { reputation: REP, visibility: vis },
      []
    );

    const unlimitedPipelineNet = clients.reduce((sum, c) => sum + solution1NetIfUnlimited(c), 0);

    const resolved = resolveQueueCashAndCapacity(pre.eur, pre.firmCapacity, clients);

    rows.push({
      seed: seedBase,
      visibility: vis,
      planned,
      unlimitedPipelineNet,
      netFromClients: resolved.netFromClients,
      eurEnd: resolved.eurEnd,
      solved: resolved.solved,
      rejected: resolved.rejected,
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log(`${label} (rich + network + 1 intern; each client: solution_1 / "worst" when affordable)`);
  console.log(
    `Starting EUR after intern: ${afterPreseason(buildId, "20260408T120000Z|money-run-0").eur.toLocaleString("en-GB")} (shown for run-0 base; intern productivity varies slightly by seed)`
  );

  for (const r of rows) {
    console.log(
      `  ${r.seed.slice(-20)} | vis=${r.visibility} | slots=${r.planned} | ` +
        `unlimited Σ net=${r.unlimitedPipelineNet.toLocaleString("en-GB")} | ` +
        `actual net=${r.netFromClients.toLocaleString("en-GB")} | end EUR=${r.eurEnd.toLocaleString("en-GB")} | ` +
        `solved=${r.solved} rejected=${r.rejected}`
    );
  }

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const unlimited = rows.map((r) => r.unlimitedPipelineNet);
  const actual = rows.map((r) => r.netFromClients);
  const ends = rows.map((r) => r.eurEnd);
  const three = rows.filter((r) => r.planned === 3);
  const two = rows.filter((r) => r.planned === 2);

  console.log(`  --- averages (n=10): unlimited pipeline ${avg(unlimited).toFixed(0)} | actual client net ${avg(actual).toFixed(0)} | end EUR ${avg(ends).toFixed(0)}`);
  console.log(
    `  --- slot split: 2 clients ${two.length}/10 | 3 clients ${three.length}/10` +
      (buildId === "portfolio_pivot"
        ? ` | Pivot only: avg unlimited pipeline if 2-slot games ${two.length ? avg(two.map((r) => r.unlimitedPipelineNet)).toFixed(0) : "n/a"} | if 3-slot games ${three.length ? avg(three.map((r) => r.unlimitedPipelineNet)).toFixed(0) : "n/a"}`
        : "")
  );

  return { rows, two, three };
}

const pivot = runBuild("portfolio_pivot", "Portfolio Pivot");
runBuild("velvet_rolodex", "Velvet Rolodex");

console.log("\n" + "=".repeat(80));
console.log("PIVOT SUMMARY (answers: 3 clients + worst vs 2 clients + worst, same build)");
const p2 = pivot.two;
const p3 = pivot.three;
if (p2.length && p3.length) {
  const avg2u = p2.reduce((s, r) => s + r.unlimitedPipelineNet, 0) / p2.length;
  const avg3u = p3.reduce((s, r) => s + r.unlimitedPipelineNet, 0) / p3.length;
  const avg2a = p2.reduce((s, r) => s + r.netFromClients, 0) / p2.length;
  const avg3a = p3.reduce((s, r) => s + r.netFromClients, 0) / p3.length;
  console.log(
    `  Games with 2 slots (${p2.length}): avg unlimited Σ(b1-cost)=${avg2u.toFixed(0)} | avg actual net=${avg2a.toFixed(0)}`
  );
  console.log(
    `  Games with 3 slots (${p3.length}): avg unlimited Σ(b1-cost)=${avg3u.toFixed(0)} | avg actual net=${avg3a.toFixed(0)}`
  );
  console.log(
    `  On this sample, 3-slot games ${avg3u > avg2u ? "beat" : "trail"} 2-slot on average unlimited pipeline net.`
  );
} else {
  console.log("  Not enough mix of 2- and 3-slot games in these 10 seeds to split Pivot averages; see per-run rows.");
}
