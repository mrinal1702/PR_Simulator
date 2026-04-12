import type { NewGamePayload } from "@/components/NewGameWizard";
import type { BuildStats } from "@/lib/gameEconomy";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { computePreseasonFocusTotals } from "@/lib/preseasonFocus";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";
import { employeeTotalCapacityContribution } from "@/lib/tenureCapacity";
import {
  getPendingReceivablesEur,
  getReceivableLineItems,
  liquidityEur,
  totalPayables,
} from "@/lib/payablesReceivables";

export type BreakdownMetric =
  | "eur"
  | "payables"
  | "receivables"
  | "visibility"
  | "competence"
  | "firmCapacity"
  | "reputation";

/** Rows in the wealth modal: cash activity first, then Payables / Receivables totals, then liquidity. */
export type BreakdownLineKind =
  | "normal"
  | "heading"
  | "payablesTotal"
  | "receivablesTotal"
  | "liquidity";

export type BreakdownLine = {
  label: string;
  value: number;
  kind?: BreakdownLineKind;
};

/** Net EUR and capacity from client work for a season (executed solutions only). Uses each client’s Season 1 tranche as the in-season liquid for that campaign. */
export function computeSeasonLedger(
  save: NewGamePayload,
  seasonKey: string
): {
  eurNet: number;
  capacityUsed: number;
  /** Sum of clients’ Season 1 tranches for executed campaigns. */
  revenueClientBudgets: number;
  /** Sum of solution EUR costs for those campaigns (excludes post-season reach spend). */
  campaignCostEur: number;
} {
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) {
    return { eurNet: 0, capacityUsed: 0, revenueClientBudgets: 0, campaignCostEur: 0 };
  }
  let eurNet = 0;
  let capacityUsed = 0;
  let revenueClientBudgets = 0;
  let campaignCostEur = 0;
  for (const r of loop.runs) {
    if (r.solutionId === "pending") continue;
    if (!r.accepted || r.solutionId === "reject") continue;
    if (r.costBudget == null) continue;
    const client = loop.clientsQueue.find((c) => c.id === r.clientId);
    if (!client) continue;
    revenueClientBudgets += client.budgetSeason1;
    campaignCostEur += r.costBudget;
    eurNet += client.budgetSeason1 - r.costBudget;
    if (r.costCapacity != null) capacityUsed += r.costCapacity;
  }
  return { eurNet, capacityUsed, revenueClientBudgets, campaignCostEur };
}

/** @deprecated Use {@link computeSeasonLedger}(save, "1") — kept for call sites. */
export function computeSeason1Ledger(save: NewGamePayload): { eurNet: number; capacityUsed: number } {
  return computeSeasonLedger(save, "1");
}

export type SeasonCaseLogEntry = {
  clientId: string;
  scenarioTitle: string;
  problemSummary: string;
  decisionLabel: string;
  costBudget: number;
  costCapacity: number;
  /** Season 1 liquid retained: client Season 1 budget minus solution spend (0 if rejected). */
  moneyEarned: number;
};

/** Completed cases for a single in-season queue only; excludes prior-season rollover reviews. */
export function buildSeasonCaseLog(save: NewGamePayload, seasonKey: string): SeasonCaseLogEntry[] {
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) return [];
  const out: SeasonCaseLogEntry[] = [];
  for (const r of loop.runs) {
    const client = loop.clientsQueue.find((c) => c.id === r.clientId);
    if (!client) continue;
    if (r.solutionId === "pending") continue;
    if (!r.accepted || r.solutionId === "reject") {
      out.push({
        clientId: r.clientId,
        scenarioTitle: client.scenarioTitle,
        problemSummary: client.problem,
        decisionLabel: "Rejected client",
        costBudget: 0,
        costCapacity: 0,
        moneyEarned: 0,
      });
      continue;
    }
    const cb = r.costBudget ?? 0;
    const cc = r.costCapacity ?? 0;
    out.push({
      clientId: r.clientId,
      scenarioTitle: client.scenarioTitle,
      problemSummary: client.problem,
      decisionLabel: r.solutionTitle ?? r.solutionId,
      costBudget: cb,
      costCapacity: cc,
      moneyEarned: client.budgetSeason1 - cb,
    });
  }
  return out;
}

