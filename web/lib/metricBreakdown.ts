import type { NewGamePayload } from "@/components/NewGameWizard";
import type { BuildStats } from "@/lib/gameEconomy";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { computePreseasonFocusTotals } from "@/lib/preseasonFocus";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";

export type BreakdownMetric = "eur" | "visibility" | "competence" | "firmCapacity" | "reputation";

/** Net EUR and capacity from client work for a season (executed solutions only). Uses each client’s Season 1 tranche as the in-season liquid for that campaign. */
export function computeSeasonLedger(save: NewGamePayload, seasonKey: string): { eurNet: number; capacityUsed: number } {
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) return { eurNet: 0, capacityUsed: 0 };
  let eurNet = 0;
  let capacityUsed = 0;
  for (const r of loop.runs) {
    if (r.solutionId === "pending") continue;
    if (!r.accepted || r.solutionId === "reject") continue;
    if (r.costBudget == null) continue;
    const client = loop.clientsQueue.find((c) => c.id === r.clientId);
    if (!client) continue;
    eurNet += client.budgetSeason1 - r.costBudget;
    if (r.costCapacity != null) capacityUsed += r.costCapacity;
  }
  return { eurNet, capacityUsed };
}

/** @deprecated Use {@link computeSeasonLedger}(save, "1") — kept for call sites. */
export function computeSeason1Ledger(save: NewGamePayload): { eurNet: number; capacityUsed: number } {
  return computeSeasonLedger(save, "1");
}

export type Season1CaseLogEntry = {
  clientId: string;
  scenarioTitle: string;
  problemSummary: string;
  decisionLabel: string;
  costBudget: number;
  costCapacity: number;
  /** Season 1 liquid retained: client Season 1 budget minus solution spend (0 if rejected). */
  moneyEarned: number;
};

