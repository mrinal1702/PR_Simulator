import type { NewGamePayload } from "@/components/NewGameWizard";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { benchmarkRawReputationToScoreSeason3 } from "@/lib/benchmarkSeason3Scores";
import { clampToScale, METRIC_SCALES } from "@/lib/metricScales";
import {
  competenceScoreForVariance,
  competenceScoreForVarianceSeason2,
  competenceScoreForVarianceSeason3,
  visibilityScoreForVariance,
  visibilityScoreForVarianceSeason2,
  visibilityScoreForVarianceSeason3,
} from "@/lib/solutionOutcomeMath";

/** Accrued obligations (wages, severance, future line items). Amounts are positive numbers. */
export type PayableLine = {
  id: string;
  label: string;
  amount: number;
};

export function totalPayables(save: NewGamePayload): number {
  return (save.payablesLines ?? []).reduce((s, l) => s + l.amount, 0);
}

/** Guaranteed follow-up cash from accepted clients (next tranche), not yet credited to EUR. */
export function sumReceivablesFromLoop(save: NewGamePayload, seasonLoopKey: string): number {
  const loop = save.seasonLoopBySeason?.[seasonLoopKey];
  if (!loop) return 0;
  let sum = 0;
  for (const run of loop.runs) {
    if (!run.accepted || run.solutionId === "reject") continue;
    const client = loop.clientsQueue.find((c) => c.id === run.clientId);
    if (client) sum += Math.max(0, client.budgetSeason2);
  }
  return sum;
}

/**
 * Which `seasonLoopBySeason` key backs pending receivables, or null (e.g. pre-season 1 only).
 * - **Pre-season N (N≥2):** previous season’s loop — follow-up tranches (`budgetSeason2`) from clients you
 *   already accepted count **before** you open any new-season case.
 * - **In-season:** current season’s loop — receivables update when a campaign is **committed** (non-reject).
 * - **Post-season:** current season’s loop.
 */
export function getReceivableLoopKey(save: NewGamePayload): string | null {
  if (save.seasonNumber <= 1 && save.phase === "preseason") return null;
  if (save.phase === "season") {
    return String(save.seasonNumber);
  }
  if (save.phase === "preseason" && save.seasonNumber >= 2) {
    return String(save.seasonNumber - 1);
  }
  if (save.phase === "postseason") {
    return String(save.seasonNumber);
  }
  return null;
}

export function getPendingReceivablesEur(save: NewGamePayload): number {
  const key = getReceivableLoopKey(save);
  if (!key) return 0;
  return sumReceivablesFromLoop(save, key);
}

/** One row per accepted client with a positive Season 2 tranche (for breakdown UI). */
export function getReceivableLineItems(save: NewGamePayload): { label: string; amount: number }[] {
  const key = getReceivableLoopKey(save);
  if (!key) return [];
  const loop = save.seasonLoopBySeason?.[key];
  if (!loop) return [];
  const out: { label: string; amount: number }[] = [];
  for (const run of loop.runs) {
    if (!run.accepted || run.solutionId === "reject") continue;
    const client = loop.clientsQueue.find((c) => c.id === run.clientId);
    if (!client) continue;
    const amt = Math.max(0, client.budgetSeason2);
    if (amt <= 0) continue;
    out.push({
      label: `${client.displayName} — ${client.scenarioTitle}`,
      amount: amt,
    });
  }
  return out;
}

/** Cash + guaranteed receivables − payables (all EUR). */
export function liquidityEur(save: NewGamePayload): number {
  return save.resources.eur + getPendingReceivablesEur(save) - totalPayables(save);
}

export function hasLayoffPressure(save: NewGamePayload): boolean {
  return liquidityEur(save) < 0;
}

export function wageLineId(employeeId: string): string {
  return `wage-${employeeId}`;
}

export function severanceLineId(employeeId: string): string {
  return `severance-${employeeId}`;
}

export function settlePreseasonAndEnterSeason(save: NewGamePayload, seasonKey: string): NewGamePayload {
  const r = getPendingReceivablesEur(save);
  const p = totalPayables(save);
  const wagesSettledNow = (save.payablesLines ?? [])
    .filter((l) => l.id.startsWith("wage-"))
    .reduce((s, l) => s + l.amount, 0);
  const nextEur = save.resources.eur + r - p;
  const payrollPaidBySeason =
    Number.parseInt(seasonKey, 10) >= 2
      ? { ...(save.payrollPaidBySeason ?? {}), [seasonKey]: true }
      : save.payrollPaidBySeason;

  const seasonNum = Number.parseInt(seasonKey, 10);
  const vis = getEffectiveVisibilityForAgency(save);
  const comp = getEffectiveCompetenceForAgency(save);
  const vScore =
    seasonNum >= 3
      ? visibilityScoreForVarianceSeason3(vis)
      : seasonNum === 2
        ? visibilityScoreForVarianceSeason2(vis)
        : visibilityScoreForVariance(vis);
  const cScore =
    seasonNum >= 3
      ? competenceScoreForVarianceSeason3(comp)
      : seasonNum === 2
        ? competenceScoreForVarianceSeason2(comp)
        : competenceScoreForVariance(comp);
  const repRaw = clampToScale(save.reputation ?? 5, METRIC_SCALES.reputation);
  const entryScores =
    seasonNum >= 3
      ? { vScore, cScore, rScore: benchmarkRawReputationToScoreSeason3(repRaw) }
      : { vScore, cScore };

  return {
    ...save,
    phase: "season",
    seasonNumber: seasonNum,
    resources: {
      ...save.resources,
      eur: Math.max(0, nextEur),
    },
    payablesLines: [],
    cumulativeWagesPaidEur: (save.cumulativeWagesPaidEur ?? 0) + wagesSettledNow,
    payrollPaidBySeason,
    seasonEntryScoresBySeason: {
      ...(save.seasonEntryScoresBySeason ?? {}),
      [seasonKey]: entryScores,
    },
    preseasonSalaryNegotiationV3: undefined,
  };
}