/** Completed Season 1 cases only (local save), in queue order — kept for call sites. */
export function buildSeason1CaseLog(save: NewGamePayload): SeasonCaseLogEntry[] {
  return buildSeasonCaseLog(save, "1");
}

/** Season 2+ pre-season: ledger without prior season client lines; agency “starting” rows separate from roster. */
export function useSimplifiedPreseasonLedger(save: NewGamePayload): boolean {
  return save.seasonNumber >= 2 && save.phase === "preseason";
}

function appendPayablesReceivablesSection(lines: BreakdownLine[], save: NewGamePayload): void {
  lines.push({ label: "Payables", value: 0, kind: "heading" });
  lines.push({ label: "Total payables", value: totalPayables(save), kind: "payablesTotal" });
  lines.push({ label: "Receivables", value: 0, kind: "heading" });
  lines.push({ label: "Total receivables", value: getPendingReceivablesEur(save), kind: "receivablesTotal" });
  lines.push({
    label: "Liquidity (cash + receivables − payables)",
    value: liquidityEur(save),
    kind: "liquidity",
  });
}

function filterCashEurLines(lines: BreakdownLine[]): BreakdownLine[] {
  let seenHeading = false;
  let cashIndex = 0;
  return lines.filter((l) => {
    if (l.kind === "heading" || l.kind === "payablesTotal" || l.kind === "receivablesTotal" || l.kind === "liquidity") {
      seenHeading = true;
      return true;
    }
    if (!seenHeading) {
      const keep = cashIndex === 0 || l.value !== 0;
      cashIndex += 1;
      return keep;
    }
    return true;
  });
}

function buildSimplifiedPreseasonBreakdown(metric: BreakdownMetric, save: NewGamePayload): BreakdownLine[] {
  const employees = save.employees ?? [];
  const baseResources: BuildStats = save.initialResources ?? estimateBaseResources(save);
  const baseReputation = save.initialReputation ?? 5;
  const g = seasonSpouseGrants(save.spouseType);
  const grantApplied = save.preseasonEntrySpouseGrantSeasons?.includes(String(save.seasonNumber)) ?? false;
  const employeeVis = employees.reduce((s, e) => s + e.visibilityGain, 0);
  const employeeComp = employees.reduce((s, e) => s + e.competenceGain, 0);
  const employeeCap = employees.reduce((s, e) => s + employeeTotalCapacityContribution(e), 0);
  const focus = computePreseasonFocusTotals(save);
  const postSeason = collectPostSeasonLedger(save);
  const postRepSum = postSeason.reduce((s, e) => s + e.reputationDelta, 0);

  const startingVis =
    (grantApplied ? save.resources.visibility - g.visibility - employeeVis : save.resources.visibility - employeeVis) -
    focus.visibility;
  const startingComp =
    (grantApplied ? save.resources.competence - g.competence - employeeComp : save.resources.competence - employeeComp) -
    focus.competence;
  const startingCap = baseResources.firmCapacity;

  const eurCash: BreakdownLine[] = [{ label: "Cash on hand", value: save.resources.eur, kind: "normal" }];
  if (grantApplied && g.eur !== 0) {
    eurCash.push({
      label: `Spouse support (entering Season ${save.seasonNumber})`,
      value: g.eur,
      kind: "normal",
    });
  }
  appendPayablesReceivablesSection(eurCash, save);

  const linesByMetric: Record<BreakdownMetric, BreakdownLine[]> = {
    eur: filterCashEurLines(eurCash),
    visibility: [{ label: "Starting visibility", value: startingVis }],
    competence: [{ label: "Starting competence", value: startingComp }],
    firmCapacity: [{ label: "Starting capacity", value: startingCap }],
    reputation: [{ label: "Starting reputation", value: baseReputation }],
    payables: [],
    receivables: [],
  };

  if (grantApplied && (g.competence !== 0 || g.visibility !== 0)) {
    if (g.competence !== 0) {
      linesByMetric.competence.push({
        label: `Spouse support (entering Season ${save.seasonNumber})`,
        value: g.competence,
      });
    }
    if (g.visibility !== 0) {
      linesByMetric.visibility.push({
        label: `Spouse support (entering Season ${save.seasonNumber})`,
        value: g.visibility,
      });
    }
  }

  if (focus.competence !== 0) {
    linesByMetric.competence.push({ label: "Pre-season focus (all seasons)", value: focus.competence });
  }
  if (focus.visibility !== 0) {
    linesByMetric.visibility.push({ label: "Pre-season focus (all seasons)", value: focus.visibility });
  }

  if (employeeVis !== 0) {
    linesByMetric.visibility.push({ label: "Employees (current roster)", value: employeeVis });
  }
  if (employeeComp !== 0) {
    linesByMetric.competence.push({ label: "Employees (current roster)", value: employeeComp });
  }
  if (employeeCap !== 0) {
    linesByMetric.firmCapacity.push({ label: "Employees (current roster)", value: employeeCap });
  }

  for (const e of postSeason) {
    if (e.reputationDelta !== 0) {
      linesByMetric.reputation.push({
        label: `Post-season (Season ${e.seasonKey}) — ${e.scenarioTitle}`,
        value: e.reputationDelta,
      });
    }
  }

  const currentRep = save.reputation ?? 5;
  const remainder = currentRep - baseReputation - postRepSum;
  if (remainder !== 0) {
    linesByMetric.reputation.push({ label: "Layoffs and other adjustments", value: remainder });
  }

  if (metric === "eur") {
    return linesByMetric.eur;
  }
  return linesByMetric[metric].filter((l, idx) => idx === 0 || l.value !== 0);
}

