import type { NewGamePayload } from "@/components/NewGameWizard";

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
 * Receivables shown in UI: not in pre-season 1; after that, from the last completed season's queue.
 */
/**
 * Season loop key for pending receivables, or null if none shown (e.g. pre-season 1 only).
 * During **in-season** play, uses the **current** season’s queue so receivables update as soon as
 * a client is accepted (non-reject). Post-season and pre-season 2+ use the same loop rules as before.
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
  const nextEur = save.resources.eur + r - p;
  const payrollPaidBySeason =
    Number.parseInt(seasonKey, 10) >= 2
      ? { ...(save.payrollPaidBySeason ?? {}), [seasonKey]: true }
      : save.payrollPaidBySeason;

  return {
    ...save,
    phase: "season",
    seasonNumber: Number.parseInt(seasonKey, 10),
    resources: {
      ...save.resources,
      eur: Math.max(0, nextEur),
    },
    payablesLines: [],
    payrollPaidBySeason,
  };
}
