import type { NewGamePayload } from "@/components/NewGameWizard";
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
 * Payroll vs cash before next season’s payroll checkpoint.
 * Aligns with `docs/PAYROLL_AND_LAYOFF_RULES.md`: roster must be affordable for **upcoming season** payroll;
 * if cash (after known inflows you model elsewhere) is below total payroll, forced layoffs may be required at resolution.
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
