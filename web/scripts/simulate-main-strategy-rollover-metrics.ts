/**
 * Main reasonable strategy (see strategies/main-reasonable-strategy.json) through Season 2 entry,
 * then resolve all Season 1 → Season 2 rollover scenarios in queue order.
 * Per rollover: greedy pick maximizing 0.5 * reach + 0.5 * effectiveness on the resolved outcome
 * (per rollover: greedy max of 0.5 * resolved reach + 0.5 * resolved effectiveness among affordable options).
 *
 * Reports distribution stats for firmCapacity, cash (resources.eur), raw competence, and raw visibility
 * AFTER rollovers complete.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-main-strategy-rollover-metrics.ts
 */

import fs from "node:fs";
import path from "node:path";
import type { NewGamePayload } from "../components/NewGameWizard";
import {
  applySpouseAtStart,
  STARTING_BUILD_STATS,
  STARTING_REPUTATION,
  type BuildId,
  type SpouseType,
} from "../lib/gameEconomy";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import {
  buildCarryoverSolutionOptionsForClient,
  buildSeasonClients,
  buildSolutionOptionsForClient,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SeasonClient,
  type SeasonLoopState,
  type SolutionOption,
} from "../lib/seasonClientLoop";
import { applyPostSeasonChoice } from "../lib/postSeasonResults";
import {
  capacityGainFromProductivity,
  generateCandidates,
  getHireCapForSeason,
  getSalaryBands,
  roleLabel,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "../lib/hiring";
import { wageLineId, settlePreseasonAndEnterSeason } from "../lib/payablesReceivables";
import { enterNextPreseason } from "../lib/preseasonTransition";
import { getPreseasonFocusDeltaForSeason, type PreseasonFocusId } from "../lib/preseasonFocus";
import { applySeason2CarryoverChoice, getSeasonCarryoverEntries } from "../lib/seasonCarryover";
import { mulberry32, maxExecutionsPossible } from "./simulate-multi-strategy-season";

const TOTAL = 200;
const REP_START = 5;
const SEASON = 1;
const S1 = "1";

const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const SPOUSES: SpouseType[] = ["supportive", "influential", "rich", "none"];

type Activity = "network" | "workshop" | "none";
type Choice = SolutionOption | "reject";

function listAffordableFullTime(eur: number): Array<{ role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }> {
  const out: Array<{ role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }> = [];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  for (const tier of tiers) {
    for (const anchor of getSalaryBands(tier).map((b) => b.anchor * 1000)) {
      if (anchor > eur) continue;
      for (const role of roles) out.push({ role, tier, salary: anchor });
    }
  }
  return out;
}

function finalizeHire(
  save: NewGamePayload,
  seasonKey: string,
  mode: "intern" | "full_time",
  role: HiringRole,
  tier: HiringTier,
  salary: number,
  candidate: Candidate
): NewGamePayload {
  const hired = save.hiresBySeason?.[seasonKey] ?? 0;
  const skill = Math.round(candidate.hiddenSkillScore);
  const prod = Math.round(candidate.hiddenProductivityPct);
  const capGain = capacityGainFromProductivity(prod);
  let competenceGain = 0;
  let visibilityGain = 0;
  if (mode === "intern") {
    competenceGain = 3;
    visibilityGain = 3;
  } else if (role === "data_analyst") {
    competenceGain = skill;
  } else if (role === "sales_representative") {
    visibilityGain = skill;
  } else {
    const split = splitBalancedSkill(skill, `${candidate.id}|${seasonKey}`);
    competenceGain = split.competence;
    visibilityGain = split.visibility;
  }
  const empId = `${candidate.id}-${seasonKey}-${hired + 1}`;
  return {
    ...save,
    resources: {
      ...save.resources,
      competence: save.resources.competence + competenceGain,
      visibility: save.resources.visibility + visibilityGain,
      firmCapacity: save.resources.firmCapacity + capGain,
    },
    payablesLines: [...(save.payablesLines ?? []), { id: wageLineId(empId), label: `${candidate.name} wage`, amount: candidate.salary }],
    hiresBySeason: { ...(save.hiresBySeason ?? {}), [seasonKey]: hired + 1 },
    employees: [
      ...(save.employees ?? []),
      {
        id: empId,
        name: candidate.name,
        role: mode === "intern" ? "Intern" : roleLabel(role),
        salary,
        seasonHired: Number(seasonKey),
        competenceGain,
        visibilityGain,
        capacityGain: capGain,
        ...(mode === "full_time" ? { productivityPct: prod, tenureCapacityBonus: 0 } : {}),
      },
    ],
  };
}

function applyActivity(resources: NewGamePayload["resources"], activity: Activity): NewGamePayload["resources"] {
  if (activity === "network") return { ...resources, visibility: resources.visibility + 10 };
  if (activity === "workshop") return { ...resources, competence: resources.competence + 10 };
  return resources;
}

function runHiringRandom(save: NewGamePayload, rng: () => number, seedBase: string): NewGamePayload {
  let s = save;
  const cap = getHireCapForSeason(1);
  while ((s.hiresBySeason?.["1"] ?? 0) < cap) {
    const canIntern = s.resources.eur >= 10_000;
    const ft = listAffordableFullTime(s.resources.eur);
    const total = (canIntern ? 1 : 0) + ft.length;
    if (total === 0) break;
    let idx = Math.floor(rng() * total);
    if (canIntern && idx === 0) {
      const cands = generateCandidates({
        seedBase: `${seedBase}|h${s.hiresBySeason?.["1"] ?? 0}`,
        season: 1,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: s.reputation ?? REP_START,
        visibility: s.resources.visibility,
      });
      const ci = cands[Math.floor(rng() * Math.max(1, cands.length))];
      if (!ci) break;
      s = finalizeHire(s, "1", "intern", "campaign_manager", "intern", 10_000, ci);
    } else {
      if (canIntern) idx -= 1;
      const pick = ft[Math.max(0, Math.min(ft.length - 1, idx))]!;
      const cands = generateCandidates({
        seedBase: `${seedBase}|h${s.hiresBySeason?.["1"] ?? 0}|ft`,
        season: 1,
        role: pick.role,
        tier: pick.tier,
        salary: pick.salary,
        reputation: s.reputation ?? REP_START,
        visibility: s.resources.visibility,
      });
      const cf = cands[Math.floor(rng() * Math.max(1, cands.length))];
      if (!cf) break;
      s = finalizeHire(s, "1", "full_time", pick.role, pick.tier, pick.salary, cf);
    }
  }
  return s;
}

function applyPreseasonFocus(save: NewGamePayload, season: number, focus: PreseasonFocusId): NewGamePayload {
  const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
  return {
    ...save,
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: { ...(save.preseasonActionBySeason ?? {}), [String(season)]: focus },
    preseasonFocusCounts: {
      strategy_workshop: (save.preseasonFocusCounts?.strategy_workshop ?? 0) + (focus === "strategy_workshop" ? 1 : 0),
      network: (save.preseasonFocusCounts?.network ?? 0) + (focus === "network" ? 1 : 0),
    },
    resources:
      focus === "strategy_workshop"
        ? { ...save.resources, competence: save.resources.competence + delta }
        : { ...save.resources, visibility: save.resources.visibility + delta },
  };
}

function saveAfterSeason1PostseasonNone(
  saveBase: NewGamePayload,
  clients: SeasonClient[],
  picks: Choice[],
  vis0: number,
  comp0: number,
  createdAt: string
): NewGamePayload {
  let s = structuredClone(saveBase);
  let eur = s.resources.eur;
  let cap = s.resources.firmCapacity;
  const runs: SeasonLoopState["runs"] = [];
  for (let i = 0; i < clients.length; i += 1) {
    const c = clients[i]!;
    const ch = picks[i]!;
    if (ch === "reject") {
      runs.push({ clientId: c.id, accepted: false, solutionId: "reject" });
      continue;
    }
    const outcome = resolveClientOutcome({
      seed: `${createdAt}-${S1}-${c.id}-${ch.id}`,
      solution: ch,
      visibility: vis0,
      competence: comp0,
      discipline: c.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(c),
      outcomeScoreSeason: 1,
    });
    eur = eur + c.budgetSeason1 - ch.costBudget;
    cap = Math.max(0, cap - ch.costCapacity);
    runs.push({
      clientId: c.id,
      accepted: true,
      solutionId: ch.id,
      outcome,
      costBudget: ch.costBudget,
      costCapacity: ch.costCapacity,
      solutionTitle: ch.title,
    });
  }
  s = {
    ...s,
    phase: "season",
    seasonNumber: 1,
    resources: { ...s.resources, eur, firmCapacity: cap },
    seasonLoopBySeason: {
      [S1]: { plannedClientCount: clients.length, currentClientIndex: clients.length, clientsQueue: clients, runs },
    },
  };
  for (const r of s.seasonLoopBySeason![S1]!.runs) {
    if (!r.accepted || r.solutionId === "reject" || !r.outcome) continue;
    const next = applyPostSeasonChoice(s, S1, r.clientId, "none", SEASON);
    if (next) s = next;
  }
  return s;
}

function dfsMaxProfitPicks(clients: SeasonClient[], startEur: number, startCap: number): Choice[] {
  const n = clients.length;
  const options = clients.map((c) => buildSolutionOptionsForClient(c).filter((o) => !o.isRejectOption));
  const maxExec = maxExecutionsPossible(clients, startEur, startCap, options);
  const needOne = maxExec > 0;
  let bestProfit = -Infinity;
  let bestExec = -1;
  let bestPicks: Choice[] = [];
  const dfs = (i: number, eur: number, cap: number, picks: Choice[]) => {
    if (i >= n) {
      let p = 0;
      let exec = 0;
      for (let j = 0; j < n; j += 1) {
        const ch = picks[j]!;
        if (ch === "reject") continue;
        exec += 1;
        p += clients[j]!.budgetSeason1 - ch.costBudget;
      }
      if (needOne && exec === 0) return;
      if (p > bestProfit || (p === bestProfit && exec > bestExec)) {
        bestProfit = p;
        bestExec = exec;
        bestPicks = [...picks];
      }
      return;
    }
    const b1 = clients[i]!.budgetSeason1;
    const liq = eur + b1;
    dfs(i + 1, eur, cap, [...picks, "reject"]);
    for (const solution of options[i]!) {
      if (!canAffordSolution(solution, liq, cap)) continue;
      dfs(i + 1, eur + b1 - solution.costBudget, cap - solution.costCapacity, [...picks, solution]);
    }
  };
  dfs(0, startEur, startCap, []);
  return bestPicks;
}

function saveAtSeason2Entry(
  saveIn: NewGamePayload,
  clients: SeasonClient[],
  picks: Choice[],
  vis0: number,
  comp0: number,
  createdAt: string,
  focus2: PreseasonFocusId
): NewGamePayload {
  let s = saveAfterSeason1PostseasonNone(saveIn, clients, picks, vis0, comp0, createdAt);
  s = { ...s, phase: "postseason", seasonNumber: 1 };
  s = enterNextPreseason(s, 1);
  s = applyPreseasonFocus(s, 2, focus2);
  return settlePreseasonAndEnterSeason(s, "2");
}

function applyRolloverGreedy(save: NewGamePayload, createdAt: string): NewGamePayload {
  let s = save;
  const entries = getSeasonCarryoverEntries(s, 2);
  for (let i = 0; i < entries.length; i += 1) {
    const clientId = entries[i]!.client.id;
    const opts = buildCarryoverSolutionOptionsForClient(entries[i]!.client);
    let best: NewGamePayload | null = null;
    let bestScore = -Infinity;
    for (const opt of opts) {
      const seed = `${createdAt}-2-carry-${clientId}-${opt.id}-${i}`;
      const trial = structuredClone(s);
      const next = applySeason2CarryoverChoice(trial, 2, clientId, opt, seed);
      if (!next) continue;
      const res = next.seasonLoopBySeason?.["1"]?.runs.find((r) => r.clientId === clientId)?.season2CarryoverResolution;
      if (!res) continue;
      const sc = 0.5 * res.messageSpread + 0.5 * res.messageEffectiveness;
      if (sc > bestScore) {
        bestScore = sc;
        best = next;
      }
    }
    if (best) s = best;
  }
  return s;
}

function summarize(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.length <= 1 ? 0 : values.reduce((acc, x) => acc + (x - avg) ** 2, 0) / values.length;
  const pct = (p: number) => {
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo]!;
    return s[lo]! * (hi - idx) + s[hi]! * (idx - lo);
  };
  return { min: s[0]!, q1: pct(0.25), median: pct(0.5), q3: pct(0.75), max: s[s.length - 1]!, avg, stdDev: Math.sqrt(variance) };
}