export function metricBreakdownModalTitle(metric: BreakdownMetric): string {
  const titles: Record<BreakdownMetric, string> = {
    eur: "Wealth breakdown",
    payables: "Payables breakdown",
    receivables: "Receivables breakdown",
    visibility: "Visibility breakdown",
    competence: "Competence breakdown",
    firmCapacity: "Capacity breakdown",
    reputation: "Reputation breakdown",
  };
  return titles[metric];
}

export function buildMetricBreakdown(metric: BreakdownMetric, save: NewGamePayload): BreakdownLine[] {
  if (metric === "payables") {
    const lines = save.payablesLines ?? [];
    if (lines.length === 0) {
      return [{ label: "No current payables", value: 0 }];
    }
    return lines.map((pl) => ({ label: pl.label, value: pl.amount }));
  }
  if (metric === "receivables") {
    const items = getReceivableLineItems(save);
    if (items.length === 0) {
      return [{ label: "No receivables", value: 0 }];
    }
    return items.map((i) => ({ label: i.label, value: i.amount }));
  }

  if (useSimplifiedPreseasonLedger(save)) {
    return buildSimplifiedPreseasonBreakdown(metric, save);
  }

  const employees = save.employees ?? [];
  const baseResources: BuildStats = save.initialResources ?? estimateBaseResources(save);
  const baseReputation = save.initialReputation ?? 5;
  const focus = computePreseasonFocusTotals(save);
  const employeeVis = employees.reduce((s, e) => s + e.visibilityGain, 0);
  const employeeComp = employees.reduce((s, e) => s + e.competenceGain, 0);
  const employeeCap = employees.reduce((s, e) => s + employeeTotalCapacityContribution(e), 0);
  const s1 = computeSeason1Ledger(save);
  const postSeason = collectPostSeasonLedger(save);

  const eurCash: BreakdownLine[] = [{ label: "Pre-Season Start", value: baseResources.eur, kind: "normal" }];
  if (s1.eurNet !== 0) {
    eurCash.push({ label: "Season 1 engagements (net)", value: s1.eurNet, kind: "normal" });
  }
  for (const e of postSeason) {
    if (e.eurSpentOnReachBoost !== 0) {
      eurCash.push({
        label: `Post-season reach boost — ${e.scenarioTitle}`,
        value: -e.eurSpentOnReachBoost,
        kind: "normal",
      });
    }
  }
  appendPayablesReceivablesSection(eurCash, save);

  const linesByMetric: Record<BreakdownMetric, BreakdownLine[]> = {
    eur: filterCashEurLines(eurCash),
    visibility: [
      { label: "Pre-Season Start", value: baseResources.visibility },
      { label: "Pre-Season Focus", value: focus.visibility },
      { label: "Employees", value: employeeVis },
    ],
    competence: [
      { label: "Pre-Season Start", value: baseResources.competence },
      { label: "Pre-Season Focus", value: focus.competence },
      { label: "Employees", value: employeeComp },
    ],
    firmCapacity: [
      { label: "Pre-Season Start", value: baseResources.firmCapacity },
      { label: "Employees", value: employeeCap },
    ],
    reputation: [{ label: "Pre-Season Start", value: baseReputation }],
    payables: [],
    receivables: [],
  };

  if (s1.capacityUsed !== 0) {
    linesByMetric.firmCapacity.push({ label: "Season 1 campaign capacity used", value: -s1.capacityUsed });
  }

  for (const e of postSeason) {
    if (e.reputationDelta !== 0) {
      linesByMetric.reputation.push({
        label: `Post-season (Season ${e.seasonKey}) — ${e.scenarioTitle}`,
        value: e.reputationDelta,
      });
    }
    if (e.visibilityGain !== 0) {
      linesByMetric.visibility.push({
        label: `Post-season (Season ${e.seasonKey}) — ${e.scenarioTitle}`,
        value: e.visibilityGain,
      });
    }
    if (e.capacitySpentOnEffectivenessBoost !== 0) {
      linesByMetric.firmCapacity.push({
        label: `Post-season effectiveness boost — ${e.scenarioTitle}`,
        value: -e.capacitySpentOnEffectivenessBoost,
      });
    }
  }

  return linesByMetric[metric].filter((l, idx) => idx === 0 || l.value !== 0);
}

