/**
 * 600 KPI games + 2 stat-max specials. Bot uses every player affordance we model:
 * pre-season focus + hiring each year, shopping center (all affordable purchases in pre-season 3),
 * salary negotiations, Season 1–3 campaigns + post-season choices, carryover resolutions.
 *
 * Checkpoint: end of Season 3 post-season (before pre-season 4).
 *
 * Run (full Season 3 + post-season):
 * npx tsx --tsconfig tsconfig.json scripts/simulate-preseason3-end-kpi-600.ts
 *
 * Run (Season 3 entry only — after "Go to season" / settlePreseasonAndEnterSeason('3'), no Season 3 clients):
 * npx tsx --tsconfig tsconfig.json scripts/simulate-preseason3-end-kpi-600.ts --preseason3-entry-capacity
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NewGamePayload } from "../components/NewGameWizard";
import { auditAgencyCoreStatTallies } from "../lib/agencyStatAudit";
import { fireEmployeeForPayrollShortfall } from "../lib/employeeActions";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
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
import {
  getEffectiveCompetenceForAgency,
  getEffectiveVisibilityForAgency,
} from "../lib/agencyStatsEffective";
import {
  applyShoppingPurchase,
  type ShoppingItemId,
} from "../lib/shoppingCenter";
import { settlePreseasonAndEnterSeason, liquidityEur, wageLineId, type PayableLine } from "../lib/payablesReceivables";
import { applyPostSeasonChoice } from "../lib/postSeasonResults";
import { getPreseasonFocusDeltaForSeason, type PreseasonFocusId } from "../lib/preseasonFocus";
import { enterNextPreseason } from "../lib/preseasonTransition";
import { computeSeasonCashFlow } from "../lib/seasonFinancials";
import {
  canAffordPayRaise,
  hasUnresolvedSalaryNegotiationV3,
  reconcileSalaryNegotiationWithRoster,
  resolveSalaryAskLeft,
  resolveSalaryAskPaid,
} from "../lib/preseasonSalaryNegotiation";
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

type Preseason3Mode = "kpi" | "maxVisibility" | "maxCompetence";

type FinalRunMetrics = {
  build: BuildId;
  spouse: SpouseType;
  runIndex: number;
  mode: Preseason3Mode;
  /** Stored agency stats (resources). */
  rawCompetence: number;
  rawVisibility: number;
  /** Same as in-game scoring: Tech Overhaul / Soft Launch Buzz multipliers when purchased. */
  effectiveCompetence: number;
  effectiveVisibility: number;
  reputation: number;
  shoppingCenterPurchases: NewGamePayload["shoppingCenterPurchases"];
};

const RUNS_PER_COMBO = 50;
const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const SPOUSES: SpouseType[] = ["supportive", "influential", "rich", "none"];
const FOCUS_OPTIONS: PreseasonFocusId[] = ["strategy_workshop", "network"];
const RESULTS_FILE = "season3-postseason-kpi-600-plus-specials.json";
const SPECIAL_BUILD: BuildId = "portfolio_pivot";
const SPECIAL_SPOUSE: SpouseType = "supportive";

type CapacityEntryRun = {
  build: BuildId;
  spouse: SpouseType;
  runIndex: number;
  firmCapacity: number;
  employeeCount: number;
};

const ENTRY_CAPACITY_RESULTS_FILE = "preseason3-entry-capacity-kpi-600.json";

