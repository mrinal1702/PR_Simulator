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
export function getPendingReceivablesEur(save: NewGamePayload): number {
  if (save.seasonNumber <= 1 && save.phase === "preseason") return 0;
  if (save.phase === "preseason" && save.seasonNumber >= 2) {
    return sumReceivablesFromLoop(save, String(save.seasonNumber - 1));
  }
  if (save.phase === "postseason") {
    return sumReceivablesFromLoop(save, String(save.seasonNumber));
  }
  return 0;
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