function estimateBaseResources(save: NewGamePayload): BuildStats {
  const employees = save.employees ?? [];
  const employeeVis = employees.reduce((s, e) => s + e.visibilityGain, 0);
  const employeeComp = employees.reduce((s, e) => s + e.competenceGain, 0);
  const employeeCap = employees.reduce((s, e) => s + employeeTotalCapacityContribution(e), 0);
  const payablesSum = totalPayables(save);
  const focus = computePreseasonFocusTotals(save);
  const s1 = computeSeason1Ledger(save);
  const postSeason = collectPostSeasonLedger(save);
  const postVisSum = postSeason.reduce((s, e) => s + e.visibilityGain, 0);
  const postEurSum = postSeason.reduce((s, e) => s + e.eurSpentOnReachBoost, 0);
  const postCapSum = postSeason.reduce((s, e) => s + e.capacitySpentOnEffectivenessBoost, 0);
  return {
    eur: save.resources.eur + payablesSum - s1.eurNet + postEurSum,
    visibility: save.resources.visibility - focus.visibility - employeeVis - postVisSum,
    competence: save.resources.competence - focus.competence - employeeComp,
    firmCapacity: save.resources.firmCapacity - employeeCap + s1.capacityUsed + postCapSum,
  };
}

export function formatSigned(metric: BreakdownMetric, value: number): string {
  if (metric === "payables" || metric === "receivables") {
    return `EUR ${value.toLocaleString("en-GB")}`;
  }
  if (metric === "eur") {
    const sign = value > 0 ? "+" : "";
    return `${sign}EUR ${value.toLocaleString("en-GB")}`;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}