function runOne(runIndex: number): {
  firmCapacity: number;
  cashEur: number;
  rawCompetence: number;
  rawVisibility: number;
  rolloverCount: number;
} | null {
  const rng = mulberry32(0x52455032 ^ (runIndex + 1) * 2654435761);
  const build = BUILDS[Math.floor(rng() * BUILDS.length)]!;
  const spouse = SPOUSES[Math.floor(rng() * SPOUSES.length)]!;
  const activity = (["network", "workshop", "none"] as const)[Math.floor(rng() * 3)]!;
  const focus2: PreseasonFocusId = runIndex % 2 === 0 ? "strategy_workshop" : "network";

  const createdAt = new Date(Date.UTC(2026, 5, 1, 10, 0, runIndex)).toISOString();
  const playerName = `MainStrat-${runIndex}`;
  const seedBase = `${createdAt}|${playerName}`;

  let resources = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[build], spouse), activity);

  let save: NewGamePayload = {
    playerName,
    agencyName: `Agency-${runIndex}`,
    gender: "non_binary",
    buildId: build,
    spouseType: spouse,
    spouseGender: "non_binary",
    spouseName: "Pat",
    seasonNumber: 1,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    preseasonActionBySeason: {},
    preseasonFocusCounts: { strategy_workshop: 0, network: 0 },
    reputation: STARTING_REPUTATION,
    resources,
    initialResources: { ...resources },
    initialReputation: STARTING_REPUTATION,
    hiresBySeason: {},
    employees: [],
    usedScenarioIds: [],
    payablesLines: [],
    preseasonEntrySpouseGrantSeasons: [],
    createdAt,
  };

  save = runHiringRandom(save, rng, seedBase);

  let clients: SeasonClient[];
  try {
    const planned = Math.max(1, plannedClientCountForSeason(1, save.resources.visibility, seedBase));
    const built = buildSeasonClients(seedBase, 1, planned, { reputation: save.reputation ?? REP_START, visibility: save.resources.visibility }, save.usedScenarioIds ?? []);
    clients = built.clients;
    save = { ...save, usedScenarioIds: built.usedScenarioIds };
  } catch {
    return null;
  }

  const vis0 = save.resources.visibility;
  const comp0 = save.resources.competence;
  const picks = dfsMaxProfitPicks(clients, save.resources.eur, save.resources.firmCapacity);

  save = saveAtSeason2Entry(save, clients, picks, vis0, comp0, createdAt, focus2);
  const nRollover = getSeasonCarryoverEntries(save, 2).length;
  save = applyRolloverGreedy(save, createdAt);

  return {
    firmCapacity: save.resources.firmCapacity,
    cashEur: save.resources.eur,
    rawCompetence: save.resources.competence,
    rawVisibility: save.resources.visibility,
    rolloverCount: nRollover,
  };
}

