import type { NewGamePayload } from "@/components/NewGameWizard";
import { applySpouseAtStart, STARTING_BUILD_STATS } from "@/lib/gameEconomy";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";
import { sumReceivablesFromLoop } from "@/lib/payablesReceivables";
import type { SeasonLoopState } from "@/lib/seasonClientLoop";

export type SeasonCashBridge = {
  openingCash: number;
  closingCash: number;
  /** Accepted-client revenue recognized in this season. */
  revenue: number;
  /** Sum of in-season solution EUR spend (rollovers + fresh campaigns). */
  campaignCost: number;
  /** Post-season reach boosts paid in cash. */
  extraCampaignCost: number;
  /** Revenue minus campaign costs and post-season extras. */
  netOperatingCash: number;
};

type SeasonRecognizedRevenue = {
  rolloverReceivables: number;
  freshClientFees: number;
  total: number;
};

type SeasonCampaignCosts = {
  rolloverCampaignCost: number;
  freshCampaignCost: number;
  total: number;
};

function computeRecognizedSeasonRevenue(save: NewGamePayload, seasonKey: string): SeasonRecognizedRevenue {
  const seasonNum = Number(seasonKey);
  const freshLoop = save.seasonLoopBySeason?.[seasonKey];
  let freshClientFees = 0;

  for (const run of freshLoop?.runs ?? []) {
    if (!run.accepted || run.solutionId === "reject") continue;
    const client = freshLoop?.clientsQueue.find((c) => c.id === run.clientId);
    if (!client) continue;
    freshClientFees += client.budgetSeason1;
  }

  const rolloverReceivables = seasonNum >= 2 ? sumReceivablesFromLoop(save, String(seasonNum - 1)) : 0;
  return {
    rolloverReceivables,
    freshClientFees,
    total: rolloverReceivables + freshClientFees,
  };
}

function computeSeasonCampaignCosts(save: NewGamePayload, seasonKey: string): SeasonCampaignCosts {
  const seasonNum = Number(seasonKey);
  const freshLoop = save.seasonLoopBySeason?.[seasonKey];
  const rolloverLoop = seasonNum >= 2 ? save.seasonLoopBySeason?.[String(seasonNum - 1)] : undefined;

  let freshCampaignCost = 0;
  for (const run of freshLoop?.runs ?? []) {
    if (!run.accepted || run.solutionId === "reject") continue;
    freshCampaignCost += run.costBudget ?? 0;
  }

  let rolloverCampaignCost = 0;
  for (const run of rolloverLoop?.runs ?? []) {
    if (!run.accepted || run.solutionId === "reject") continue;
    if (!run.season2CarryoverResolution) continue;
    rolloverCampaignCost += run.season2CarryoverResolution.costBudget ?? 0;
  }

  return {
    rolloverCampaignCost,
    freshCampaignCost,
    total: rolloverCampaignCost + freshCampaignCost,
  };
}

export function computeSeasonCashBridge(save: NewGamePayload, seasonKey: string): SeasonCashBridge {
  const revenueBreakdown = computeRecognizedSeasonRevenue(save, seasonKey);
  const campaignCosts = computeSeasonCampaignCosts(save, seasonKey);
  const extraCampaignCost = collectPostSeasonLedger(save)
    .filter((e) => e.seasonKey === seasonKey)
    .reduce((s, e) => s + e.eurSpentOnReachBoost, 0);
  const closingCash = save.resources.eur;
  const revenue = revenueBreakdown.total;
  const campaignCost = campaignCosts.total;
  const netOperatingCash = revenue - campaignCost - extraCampaignCost;
  const openingCash = closingCash - netOperatingCash;
  return {
    openingCash,
    closingCash,
    revenue,
    campaignCost,
    extraCampaignCost,
    netOperatingCash,
  };
}

export type SeasonCashFlow = {
  /** Cash before wages shown below: Season 1 = build endowment + spouse; Season 2+ = cash before season-start payroll (when payroll applies) or in-season start. */
  openingCash: number;
  /** Payroll at hire (Season 1) or season-start payroll deduction (Season 2+), when applicable. */
  wagesPaid: number;
  /** Voluntary layoff severance settled at season start, if present. */
  severancePaid: number;
  /** Same as {@link SeasonCashBridge.netOperatingCash}: client net after solution spend and post-season reach cash. */
  cashFlowFromOperations: number;
  closingCash: number;
  /** Non-zero if other EUR movements (or rounding) prevent a perfect tie-out. */
  reconciliationGap: number;
};

function initialEndowmentEur(save: NewGamePayload): number {
  if (save.initialResources) return save.initialResources.eur;
  const build = STARTING_BUILD_STATS[save.buildId] ?? STARTING_BUILD_STATS.portfolio_pivot;
  return applySpouseAtStart(build, save.spouseType).eur;
}

