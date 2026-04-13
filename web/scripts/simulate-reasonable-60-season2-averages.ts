/**
 * 60-game benchmark using a reasonable multi-KPI strategy:
 * - 3 builds x 4 spouses x 5 runs each = 60
 * - Plays through end of Season 2 post-season
 * - Stops before entering pre-season 3 ("shopping center")
 *
 * Reports overall averages for:
 * - operating profit (end of Season 2 flashcard definition)
 * - profit margin %
 * - reputation gain vs start
 * - average solution reach/effectiveness/satisfaction
 * - plus a few supporting KPIs
 *
 * Run:
 * npx tsx --tsconfig tsconfig.json scripts/simulate-reasonable-60-season2-averages.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NewGamePayload } from "../components/NewGameWizard";
import { auditAgencyCoreStatTallies } from "../lib/agencyStatAudit";
import { fireEmployeeForPayrollShortfall } from "../lib/employeeActions";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import { computeAgencyProfitFlashcardEndOfSeason2 } from "../lib/seasonFinancials";
import {
  applySpouseAtStart,
  STARTING_BUILD_STATS,
  STARTING_REPUTATION,
  type BuildId,
  type SpouseType,
} from "../lib/gameEconomy";
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
import { METRIC_SCALES, clampToScale } from "../lib/metricScales";
import { settlePreseasonAndEnterSeason, liquidityEur, wageLineId, type PayableLine } from "../lib/payablesReceivables";
import { applyPostSeasonChoice } from "../lib/postSeasonResults";
import { getPreseasonFocusDeltaForSeason, type PreseasonFocusId } from "../lib/preseasonFocus";
import { enterNextPreseason } from "../lib/preseasonTransition";
import { computeSeasonCashFlow } from "../lib/seasonFinancials";
import {
  applySeasonCloseCarryoverStatGains,
  applySeason2CarryoverChoice,
  getPostSeasonResolutionEntries,
  getSeasonCarryoverEntries,
} from "../lib/seasonCarryover";
import {
  buildCarryoverSolutionOptionsForClient,
  buildSeasonClients,
  buildSolutionOptionsForClient,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SeasonClient,
  type SeasonClientRun,
  type SolutionOption,
} from "../lib/seasonClientLoop";

type Choice = SolutionOption | "reject";

type KpiWeights = {
  reputation: number;
  operatingProfit: number;
  clientSatisfaction: number;
  rawCompetence: number;
  rawVisibility: number;
  rawCapacity: number;
  rawCash: number;
};

type StrategyVariantMeta = {
  boostedKpi: keyof KpiWeights;
  boostAmount: number;
};

type MetricSummary = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  stdDev: number;
};

type FinalRunMetrics = {
  build: BuildId;
  spouse: SpouseType;
  runIndex: number;
  operatingProfitEur: number;
  profitMarginPct: number;
  reputationGain: number;
  avgSolutionReach: number;
  avgSolutionEffectiveness: number;
  avgSolutionSatisfaction: number;
  resolvedOutcomesCount: number;
  rawCompetence: number;
  rawVisibility: number;
  reputation: number;
  cashEur: number;
  liquidityEur: number;
};

const RUNS_PER_COMBO = 5;
const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const SPOUSES: SpouseType[] = ["supportive", "influential", "rich", "none"];
const FOCUS_OPTIONS: PreseasonFocusId[] = ["strategy_workshop", "network"];
const RESULTS_FILE = "reasonable-60-season2-averages.json";

function main() {
  const framework = loadKpiFramework();
  const allFinals: FinalRunMetrics[] = [];

  for (const build of BUILDS) {
    for (const spouse of SPOUSES) {
      for (let runIndex = 0; runIndex < RUNS_PER_COMBO; runIndex += 1) {
        const seedLabel = `${build}|${spouse}|${runIndex}`;
        const variant = buildVariantWeights(framework.baseline, framework.boostMin, framework.boostMax, seedLabel);
        const finalSave = runFullTwoSeasonSimulation(build, spouse, runIndex, variant.weights);
        const metrics = collectFinalMetrics(finalSave, build, spouse, runIndex);
        allFinals.push(metrics);
      }
    }
  }

  const output = {
    meta: {
      runsPerCombo: RUNS_PER_COMBO,
      combinations: BUILDS.length * SPOUSES.length,
      totalRuns: RUNS_PER_COMBO * BUILDS.length * SPOUSES.length,
      strategyFrameworkRef: "scripts/strategies/test-bot-kpi-framework.json",
      checkpoint: "End of Season 2 post-season; before entering pre-season 3",
      notes: [
        "Reasonable strategy with per-run small KPI perturbation.",
        "Averages include all 60 runs combined.",
        "Solution metrics aggregate accepted fresh outcomes (S1+S2) plus resolved Season 2 carryovers.",
      ],
    },
    averagesOverall: {
      operatingProfitEur: summarize(allFinals.map((m) => m.operatingProfitEur)),
      profitMarginPct: summarize(allFinals.map((m) => m.profitMarginPct)),
      reputationGain: summarize(allFinals.map((m) => m.reputationGain)),
      avgSolutionReach: summarize(allFinals.map((m) => m.avgSolutionReach)),
      avgSolutionEffectiveness: summarize(allFinals.map((m) => m.avgSolutionEffectiveness)),
      avgSolutionSatisfaction: summarize(allFinals.map((m) => m.avgSolutionSatisfaction)),
      resolvedOutcomesCount: summarize(allFinals.map((m) => m.resolvedOutcomesCount)),
      rawCompetence: summarize(allFinals.map((m) => m.rawCompetence)),
      rawVisibility: summarize(allFinals.map((m) => m.rawVisibility)),
      reputation: summarize(allFinals.map((m) => m.reputation)),
      cashEur: summarize(allFinals.map((m) => m.cashEur)),
      liquidityEur: summarize(allFinals.map((m) => m.liquidityEur)),
    },
    rawRuns: allFinals,
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "results", RESULTS_FILE);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const overall = output.averagesOverall;
  console.log(`Saved 60-run report to ${outPath}`);
  console.log("");
  console.log(`Games played: ${allFinals.length}`);
  console.log(`Average operating profit EUR: ${overall.operatingProfitEur.mean.toFixed(2)}`);
  console.log(`Average profit margin %: ${overall.profitMarginPct.mean.toFixed(2)}`);
  console.log(`Average reputation gain: ${overall.reputationGain.mean.toFixed(2)}`);
  console.log(`Average solution reach: ${overall.avgSolutionReach.mean.toFixed(2)}`);
  console.log(`Average solution effectiveness: ${overall.avgSolutionEffectiveness.mean.toFixed(2)}`);
  console.log(`Average solution satisfaction: ${overall.avgSolutionSatisfaction.mean.toFixed(2)}`);
}

function loadKpiFramework(): { baseline: KpiWeights; boostMin: number; boostMax: number } {
  const fileUrl = new URL("./strategies/test-bot-kpi-framework.json", import.meta.url);
  const raw = fs.readFileSync(fileURLToPath(fileUrl), "utf8");
  const json = JSON.parse(raw) as {
    perKpiWeights: Record<string, number>;
    variantGeneration?: { suggestedBoostRange?: { min?: number; max?: number } };
  };

  const baseline: KpiWeights = {
    reputation: json.perKpiWeights.reputation ?? 0,
    operatingProfit: json.perKpiWeights.operating_profit ?? 0,
    clientSatisfaction: json.perKpiWeights.client_satisfaction ?? 0,
    rawCompetence: json.perKpiWeights.raw_competence ?? 0,
    rawVisibility: json.perKpiWeights.raw_visibility ?? 0,
    rawCapacity: json.perKpiWeights.raw_capacity ?? 0,
    rawCash: json.perKpiWeights.raw_cash ?? 0,
  };

  return {
    baseline,
    boostMin: json.variantGeneration?.suggestedBoostRange?.min ?? 0.02,
    boostMax: json.variantGeneration?.suggestedBoostRange?.max ?? 0.06,
  };
}

function buildVariantWeights(
  baseline: KpiWeights,
  boostMin: number,
  boostMax: number,
  seedLabel: string
): { weights: KpiWeights; meta: StrategyVariantMeta } {
  const keys = Object.keys(baseline) as Array<keyof KpiWeights>;
  const rng = mulberry32(hash32(seedLabel));
  const boostedKpi = keys[Math.floor(rng() * keys.length)]!;
  const boostAmount = boostMin + rng() * (boostMax - boostMin);
  const baseBoosted = baseline[boostedKpi];
  const otherTotal = 1 - baseBoosted;

  const next = {} as KpiWeights;
  for (const key of keys) {
    if (key === boostedKpi) {
      next[key] = baseline[key] + boostAmount;
      continue;
    }
    const share = otherTotal > 0 ? baseline[key] / otherTotal : 0;
    next[key] = Math.max(0.0001, baseline[key] - boostAmount * share);
  }

  const sum = keys.reduce((acc, key) => acc + next[key], 0);
  for (const key of keys) {
    next[key] /= sum;
  }

  return { weights: next, meta: { boostedKpi, boostAmount } };
}

function runFullTwoSeasonSimulation(
  build: BuildId,
  spouse: SpouseType,
  runIndex: number,
  weights: KpiWeights
): NewGamePayload {
  const createdAt = new Date(Date.UTC(2026, 3, 12, 12, 0, runIndex)).toISOString();
  const seedBase = `${createdAt}|${build}|${spouse}|${runIndex}`;

  let save = createNewSave(build, spouse, createdAt, runIndex);

  save = playPreseason(save, 1, weights, `${seedBase}|pre1`);
  save = settlePreseasonAndEnterSeason(save, "1");

  save = playSeason(save, 1, weights, `${seedBase}|s1`);
  save = { ...save, phase: "postseason", seasonNumber: 1 };
  save = playPostSeasonResults(save, 1, weights);

  save = enterNextPreseason(save, 1);
  save = playPreseason(save, 2, weights, `${seedBase}|pre2`);
  save = settlePreseasonAndEnterSeason(save, "2");

  save = resolveSeason2Carryovers(save, weights, `${seedBase}|carry`);
  save = playSeason(save, 2, weights, `${seedBase}|s2`);
  save = applySeasonCloseCarryoverStatGains({ ...save, phase: "postseason", seasonNumber: 2 }, 2);
  save = playPostSeasonResults(save, 2, weights);
  save = markSeason2ResolutionReviewComplete(save);
  validateFinalSeason2Save(save, seedBase);

  return save;
}

function validateFinalSeason2Save(save: NewGamePayload, seedBase: string): void {
  const audit = auditAgencyCoreStatTallies(save);
  const deltas = audit.deltas;
  if (deltas.rawCompetence !== 0 || deltas.rawVisibility !== 0 || deltas.reputation !== 0) {
    throw new Error(
      [
        `Season 2 stat tally mismatch for ${seedBase}.`,
        `Expected competence=${audit.expected.rawCompetence}, actual=${audit.actual.rawCompetence}.`,
        `Expected visibility=${audit.expected.rawVisibility}, actual=${audit.actual.rawVisibility}.`,
        `Expected reputation=${audit.expected.reputation}, actual=${audit.actual.reputation}.`,
      ].join(" ")
    );
  }

  const carryoverCount = getPostSeasonResolutionEntries(save, 2).length;
  if (carryoverCount > 0 && save.seasonCloseCarryoverStatsAppliedBySeason?.["2"] !== true) {
    throw new Error(`Season 2 carry-over stat credit was not applied for ${seedBase}.`);
  }

  const cashFlow = computeSeasonCashFlow(save, "2");
  if (Math.abs(cashFlow.reconciliationGap) > 1) {
    throw new Error(
      `Season 2 cash reconciliation gap exceeded tolerance for ${seedBase}: ${cashFlow.reconciliationGap.toFixed(2)}`
    );
  }
}

function createNewSave(build: BuildId, spouse: SpouseType, createdAt: string, runIndex: number): NewGamePayload {
  const resources = applySpouseAtStart(STARTING_BUILD_STATS[build], spouse);
  return {
    playerName: `Bot ${runIndex}`,
    agencyName: `Agency ${runIndex}`,
    gender: "non_binary",
    buildId: build,
    spouseType: spouse,
    spouseGender: spouse === "none" ? null : "non_binary",
    spouseName: spouse === "none" ? null : "Pat",
    seasonNumber: 1,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    preseasonActionBySeason: {},
    preseasonFocusCounts: {
      strategy_workshop: 0,
      network: 0,
    },
    reputation: STARTING_REPUTATION,
    resources,
    initialResources: { ...resources },
    initialReputation: STARTING_REPUTATION,
    hiresBySeason: {},
    employees: [],
    usedScenarioIds: [],
    payablesLines: [],
    preseasonEntrySpouseGrantSeasons: [],
    voluntaryLayoffsBySeason: {},
    seasonCashAdjustmentsBySeason: {},
    talentBazaarBannedNames: [],
    talentBazaarJuniorNamesUsed: [],
    createdAt,
  };
}

function playPreseason(
  save: NewGamePayload,
  season: number,
  weights: KpiWeights,
  seedBase: string
): NewGamePayload {
  let next = chooseBestPreseasonFocus(save, season, weights);
  next = applyBestHiring(next, season, weights, `${seedBase}|hire`);
  next = resolveMandatoryLayoffs(next, weights);
  return next;
}

function chooseBestPreseasonFocus(save: NewGamePayload, season: number, weights: KpiWeights): NewGamePayload {
  let bestSave: NewGamePayload | null = null;
  let bestScore = -Infinity;

  for (const focus of FOCUS_OPTIONS) {
    const trial = applyPreseasonFocus(save, season, focus);
    const score = stateScore(trial, weights);
    if (score > bestScore) {
      bestScore = score;
      bestSave = trial;
    }
  }

  return bestSave ?? save;
}

function applyPreseasonFocus(save: NewGamePayload, season: number, focus: PreseasonFocusId): NewGamePayload {
  const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
  return {
    ...save,
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: {
      ...(save.preseasonActionBySeason ?? {}),
      [String(season)]: focus,
    },
    preseasonFocusCounts: {
      strategy_workshop:
        (save.preseasonFocusCounts?.strategy_workshop ?? 0) + (focus === "strategy_workshop" ? 1 : 0),
      network: (save.preseasonFocusCounts?.network ?? 0) + (focus === "network" ? 1 : 0),
    },
    resources:
      focus === "strategy_workshop"
        ? { ...save.resources, competence: save.resources.competence + delta }
        : { ...save.resources, visibility: save.resources.visibility + delta },
  };
}

function applyBestHiring(
  save: NewGamePayload,
  season: number,
  weights: KpiWeights,
  seedBase: string
): NewGamePayload {
  let next = save;
  const seasonKey = String(season);
  const cap = getHireCapForSeason(season);

  while ((next.hiresBySeason?.[seasonKey] ?? 0) < cap) {
    const currentScore = stateScore(next, weights);
    const choice = chooseBestHireOption(next, season, weights, seedBase, currentScore);
    if (!choice) break;
    next = choice;
  }

  return next;
}

function chooseBestHireOption(
  save: NewGamePayload,
  season: number,
  weights: KpiWeights,
  seedBase: string,
  currentScore: number
): NewGamePayload | null {
  const liquidity = liquidityEur(save);
  const excludedNames = new Set<string>([
    ...(save.talentBazaarBannedNames ?? []),
    ...(save.employees ?? []).map((employee) => employee.name),
  ]);

  let bestSave: NewGamePayload | null = null;
  let bestDelta = 0.01;

  if (liquidity >= 10_000) {
    const candidates = generateCandidates({
      seedBase: `${seedBase}|s${season}|intern`,
      season,
      role: "campaign_manager",
      tier: "intern",
      salary: 10_000,
      reputation: save.reputation ?? STARTING_REPUTATION,
      visibility: save.resources.visibility,
      excludedNames: [...excludedNames],
    });
    for (const candidate of candidates) {
      const trial = finalizeHire(save, String(season), "intern", "campaign_manager", "intern", 10_000, candidate);
      const delta = stateScore(trial, weights) - currentScore;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestSave = trial;
      }
    }
  }

  for (const option of listAffordableFullTimeByLiquidity(liquidity)) {
    const candidates = generateCandidates({
      seedBase: `${seedBase}|s${season}|${option.role}|${option.tier}|${option.salary}`,
      season,
      role: option.role,
      tier: option.tier,
      salary: option.salary,
      reputation: save.reputation ?? STARTING_REPUTATION,
      visibility: save.resources.visibility,
      excludedNames: [...excludedNames],
    });

    for (const candidate of candidates) {
      const trial = finalizeHire(save, String(season), "full_time", option.role, option.tier, option.salary, candidate);
      const delta = stateScore(trial, weights) - currentScore;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestSave = trial;
      }
    }
  }

  return bestSave;
}

function listAffordableFullTimeByLiquidity(
  liquidity: number
): Array<{ role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }> {
  const out: Array<{ role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }> = [];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  for (const tier of tiers) {
    for (const anchor of getSalaryBands(tier).map((band) => band.anchor * 1000)) {
      if (anchor > liquidity) continue;
      for (const role of roles) {
        out.push({ role, tier, salary: anchor });
      }
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
  const productivity = Math.round(candidate.hiddenProductivityPct);
  const capacityGain = capacityGainFromProductivity(productivity);
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

  const employeeId = `${candidate.id}-${seasonKey}-${hired + 1}`;
  const payablesLines: PayableLine[] = [
    ...(save.payablesLines ?? []),
    { id: wageLineId(employeeId), label: `${candidate.name} wage`, amount: salary },
  ];

  return {
    ...save,
    resources: {
      ...save.resources,
      competence: clampToScale(save.resources.competence + competenceGain, METRIC_SCALES.competence),
      visibility: clampToScale(save.resources.visibility + visibilityGain, METRIC_SCALES.visibility),
      firmCapacity: save.resources.firmCapacity + capacityGain,
    },
    payablesLines,
    hiresBySeason: {
      ...(save.hiresBySeason ?? {}),
      [seasonKey]: hired + 1,
    },
    employees: [
      ...(save.employees ?? []),
      {
        id: employeeId,
        name: candidate.name,
        role: mode === "intern" ? "Intern" : roleLabel(role),
        salary,
        seasonHired: Number(seasonKey),
        competenceGain,
        visibilityGain,
        capacityGain,
        ...(mode === "full_time" ? { productivityPct: productivity, tenureCapacityBonus: 0 } : {}),
      },
    ],
  };
}

function resolveMandatoryLayoffs(save: NewGamePayload, weights: KpiWeights): NewGamePayload {
  let next = save;
  let guard = 0;

  while (liquidityEur(next) < 0 && (next.employees?.length ?? 0) > 0 && guard < 25) {
    guard += 1;
    let bestSave: NewGamePayload | null = null;
    let bestScore = -Infinity;

    for (const employee of next.employees ?? []) {
      const result = fireEmployeeForPayrollShortfall(next, employee.id);
      if (!result.ok) continue;
      const score = stateScore(result.save, weights) + clamp01(liquidityEur(result.save) / 50_000) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestSave = result.save;
      }
    }

    if (!bestSave) break;
    next = bestSave;
  }

  return next;
}

function playSeason(
  save: NewGamePayload,
  season: number,
  weights: KpiWeights,
  seedBase: string
): NewGamePayload {
  const seasonKey = String(season);
  const planned = plannedClientCountForSeason(
    season,
    save.resources.visibility,
    `${seedBase}|slots`,
    save.seasonEntryScoresBySeason?.[seasonKey]?.vScore
  );
  const built = buildSeasonClients(
    seedBase,
    season,
    planned,
    {
      reputation: save.reputation ?? STARTING_REPUTATION,
      visibility: save.resources.visibility,
      competence: save.resources.competence,
    },
    save.usedScenarioIds ?? [],
    save.seasonEntryScoresBySeason?.[seasonKey]
  );

  const picks = chooseBestSeasonPlan(save, season, built.clients, weights, seedBase);
  return applySeasonPlan(save, season, built.clients, built.usedScenarioIds, picks, seedBase);
}

function chooseBestSeasonPlan(
  save: NewGamePayload,
  season: number,
  clients: SeasonClient[],
  weights: KpiWeights,
  seedBase: string
): Choice[] {
  const startEur = save.resources.eur;
  const startCap = save.resources.firmCapacity;
  const vis = save.resources.visibility;
  const competence = save.resources.competence;
  const outcomeScoreSeason: 1 | 2 | 3 = season >= 3 ? 3 : season >= 2 ? 2 : 1;
  const executableByClient = clients.map((client) =>
    buildSolutionOptionsForClient(client).filter((option) => !option.isRejectOption)
  );
  const maxExec = maxExecutionsPossible(clients, startEur, startCap, executableByClient);
  const minExecRequired = maxExec > 0 ? 1 : 0;
  const queueMaxProfit = queueMaxTheoreticalProfit(clients, executableByClient);

  let bestScore = -Infinity;
  let bestExec = -1;
  let bestProfit = -Infinity;
  let bestPicks: Choice[] = [];

  const dfs = (index: number, eur: number, cap: number, picks: Choice[]) => {
    if (index >= clients.length) {
      const evaluated = evaluateSeasonPlan(
        clients,
        picks,
        startEur,
        startCap,
        vis,
        competence,
        queueMaxProfit,
        outcomeScoreSeason,
        seedBase,
        weights
      );
      if (evaluated.executed < minExecRequired) return;
      if (
        evaluated.score > bestScore ||
        (evaluated.score === bestScore && evaluated.executed > bestExec) ||
        (evaluated.score === bestScore && evaluated.executed === bestExec && evaluated.totalProfit > bestProfit)
      ) {
        bestScore = evaluated.score;
        bestExec = evaluated.executed;
        bestProfit = evaluated.totalProfit;
        bestPicks = [...picks];
      }
      return;
    }

    const client = clients[index]!;
    const liquid = eur + client.budgetSeason1;

    dfs(index + 1, eur, cap, [...picks, "reject"]);

    for (const option of executableByClient[index]!) {
      if (!canAffordSolution(option, liquid, cap)) continue;
      dfs(index + 1, eur + client.budgetSeason1 - option.costBudget, cap - option.costCapacity, [...picks, option]);
    }
  };

  dfs(0, startEur, startCap, []);
  return bestPicks;
}

function evaluateSeasonPlan(
  clients: SeasonClient[],
  picks: Choice[],
  startEur: number,
  startCap: number,
  visibility: number,
  competence: number,
  queueMaxProfit: number,
  outcomeScoreSeason: 1 | 2 | 3,
  seedBase: string,
  weights: KpiWeights
): { score: number; executed: number; totalProfit: number } {
  let eur = startEur;
  let cap = startCap;
  let totalProfit = 0;
  let executed = 0;
  let totalSatisfaction = 0;
  let totalReach = 0;
  let totalEffectiveness = 0;

  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]!;
    const choice = picks[index]!;
    if (choice === "reject") continue;

    const outcome = resolveClientOutcome({
      seed: `${seedBase}|s${outcomeScoreSeason}|${client.id}|${choice.id}`,
      solution: choice,
      visibility,
      competence,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
      outcomeScoreSeason,
    });

    executed += 1;
    totalProfit += client.budgetSeason1 - choice.costBudget;
    eur += client.budgetSeason1 - choice.costBudget;
    cap = Math.max(0, cap - choice.costCapacity);
    totalSatisfaction += outcome.satisfaction;
    totalReach += outcome.messageSpread;
    totalEffectiveness += outcome.messageEffectiveness;
  }

  const meanSatisfaction = executed > 0 ? totalSatisfaction / executed : 0;
  const meanReach = executed > 0 ? totalReach / executed : 0;
  const meanEffectiveness = executed > 0 ? totalEffectiveness / executed : 0;
  const profitNorm = queueMaxProfit > 0 ? totalProfit / queueMaxProfit : 0;
  const score =
    weights.operatingProfit * profitNorm +
    clientInteractionScore(meanSatisfaction, meanReach, meanEffectiveness, weights) +
    weights.rawCash * clamp01(eur / 250_000) +
    weights.rawCapacity * clamp01(cap / 250);

  return { score, executed, totalProfit };
}

function applySeasonPlan(
  save: NewGamePayload,
  season: number,
  clients: SeasonClient[],
  usedScenarioIds: string[],
  picks: Choice[],
  seedBase: string
): NewGamePayload {
  const seasonKey = String(season);
  const outcomeScoreSeason: 1 | 2 | 3 = season >= 3 ? 3 : season >= 2 ? 2 : 1;
  const visibility = save.resources.visibility;
  const competence = save.resources.competence;

  let eur = save.resources.eur;
  let cap = save.resources.firmCapacity;
  const runs: SeasonClientRun[] = [];

  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]!;
    const choice = picks[index]!;

    if (choice === "reject") {
      runs.push({ clientId: client.id, accepted: false, solutionId: "reject" });
      continue;
    }

    const outcome = resolveClientOutcome({
      seed: `${seedBase}|play|${client.id}|${choice.id}`,
      solution: choice,
      visibility,
      competence,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
      outcomeScoreSeason,
    });

    eur += client.budgetSeason1 - choice.costBudget;
    cap = Math.max(0, cap - choice.costCapacity);

    runs.push({
      clientId: client.id,
      accepted: true,
      solutionId: choice.id,
      outcome,
      costBudget: choice.costBudget,
      costCapacity: choice.costCapacity,
      solutionTitle: choice.title,
    });
  }

  return {
    ...save,
    phase: "season",
    seasonNumber: season,
    usedScenarioIds,
    resources: {
      ...save.resources,
      eur,
      firmCapacity: cap,
    },
    seasonLoopBySeason: {
      ...(save.seasonLoopBySeason ?? {}),
      [seasonKey]: {
        plannedClientCount: clients.length,
        currentClientIndex: clients.length,
        clientsQueue: clients,
        runs,
      },
    },
  };
}

function playPostSeasonResults(save: NewGamePayload, season: number, weights: KpiWeights): NewGamePayload {
  const seasonKey = String(season);
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) return save;

  let next = save;
  for (const run of loop.runs) {
    if (!run.accepted || run.solutionId === "reject" || !run.outcome) continue;
    next = chooseBestPostSeasonChoice(next, season, run.clientId, weights);
  }
  return next;
}

function chooseBestPostSeasonChoice(
  save: NewGamePayload,
  season: number,
  clientId: string,
  weights: KpiWeights
): NewGamePayload {
  const seasonKey = String(season);
  const beforeRun = save.seasonLoopBySeason?.[seasonKey]?.runs.find((run) => run.clientId === clientId);
  if (!beforeRun?.outcome) return save;

  let bestSave: NewGamePayload | null = null;
  let bestScore = -Infinity;

  for (const choice of ["none", "reach", "effectiveness"] as const) {
    const trial = applyPostSeasonChoice(structuredClone(save), seasonKey, clientId, choice, season);
    if (!trial) continue;

    const afterRun = trial.seasonLoopBySeason?.[seasonKey]?.runs.find((run) => run.clientId === clientId);
    const beforeOutcome = beforeRun.outcome;
    const afterOutcome = afterRun?.outcome;
    if (!afterOutcome) continue;

    const score =
      stateScore(trial, weights) -
      stateScore(save, weights) +
      (clientInteractionScore(
        afterOutcome.satisfaction,
        afterOutcome.messageSpread,
        afterOutcome.messageEffectiveness,
        weights
      ) -
        clientInteractionScore(
          beforeOutcome.satisfaction,
          beforeOutcome.messageSpread,
          beforeOutcome.messageEffectiveness,
          weights
        ));

    if (score > bestScore) {
      bestScore = score;
      bestSave = trial;
    }
  }

  return bestSave ?? save;
}

function resolveSeason2Carryovers(save: NewGamePayload, weights: KpiWeights, seedBase: string): NewGamePayload {
  let next = save;
  const entries = getSeasonCarryoverEntries(next, 2);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const options = buildCarryoverSolutionOptionsForClient(entry.client);
    let bestSave: NewGamePayload | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      const trial = applySeason2CarryoverChoice(
        structuredClone(next),
        2,
        entry.client.id,
        option,
        `${seedBase}|${entry.client.id}|${option.id}|${index}`
      );
      if (!trial) continue;

      const resolution = trial.seasonLoopBySeason?.["1"]?.runs.find((run) => run.clientId === entry.client.id)
        ?.season2CarryoverResolution;
      if (!resolution) continue;

      const score =
        stateScore(trial, weights) -
        stateScore(next, weights) +
        clientInteractionScore(
          resolution.satisfaction,
          resolution.messageSpread,
          resolution.messageEffectiveness,
          weights
        );

      if (score > bestScore) {
        bestScore = score;
        bestSave = trial;
      }
    }

    if (bestSave) next = bestSave;
  }

  return next;
}

function markSeason2ResolutionReviewComplete(save: NewGamePayload): NewGamePayload {
  const count = getPostSeasonResolutionEntries(save, 2).length;
  return {
    ...save,
    postSeasonResolutionProgressBySeason: {
      ...(save.postSeasonResolutionProgressBySeason ?? {}),
      ["2"]: count,
    },
  };
}

function collectFinalMetrics(
  save: NewGamePayload,
  build: BuildId,
  spouse: SpouseType,
  runIndex: number
): FinalRunMetrics {
  const profit = computeAgencyProfitFlashcardEndOfSeason2(save);
  const interactions = collectInteractionAverages(save);
  return {
    build,
    spouse,
    runIndex,
    operatingProfitEur: profit.profit,
    profitMarginPct: profit.profitMarginPct ?? 0,
    reputationGain: (save.reputation ?? STARTING_REPUTATION) - STARTING_REPUTATION,
    avgSolutionReach: interactions.avgReach,
    avgSolutionEffectiveness: interactions.avgEffectiveness,
    avgSolutionSatisfaction: interactions.avgSatisfaction,
    resolvedOutcomesCount: interactions.count,
    rawCompetence: save.resources.competence,
    rawVisibility: save.resources.visibility,
    reputation: save.reputation ?? STARTING_REPUTATION,
    cashEur: save.resources.eur,
    liquidityEur: liquidityEur(save),
  };
}

function collectInteractionAverages(save: NewGamePayload): {
  count: number;
  avgReach: number;
  avgEffectiveness: number;
  avgSatisfaction: number;
} {
  let count = 0;
  let reach = 0;
  let effectiveness = 0;
  let satisfaction = 0;

  for (const loop of Object.values(save.seasonLoopBySeason ?? {})) {
    for (const run of loop?.runs ?? []) {
      if (run.accepted && run.solutionId !== "reject" && run.outcome) {
        count += 1;
        reach += run.outcome.messageSpread;
        effectiveness += run.outcome.messageEffectiveness;
        satisfaction += run.outcome.satisfaction;
      }
      if (run.season2CarryoverResolution) {
        count += 1;
        reach += run.season2CarryoverResolution.messageSpread;
        effectiveness += run.season2CarryoverResolution.messageEffectiveness;
        satisfaction += run.season2CarryoverResolution.satisfaction;
      }
    }
  }

  if (count === 0) {
    return { count: 0, avgReach: 0, avgEffectiveness: 0, avgSatisfaction: 0 };
  }
  return {
    count,
    avgReach: reach / count,
    avgEffectiveness: effectiveness / count,
    avgSatisfaction: satisfaction / count,
  };
}

function clientInteractionScore(
  satisfaction: number,
  reach: number,
  effectiveness: number,
  weights: KpiWeights
): number {
  const localReachWeight = weights.clientSatisfaction * 0.25;
  const localEffectivenessWeight = weights.clientSatisfaction * 0.25;
  return (
    weights.clientSatisfaction * clamp01(satisfaction / 100) +
    localReachWeight * clamp01(reach / 100) +
    localEffectivenessWeight * clamp01(effectiveness / 100)
  );
}

function stateScore(save: NewGamePayload, weights: KpiWeights): number {
  const rep = metricNorm(save.reputation ?? STARTING_REPUTATION, METRIC_SCALES.reputation.min, METRIC_SCALES.reputation.max);
  const comp = metricNorm(save.resources.competence, METRIC_SCALES.competence.min, METRIC_SCALES.competence.max);
  const vis = metricNorm(save.resources.visibility, METRIC_SCALES.visibility.min, METRIC_SCALES.visibility.max);
  const cap = clamp01(save.resources.firmCapacity / 250);
  const cash = clamp01(save.resources.eur / 250_000);
  const liq = clamp01(liquidityEur(save) / 150_000);

  return (
    weights.reputation * rep +
    weights.rawCompetence * comp +
    weights.rawVisibility * vis +
    weights.rawCapacity * cap +
    weights.rawCash * cash +
    weights.rawCash * 0.1 * liq
  );
}

function metricNorm(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function queueMaxTheoreticalProfit(clients: SeasonClient[], executableByClient: SolutionOption[][]): number {
  let sum = 0;
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]!;
    let maxMargin = 0;
    for (const option of executableByClient[index]!) {
      maxMargin = Math.max(maxMargin, client.budgetSeason1 - option.costBudget);
    }
    sum += maxMargin;
  }
  return Math.max(sum, 1e-9);
}

function maxExecutionsPossible(
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  executableByClient: SolutionOption[][]
): number {
  let best = 0;

  const dfs = (index: number, eur: number, cap: number, count: number) => {
    if (index >= clients.length) {
      best = Math.max(best, count);
      return;
    }

    const client = clients[index]!;
    const liquid = eur + client.budgetSeason1;

    dfs(index + 1, eur, cap, count);

    for (const option of executableByClient[index]!) {
      if (!canAffordSolution(option, liquid, cap)) continue;
      dfs(index + 1, eur + client.budgetSeason1 - option.costBudget, cap - option.costCapacity, count + 1);
    }
  };

  dfs(0, startEur, startCap, 0);
  return best;
}

function summarize(values: number[]): MetricSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length <= 1 ? 0 : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    min: sorted[0]!,
    q1: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    q3: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1]!,
    mean,
    stdDev: Math.sqrt(variance),
  };
}

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - index) + sorted[hi]! * (index - lo);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hash32(input: string): number {
  let h = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    h ^= input.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main();
