import type { NewGamePayload } from "@/components/NewGameWizard";
import type { BuildStats } from "@/lib/gameEconomy";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";

export type BreakdownMetric = "eur" | "visibility" | "competence" | "firmCapacity" | "reputation";

/** Net EUR from Season 1 client work and capacity spent on campaigns (executed solutions only). */
export function computeSeason1Ledger(save: NewGamePayload): { eurNet: number; capacityUsed: number } {
  const loop = save.seasonLoopBySeason?.["1"];
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

export function buildMetricBreakdown(metric: BreakdownMetric, save: NewGamePayload): Array<{ label: string; value: number }> {
  const employees = save.employees ?? [];
  const baseResources: BuildStats = save.initialResources ?? estimateBaseResources(save);
  const baseReputation = save.initialReputation ?? 5;
  const focusComp = (save.preseasonFocusCounts?.strategy_workshop ?? 0) * 10;
  const focusVis = (save.preseasonFocusCounts?.network ?? 0) * 10;
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
      { label: "Pre-Season Focus", value: focusVis },
      { label: "Employees", value: employeeVis },
    ],
    competence: [
      { label: "Pre-Season Start", value: baseResources.competence },
      { label: "Pre-Season Focus", value: focusComp },
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
  const focusComp = (save.preseasonFocusCounts?.strategy_workshop ?? 0) * 10;
  const focusVis = (save.preseasonFocusCounts?.network ?? 0) * 10;
  const s1 = computeSeason1Ledger(save);
  const postSeason = collectPostSeasonLedger(save);
  const postVisSum = postSeason.reduce((s, e) => s + e.visibilityGain, 0);
  const postEurSum = postSeason.reduce((s, e) => s + e.eurSpentOnReachBoost, 0);
  const postCapSum = postSeason.reduce((s, e) => s + e.capacitySpentOnEffectivenessBoost, 0);
  return {
    eur: save.resources.eur + employeeCost - s1.eurNet + postEurSum,
    visibility: save.resources.visibility - focusVis - employeeVis - postVisSum,
    competence: save.resources.competence - focusComp - employeeComp,
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