/**
 * Cash flow for the season summary: opening → wages → net operating cash (matches operating summary) → closing.
 * Season 1 opening is explicit starting wealth (endowment + spouse). Season 2+ opening is cash before payroll at season start when payroll is modelled, else cash at in-season start.
 */
export function computeSeasonCashFlow(save: NewGamePayload, seasonKey: string): SeasonCashFlow {
  const bridge = computeSeasonCashBridge(save, seasonKey);
  const seasonNum = Number(seasonKey);
  const { closingCash, netOperatingCash } = bridge;
  const cashBeforeSeasonStartCosts = closingCash - netOperatingCash;

  let openingCash: number;
  let wagesPaid: number;
  let severancePaid = 0;

  if (seasonNum === 1) {
    openingCash = initialEndowmentEur(save);
    wagesPaid = 0;
  } else {
    const payrollPaid = save.payrollPaidBySeason?.[seasonKey] === true;
    const activeEmployees = (save.employees ?? []).filter((e) => e.seasonHired <= seasonNum);
    wagesPaid = payrollPaid ? activeEmployees.reduce((s, e) => s + e.salary, 0) : 0;
    severancePaid = payrollPaid ? (save.seasonCashAdjustmentsBySeason?.[seasonKey]?.severancePaid ?? 0) : 0;

    openingCash = payrollPaid
      ? cashBeforeSeasonStartCosts + wagesPaid + severancePaid
      : cashBeforeSeasonStartCosts;
  }

  const impliedClosing = openingCash - wagesPaid - severancePaid + netOperatingCash;
  const reconciliationGap = closingCash - impliedClosing;

  return {
    openingCash,
    wagesPaid,
    severancePaid,
    cashFlowFromOperations: netOperatingCash,
    closingCash,
    reconciliationGap,
  };
}

/** Sum of Season 2 tranche budgets (expected future receipt) for clients in this season’s queue — not revenue until recognized. */
export function computeFutureReceivablesForLoop(loop: SeasonLoopState): number {
  return loop.clientsQueue.reduce((s, c) => s + Math.max(0, c.budgetSeason2), 0);
}

export type SeasonStatGains = {
  reputation: number;
  visibility: number;
};

export function computeSeasonPostSeasonStatGains(save: NewGamePayload, seasonKey: string): SeasonStatGains {
  let reputation = 0;
  let visibility = 0;
  for (const e of collectPostSeasonLedger(save)) {
    if (e.seasonKey !== seasonKey) continue;
    reputation += e.reputationDelta;
    visibility += e.visibilityGain;
  }
  return { reputation, visibility };
}

export type SeasonScenarioAverages = {
  count: number;
  avgReach: number;
  avgEffectiveness: number;
  avgSatisfaction: number;
};

export function computeSeasonScenarioAverages(loop: SeasonLoopState | undefined): SeasonScenarioAverages {
  if (!loop) return { count: 0, avgReach: 0, avgEffectiveness: 0, avgSatisfaction: 0 };
  const vals: { r: number; e: number; s: number }[] = [];
  for (const run of loop.runs) {
    if (!run.accepted || run.solutionId === "reject" || !run.outcome) continue;
    vals.push({
      r: run.outcome.messageSpread,
      e: run.outcome.messageEffectiveness,
      s: run.outcome.satisfaction,
    });
  }
  if (vals.length === 0) return { count: 0, avgReach: 0, avgEffectiveness: 0, avgSatisfaction: 0 };
  const n = vals.length;
  const sum = vals.reduce(
    (a, v) => ({ r: a.r + v.r, e: a.e + v.e, s: a.s + v.s }),
    { r: 0, e: 0, s: 0 }
  );
  return {
    count: n,
    avgReach: Math.round((sum.r / n) * 10) / 10,
    avgEffectiveness: Math.round((sum.e / n) * 10) / 10,
    avgSatisfaction: Math.round((sum.s / n) * 10) / 10,
  };
}

export function totalCumulativeSalaries(save: NewGamePayload): number {
  return (save.employees ?? []).reduce((s, e) => s + e.salary, 0);
}

/**
 * Legacy snapshot: total salaries vs cash (no receivables / payables).
 * For gating and UI, use `liquidityEur` / `hasLayoffPressure` in `payablesReceivables.ts` — see `docs/AGENCY_FINANCE.md`.
 */
export type PayrollHeadsUp = {
  upcomingSeasonPayroll: number;
  cash: number;
  canCoverPayroll: boolean;
  /** How much cash is missing to cover payroll, or 0 if none. */
  shortfall: number;
  employeeCount: number;
};

export function computePayrollHeadsUp(save: NewGamePayload): PayrollHeadsUp {
  const employees = save.employees ?? [];
  const upcomingSeasonPayroll = employees.reduce((s, e) => s + e.salary, 0);
  const cash = save.resources.eur;
  const shortfall = Math.max(0, upcomingSeasonPayroll - cash);
  return {
    upcomingSeasonPayroll,
    cash,
    canCoverPayroll: shortfall === 0,
    shortfall,
    employeeCount: employees.length,
  };
}