/** Completed Season 1 cases only (local save), in queue order — blueprint for later seasons. */
export function buildSeason1CaseLog(save: NewGamePayload): Season1CaseLogEntry[] {
  const loop = save.seasonLoopBySeason?.["1"];
  if (!loop) return [];
  const out: Season1CaseLogEntry[] = [];
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

/** Season 2+ pre-season: ledger without prior season client lines; agency “starting” rows separate from roster. */
export function useSimplifiedPreseasonLedger(save: NewGamePayload): boolean {
  return save.seasonNumber >= 2 && save.phase === "preseason";
}

function buildSimplifiedPreseasonBreakdown(
  metric: BreakdownMetric,
  save: NewGamePayload
): Array<{ label: string; value: number }> {
  const employees = save.employees ?? [];
  const baseResources: BuildStats = save.initialResources ?? estimateBaseResources(save);
  const baseReputation = save.initialReputation ?? 5;
  const g = seasonSpouseGrants(save.spouseType);
  const grantApplied = save.preseasonEntrySpouseGrantSeasons?.includes(String(save.seasonNumber)) ?? false;
  const salarySum = employees.reduce((s, e) => s + e.salary, 0);
  const employeeVis = employees.reduce((s, e) => s + e.visibilityGain, 0);
  const employeeComp = employees.reduce((s, e) => s + e.competenceGain, 0);
  const employeeCap = employees.reduce((s, e) => s + e.capacityGain, 0);
  const focus = computePreseasonFocusTotals(save);
  const postSeason = collectPostSeasonLedger(save);
  const postRepSum = postSeason.reduce((s, e) => s + e.reputationDelta, 0);

  const startingWealth = grantApplied ? save.resources.eur - g.eur + salarySum : save.resources.eur + salarySum;
  const startingVis =
    (grantApplied ? save.resources.visibility - g.visibility - employeeVis : save.resources.visibility - employeeVis) -
    focus.visibility;
  const startingComp =
    (grantApplied ? save.resources.competence - g.competence - employeeComp : save.resources.competence - employeeComp) -
    focus.competence;
  const startingCap = baseResources.firmCapacity;

  const linesByMetric: Record<BreakdownMetric, Array<{ label: string; value: number }>> = {
    eur: [{ label: "Starting wealth", value: startingWealth }],
    visibility: [{ label: "Starting visibility", value: startingVis }],
    competence: [{ label: "Starting competence", value: startingComp }],
    firmCapacity: [{ label: "Starting capacity", value: startingCap }],
    reputation: [{ label: "Starting reputation", value: baseReputation }],
  };

  if (grantApplied && (g.eur !== 0 || g.competence !== 0 || g.visibility !== 0)) {
    if (g.eur !== 0) linesByMetric.eur.push({ label: `Spouse support (entering Season ${save.seasonNumber})`, value: g.eur });
    if (g.competence !== 0) linesByMetric.competence.push({ label: `Spouse support (entering Season ${save.seasonNumber})`, value: g.competence });
    if (g.visibility !== 0) linesByMetric.visibility.push({ label: `Spouse support (entering Season ${save.seasonNumber})`, value: g.visibility });
  }

  if (focus.competence !== 0) {
    linesByMetric.competence.push({ label: "Pre-season focus (all seasons)", value: focus.competence });
  }
  if (focus.visibility !== 0) {
    linesByMetric.visibility.push({ label: "Pre-season focus (all seasons)", value: focus.visibility });
  }

  if (salarySum !== 0) {
    linesByMetric.eur.push({ label: "Employees (payroll at hire)", value: -salarySum });
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

  return linesByMetric[metric].filter((l, idx) => idx === 0 || l.value !== 0);
}

export function buildMetricBreakdown(metric: BreakdownMetric, save: NewGamePayload): Array<{ label: string; value: number }> {
  if (useSimplifiedPreseasonLedger(save)) {
    return buildSimplifiedPreseasonBreakdown(metric, save);
  }

  const employees = save.employees ?? [];
  const baseResources: BuildStats = save.initialResources ?? estimateBaseResources(save);
  const baseReputation = save.initialReputation ?? 5;
  const focus = computePreseasonFocusTotals(save);
  const employeeVis = employees.reduce((s, e) => s + e.visibilityGain, 0);
  const employeeComp = employees.reduce((s, e) => s + e.competenceGain, 0);
  const employeeCap = employees.reduce((s, e) => s + e.capacityGain, 0);
  const employeeCost = employees.reduce((s, e) => s + e.salary, 0);
  const s1 = computeSeason1Ledger(save);
  const postSeason = collectPostSeasonLedger(save);

  const linesByMetric: Record<BreakdownMetric, Array<{ label: string; value: number }>> = {
    eur: [
      { label: "Pre-Season Start", value: baseResources.eur },
      { label: "Employees", value: -employeeCost },
    ],
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
  };

  if (s1.eurNet !== 0) {
    linesByMetric.eur.push({ label: "Season 1 engagements (net)", value: s1.eurNet });
  }
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
    if (e.eurSpentOnReachBoost !== 0) {
      linesByMetric.eur.push({
        label: `Post-season reach boost — ${e.scenarioTitle}`,
        value: -e.eurSpentOnReachBoost,
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
  const employeeCap = employees.reduce((s, e) => s + e.capacityGain, 0);
  const employeeCost = employees.reduce((s, e) => s + e.salary, 0);
  const focus = computePreseasonFocusTotals(save);
  const s1 = computeSeason1Ledger(save);
  const postSeason = collectPostSeasonLedger(save);
  const postVisSum = postSeason.reduce((s, e) => s + e.visibilityGain, 0);
  const postEurSum = postSeason.reduce((s, e) => s + e.eurSpentOnReachBoost, 0);
  const postCapSum = postSeason.reduce((s, e) => s + e.capacitySpentOnEffectivenessBoost, 0);
  return {
    eur: save.resources.eur + employeeCost - s1.eurNet + postEurSum,
    visibility: save.resources.visibility - focus.visibility - employeeVis - postVisSum,
    competence: save.resources.competence - focus.competence - employeeComp,
    firmCapacity: save.resources.firmCapacity - employeeCap + s1.capacityUsed + postCapSum,
  };
}

export function formatSigned(metric: BreakdownMetric, value: number): string {
  if (metric === "eur") {
    const sign = value > 0 ? "+" : "";
    return `${sign}EUR ${value.toLocaleString("en-GB")}`;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}`;
}