function mainPreseason3EntryCapacity() {
  const framework = loadKpiFramework();
  const rows: CapacityEntryRun[] = [];

  for (const build of BUILDS) {
    for (const spouse of SPOUSES) {
      for (let runIndex = 0; runIndex < RUNS_PER_COMBO; runIndex += 1) {
        const seedLabel = `${build}|${spouse}|${runIndex}`;
        const variant = buildVariantWeights(framework.baseline, framework.boostMin, framework.boostMax, seedLabel);
        const save = runThroughPreseason3EntryOnly(build, spouse, runIndex, variant.weights, "kpi");
        rows.push({
          build,
          spouse,
          runIndex,
          firmCapacity: save.resources.firmCapacity,
          employeeCount: save.employees?.length ?? 0,
        });
      }
    }
  }

  const capacities = rows.map((r) => r.firmCapacity);
  const headcounts = rows.map((r) => r.employeeCount);

  const output = {
    meta: {
      runsPerCombo: RUNS_PER_COMBO,
      combinations: BUILDS.length * SPOUSES.length,
      totalRuns: rows.length,
      strategyFrameworkRef: "scripts/strategies/test-bot-kpi-framework.json",
      checkpoint:
        "Immediately after settlePreseasonAndEnterSeason('3') (same as clicking through to Season 3 week). No Season 3 clients, carryovers, or post-season.",
      notes: [
        "KPI strategy with per-run weight perturbation (same as main 600 matrix).",
        "Shopping: all affordable pre-season 3 purchases; then salary asks, focus, hiring, layoffs.",
        "firmCapacity is resources.firmCapacity at entry to Season 3.",
      ],
    },
    aggregated: {
      firmCapacity: summarize(capacities),
      employeeCount: summarize(headcounts),
    },
    rawRuns: rows,
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "results", ENTRY_CAPACITY_RESULTS_FILE);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Saved pre-Season-3-entry capacity report to ${outPath}`);
  console.log(`Runs: ${rows.length}`);
  const fc = output.aggregated.firmCapacity;
  const ec = output.aggregated.employeeCount;
  console.log("");
  console.log("firmCapacity (aggregated):");
  console.log(
    `  min=${fc.min} q1=${fc.q1.toFixed(2)} median=${fc.median.toFixed(2)} q3=${fc.q3.toFixed(2)} max=${fc.max} mean=${fc.mean.toFixed(2)} stdDev=${fc.stdDev.toFixed(2)}`
  );
  console.log("");
  console.log("employeeCount (roster size at same checkpoint, for context):");
  console.log(
    `  min=${ec.min} q1=${ec.q1.toFixed(2)} median=${ec.median.toFixed(2)} q3=${ec.q3.toFixed(2)} max=${ec.max} mean=${ec.mean.toFixed(2)} stdDev=${ec.stdDev.toFixed(2)}`
  );
}

function main() {
  const framework = loadKpiFramework();
  const allFinals: FinalRunMetrics[] = [];

  for (const build of BUILDS) {
    for (const spouse of SPOUSES) {
      for (let runIndex = 0; runIndex < RUNS_PER_COMBO; runIndex += 1) {
        const seedLabel = `${build}|${spouse}|${runIndex}`;
        const variant = buildVariantWeights(framework.baseline, framework.boostMin, framework.boostMax, seedLabel);
        const finalSave = runThroughSeason3PostseasonEnd(build, spouse, runIndex, variant.weights, "kpi");
        allFinals.push(collectFinalMetrics(finalSave, build, spouse, runIndex, "kpi"));
      }
    }
  }

  const maxVisSave = runThroughSeason3PostseasonEnd(SPECIAL_BUILD, SPECIAL_SPOUSE, 9000, framework.baseline, "maxVisibility");
  allFinals.push(collectFinalMetrics(maxVisSave, SPECIAL_BUILD, SPECIAL_SPOUSE, 9000, "maxVisibility"));

  const maxCompSave = runThroughSeason3PostseasonEnd(SPECIAL_BUILD, SPECIAL_SPOUSE, 9001, framework.baseline, "maxCompetence");
  allFinals.push(collectFinalMetrics(maxCompSave, SPECIAL_BUILD, SPECIAL_SPOUSE, 9001, "maxCompetence"));

  const output = {
    meta: {
      runsPerCombo: RUNS_PER_COMBO,
      combinations: BUILDS.length * SPOUSES.length,
      kpiGames: RUNS_PER_COMBO * BUILDS.length * SPOUSES.length,
      specialStatMaxGames: 2,
      totalSampleSize: allFinals.length,
      strategyFrameworkRef: "scripts/strategies/test-bot-kpi-framework.json",
      checkpoint:
        "End of Season 3 post-season (phase=postseason, seasonNumber=3). Shopping: all affordable items each run in pre-season 3 (HR, vacation, rent, tech, buzz).",
      specialRunsNote:
        "Two additional runs (max visibility / max competence) use baseline KPI weights for Seasons 1–2, then greedy pre-season 3 focus + hiring + salary resolution for that stat.",
    },
    distributionsIncludingSpecials: {
      rawCompetence: summarize(allFinals.map((m) => m.rawCompetence)),
      rawVisibility: summarize(allFinals.map((m) => m.rawVisibility)),
      effectiveCompetence: summarize(allFinals.map((m) => m.effectiveCompetence)),
      effectiveVisibility: summarize(allFinals.map((m) => m.effectiveVisibility)),
      reputation: summarize(allFinals.map((m) => m.reputation)),
    },
    distributionsKpi600Only: {
      rawCompetence: summarize(allFinals.filter((m) => m.mode === "kpi").map((m) => m.rawCompetence)),
      rawVisibility: summarize(allFinals.filter((m) => m.mode === "kpi").map((m) => m.rawVisibility)),
      effectiveCompetence: summarize(allFinals.filter((m) => m.mode === "kpi").map((m) => m.effectiveCompetence)),
      effectiveVisibility: summarize(allFinals.filter((m) => m.mode === "kpi").map((m) => m.effectiveVisibility)),
      reputation: summarize(allFinals.filter((m) => m.mode === "kpi").map((m) => m.reputation)),
    },
    rawRuns: allFinals,
  };

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(scriptDir, "results", RESULTS_FILE);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const d = output.distributionsIncludingSpecials;
  console.log(`Saved report to ${outPath}`);
  console.log(`Sample size (600 KPI + 2 specials): ${allFinals.length}`);
  console.log("");
  console.log("Including 600 KPI + 2 stat-max games — raw + effective competence/visibility, reputation:");
  for (const label of [
    "rawCompetence",
    "rawVisibility",
    "effectiveCompetence",
    "effectiveVisibility",
    "reputation",
  ] as const) {
    const s = d[label];
    console.log(
      `  ${label}: mean=${s.mean.toFixed(2)} sd=${s.stdDev.toFixed(2)} median=${s.median.toFixed(2)} q25=${s.q1.toFixed(2)} q75=${s.q3.toFixed(2)} min=${s.min} max=${s.max}`
    );
  }
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

/** Purchase order: HR upgrades before pre-season 3 hiring; then personal vacation; then agency upgrades. */
function shoppingItemsForSave(save: NewGamePayload): ShoppingItemId[] {
  const items: ShoppingItemId[] = [
    "hr_skills_test",
    "hr_reference_checks",
    save.spouseType === "none" ? "vacation_solo" : "vacation_with_spouse",
    "rent_office",
    "tech_overhaul",
    "soft_launch_buzz",
  ];
  return items;
}

/** Buy every shopping item the save can afford, repeating until a full pass makes no purchase. */
function applyAllShoppingPurchases(save: NewGamePayload): NewGamePayload {
  let next = save;
  let progress = true;
  while (progress) {
    progress = false;
    for (const id of shoppingItemsForSave(next)) {
      const res = applyShoppingPurchase(next, id);
      if (res.ok) {
        next = res.save;
        progress = true;
      }
    }
  }
  return next;
}

/**
 * Pre-season 3 complete, then the same transition as the UI "start season" / enter Season 3 week.
 * Stops with phase=season, seasonNumber=3 — no carryover resolution, no Season 3 client queue execution.
 */
function runThroughPreseason3EntryOnly(
  build: BuildId,
  spouse: SpouseType,
  runIndex: number,
  weights: KpiWeights,
  mode: Preseason3Mode
): NewGamePayload {
  let save = runFullTwoSeasonSimulation(build, spouse, runIndex, weights);
  save = enterNextPreseason(save, 2);
  const createdAt = save.createdAt ?? new Date().toISOString();
  const seedBase = `${createdAt}|${build}|${spouse}|${runIndex}`;

  save = applyAllShoppingPurchases(save);
  save = resolveSalaryNegotiationsV3(save, mode, weights);
  save = playPreseason3(save, mode, weights, `${seedBase}|pre3`);

  return settlePreseasonAndEnterSeason(save, "3");
}

function runThroughSeason3PostseasonEnd(
  build: BuildId,
  spouse: SpouseType,
  runIndex: number,
  weights: KpiWeights,
  mode: Preseason3Mode
): NewGamePayload {
  let save = runFullTwoSeasonSimulation(build, spouse, runIndex, weights);
  save = enterNextPreseason(save, 2);
  const createdAt = save.createdAt ?? new Date().toISOString();
  const seedBase = `${createdAt}|${build}|${spouse}|${runIndex}`;

  save = applyAllShoppingPurchases(save);
  save = resolveSalaryNegotiationsV3(save, mode, weights);
  save = playPreseason3(save, mode, weights, `${seedBase}|pre3`);

  save = settlePreseasonAndEnterSeason(save, "3");
  save = resolveSeason3Carryovers(save, weights, `${seedBase}|carryS3`);
  save = playSeason(save, 3, weights, `${seedBase}|s3`);
  save = applySeasonCloseCarryoverStatGains({ ...save, phase: "postseason", seasonNumber: 3 }, 3);
  save = playPostSeasonResults(save, 3, weights);
  save = markSeason3ResolutionReviewComplete(save);
  validateSeason3Cash(save, seedBase);

  return save;
}

function validateSeason3Cash(save: NewGamePayload, seedBase: string): void {
  const cashFlow = computeSeasonCashFlow(save, "3");
  if (Math.abs(cashFlow.reconciliationGap) > 1) {
    throw new Error(
      `Season 3 cash reconciliation gap exceeded tolerance for ${seedBase}: ${cashFlow.reconciliationGap.toFixed(2)}`
    );
  }
}

function resolveSeason3Carryovers(save: NewGamePayload, weights: KpiWeights, seedBase: string): NewGamePayload {
  let next = save;
  const entries = getSeasonCarryoverEntries(next, 3);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const options = buildCarryoverSolutionOptionsForClient(entry.client, 3);
    let bestSave: NewGamePayload | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      const trial = applySeason2CarryoverChoice(
        structuredClone(next),
        3,
        entry.client.id,
        option,
        `${seedBase}|${entry.client.id}|${option.id}|${index}`
      );
      if (!trial) continue;

      const resolution = trial.seasonLoopBySeason?.["2"]?.runs.find((run) => run.clientId === entry.client.id)
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

function markSeason3ResolutionReviewComplete(save: NewGamePayload): NewGamePayload {
  const count = getPostSeasonResolutionEntries(save, 3).length;
  return {
    ...save,
    postSeasonResolutionProgressBySeason: {
      ...(save.postSeasonResolutionProgressBySeason ?? {}),
      ["3"]: count,
    },
  };
}

function resolveSalaryNegotiationsV3(save: NewGamePayload, mode: Preseason3Mode, weights: KpiWeights): NewGamePayload {
  let next = reconcileSalaryNegotiationWithRoster(save);
  while (hasUnresolvedSalaryNegotiationV3(next)) {
    const v = next.preseasonSalaryNegotiationV3;
    if (!v || v.seasonKey !== "3") break;
    const ask = v.asks.find((a) => !v.resolved[a.employeeId]);
    if (!ask) break;

    const paidTrial = canAffordPayRaise(next, ask.employeeId, ask.raiseEur)
      ? resolveSalaryAskPaid(next, ask.employeeId, ask.raiseEur)
      : null;
    const leaveResult = fireEmployeeForPayrollShortfall(next, ask.employeeId);
    const leftTrial =
      leaveResult.ok ? resolveSalaryAskLeft(leaveResult.save, ask.employeeId) : null;

    if (paidTrial && leftTrial) {
      if (mode === "kpi") {
        const sPaid = stateScore(paidTrial, weights);
        const sLeft = stateScore(leftTrial, weights);
        next = sPaid >= sLeft ? paidTrial : leftTrial;
      } else if (mode === "maxVisibility") {
        next =
          paidTrial.resources.visibility >= leftTrial.resources.visibility ? paidTrial : leftTrial;
      } else {
        next =
          paidTrial.resources.competence >= leftTrial.resources.competence ? paidTrial : leftTrial;
      }
    } else if (paidTrial) {
      next = paidTrial;
    } else if (leftTrial) {
      next = leftTrial;
    } else {
      break;
    }
  }
  return next;
}

function playPreseason3(
  save: NewGamePayload,
  mode: Preseason3Mode,
  weights: KpiWeights,
  seedBase: string
): NewGamePayload {
  if (mode === "kpi") {
    let next = chooseBestPreseasonFocus(save, 3, weights);
    next = applyBestHiring(next, 3, weights, `${seedBase}|hire`);
    next = resolveMandatoryLayoffs(next, weights);
    return next;
  }
  if (mode === "maxVisibility") {
    let next = applyPreseasonFocus(save, 3, "network");
    next = applyBestHiringMaxStat(next, 3, "visibility", `${seedBase}|hire`);
    next = resolveMandatoryLayoffsMaxStat(next, "visibility");
    return next;
  }
  let next = applyPreseasonFocus(save, 3, "strategy_workshop");
  next = applyBestHiringMaxStat(next, 3, "competence", `${seedBase}|hire`);
  next = resolveMandatoryLayoffsMaxStat(next, "competence");
  return next;
}

function applyBestHiringMaxStat(
  save: NewGamePayload,
  season: number,
  stat: "visibility" | "competence",
  seedBase: string
): NewGamePayload {
  let next = save;
  const seasonKey = String(season);
  const cap = getHireCapForSeason(season);

  while ((next.hiresBySeason?.[seasonKey] ?? 0) < cap) {
    const liquidity = liquidityEur(next);
    const excludedNames = new Set<string>([
      ...(next.talentBazaarBannedNames ?? []),
      ...(next.employees ?? []).map((employee) => employee.name),
    ]);

    let bestSave: NewGamePayload | null = null;
    let bestDelta = -Infinity;

    if (liquidity >= 10_000) {
      const candidates = generateCandidates({
        seedBase: `${seedBase}|s${season}|intern`,
        season,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: next.reputation ?? STARTING_REPUTATION,
        visibility: next.resources.visibility,
        excludedNames: [...excludedNames],
        save: next,
      });
      for (const candidate of candidates) {
        const trial = finalizeHire(next, seasonKey, "intern", "campaign_manager", "intern", 10_000, candidate);
        const delta =
          stat === "visibility"
            ? trial.resources.visibility - next.resources.visibility
            : trial.resources.competence - next.resources.competence;
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
        reputation: next.reputation ?? STARTING_REPUTATION,
        visibility: next.resources.visibility,
        excludedNames: [...excludedNames],
        save: next,
      });
      for (const candidate of candidates) {
        const trial = finalizeHire(next, seasonKey, "full_time", option.role, option.tier, option.salary, candidate);
        const delta =
          stat === "visibility"
            ? trial.resources.visibility - next.resources.visibility
            : trial.resources.competence - next.resources.competence;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestSave = trial;
        }
      }
    }

    if (!bestSave || bestDelta <= 0) break;
    next = bestSave;
  }

  return next;
}

function resolveMandatoryLayoffsMaxStat(
  save: NewGamePayload,
  stat: "visibility" | "competence"
): NewGamePayload {
  let next = save;
  let guard = 0;
  while (liquidityEur(next) < 0 && (next.employees?.length ?? 0) > 0 && guard < 25) {
    guard += 1;
    let bestSave: NewGamePayload | null = null;
    let bestLoss = Infinity;
    for (const employee of next.employees ?? []) {
      const result = fireEmployeeForPayrollShortfall(next, employee.id);
      if (!result.ok) continue;
      const loss = stat === "visibility" ? employee.visibilityGain : employee.competenceGain;
      if (loss < bestLoss) {
        bestLoss = loss;
        bestSave = result.save;
      }
    }
    if (!bestSave) break;
    next = bestSave;
  }
  return next;
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
      save,
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
      save,
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
  runIndex: number,
  mode: Preseason3Mode
): FinalRunMetrics {
  return {
    build,
    spouse,
    runIndex,
    mode,
    rawCompetence: save.resources.competence,
    rawVisibility: save.resources.visibility,
    effectiveCompetence: getEffectiveCompetenceForAgency(save),
    effectiveVisibility: getEffectiveVisibilityForAgency(save),
    reputation: save.reputation ?? STARTING_REPUTATION,
    shoppingCenterPurchases: save.shoppingCenterPurchases,
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

if (typeof process !== "undefined" && process.argv.includes("--preseason3-entry-capacity")) {
  mainPreseason3EntryCapacity();
} else {
  main();
}