function main() {
  const caps: number[] = [];
  const cash: number[] = [];
  const comps: number[] = [];
  const vis: number[] = [];

  for (let i = 0; i < TOTAL; i += 1) {
    const r = runOne(i);
    if (!r) continue;
    caps.push(r.firmCapacity);
    cash.push(r.cashEur);
    comps.push(r.rawCompetence);
    vis.push(r.rawVisibility);
  }

  const capStats = summarize(caps);
  const cashStats = summarize(cash);
  const compStats = summarize(comps);
  const visStats = summarize(vis);

  const report = {
    meta: {
      strategyRef: "scripts/strategies/main-reasonable-strategy.json",
      games: caps.length,
      pipeline:
        "Same as main reasonable strategy through settlePreseasonAndEnterSeason('2'). Then each Season 1 rollover scenario resolved in queue order; per client pick carry-over option that maximizes 0.5*reach+0.5*effectiveness among affordable options (applySeason2CarryoverChoice).",
      snapshot:
        "resources.firmCapacity, resources.eur, resources.competence, resources.visibility immediately after all rollover resolutions (phase=season, seasonNumber=2).",
    },
    firmCapacityAfterRollovers: capStats,
    cashEurAfterRollovers: cashStats,
    rawCompetenceAfterRollovers: compStats,
    rawVisibilityAfterRollovers: visStats,
  };

  const outPath = path.join(process.cwd(), "scripts", "results", "main-strategy-rollover-capacity-cash.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Main reasonable strategy + greedy rollover resolution (${caps.length} games).\n`);
  console.log(`Firm capacity (after rollovers):`);
  console.log(
    `  min=${capStats.min.toFixed(2)} q1=${capStats.q1.toFixed(2)} median=${capStats.median.toFixed(2)} q3=${capStats.q3.toFixed(2)} max=${capStats.max.toFixed(2)} avg=${capStats.avg.toFixed(2)} sd=${capStats.stdDev.toFixed(2)}`
  );
  console.log(`\nCash EUR (after rollovers):`);
  console.log(
    `  min=${cashStats.min.toFixed(2)} q1=${cashStats.q1.toFixed(2)} median=${cashStats.median.toFixed(2)} q3=${cashStats.q3.toFixed(2)} max=${cashStats.max.toFixed(2)} avg=${cashStats.avg.toFixed(2)} sd=${cashStats.stdDev.toFixed(2)}`
  );
  console.log(`\nRaw competence (after rollovers):`);
  console.log(
    `  min=${compStats.min.toFixed(2)} q1=${compStats.q1.toFixed(2)} median=${compStats.median.toFixed(2)} q3=${compStats.q3.toFixed(2)} max=${compStats.max.toFixed(2)} avg=${compStats.avg.toFixed(2)} sd=${compStats.stdDev.toFixed(2)}`
  );
  console.log(`\nRaw visibility (after rollovers):`);
  console.log(
    `  min=${visStats.min.toFixed(2)} q1=${visStats.q1.toFixed(2)} median=${visStats.median.toFixed(2)} q3=${visStats.q3.toFixed(2)} max=${visStats.max.toFixed(2)} avg=${visStats.avg.toFixed(2)} sd=${visStats.stdDev.toFixed(2)}`
  );
  console.log(`\nSaved: ${outPath}`);
}

main();
