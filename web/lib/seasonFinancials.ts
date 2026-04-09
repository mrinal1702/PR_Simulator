import type { NewGamePayload } from "@/components/NewGameWizard";
import { applySpouseAtStart, STARTING_BUILD_STATS } from "@/lib/gameEconomy";
import { computeSeasonLedger } from "@/lib/metricBreakdown";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";
import type { SeasonLoopState } from "@/lib/seasonClientLoop";

export type SeasonCashBridge = {
  openingCash: number;
  closingCash: number;
  /** Sum of Season 1 client budgets for executed campaigns. */
  revenue: number;
  /** Sum of solution EUR costs for those campaigns (not including post-season reach boosts). */
  campaignCost: number;
  /** Same as revenue − campaignCost; cash retained from client work before post-season extras. */
  netClientReceipts: number;
  postSeasonReachSpend: number;
  /** Net client receipts minus post-season reach cash out (this season’s operating cash items). */
  netOperatingCash: number;
};

/**
 * Operating cash bridge for a season: opening is derived so that
 * opening + netClientReceipts − postSeasonReachSpend = closing (for the flows we model here).
 * Season 2+ uses the same logic; closing cash is whatever the save has after prior seasons.
 */
export function computeSeasonCashBridge(save: NewGamePayload, seasonKey: string): SeasonCashBridge {
  const ledger = computeSeasonLedger(save, seasonKey);
  const postSeasonReachSpend = collectPostSeasonLedger(save)
    .filter((e) => e.seasonKey === seasonKey)
    .reduce((s, e) => s + e.eurSpentOnReachBoost, 0);
  const closingCash = save.resources.eur;
  const revenue = ledger.revenueClientBudgets;
  const campaignCost = ledger.campaignCostEur;
  const netClientReceipts = ledger.eurNet;
  const netOperatingCash = netClientReceipts - postSeasonReachSpend;
  const openingCash = closingCash - netClientReceipts + postSeasonReachSpend;
  return {
    openingCash,
    closingCash,
    revenue,
    campaignCost,
    netClientReceipts,
    postSeasonReachSpend,
    netOperatingCash,
  };
}

export type SeasonCashFlow = {
  /** Cash before wages shown below: Season 1 = build endowment + spouse; Season 2+ = cash before season-start payroll (when payroll applies) or in-season start. */
  openingCash: number;
  /** Payroll at hire (Season 1) or season-start payroll deduction (Season 2+), when applicable. */
  wagesPaid: number;
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
  const employees = save.employees ?? [];
  const { netClientReceipts, postSeasonReachSpend, closingCash, netOperatingCash } = bridge;
  const cashAfterPayrollAtInSeasonStart = closingCash - netClientReceipts + postSeasonReachSpend;

  let openingCash: number;
  let wagesPaid: number;

  if (seasonNum === 1) {
    openingCash = initialEndowmentEur(save);
    wagesPaid = employees.filter((e) => e.seasonHired === 1).reduce((s, e) => s + e.salary, 0);
  } else {
    const payrollPaid = save.payrollPaidBySeason?.[seasonKey] === true;
    wagesPaid =
      payrollPaid && seasonNum >= 2
        ? employees.filter((e) => e.seasonHired <= seasonNum).reduce((s, e) => s + e.salary, 0)
        : 0;
    openingCash = payrollPaid ? cashAfterPayrollAtInSeasonStart + wagesPaid : cashAfterPayrollAtInSeasonStart;
  }

  const impliedClosing = openingCash - wagesPaid + netOperatingCash;
  const reconciliationGap = closingCash - impliedClosing;

  return {
    openingCash,
    wagesPaid,
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
