import type { NewGamePayload } from "@/components/NewGameWizard";
import type { PayableLine } from "@/lib/payablesReceivables";
import { wageLineId } from "@/lib/payablesReceivables";

const SAVE_KEY = "dma-save-slot";

/**
 * Legacy saves deducted salary at hire; new model accrues payables and settles at season start.
 * Rebuild wage payables and refund that cash once.
 */
function migratePayablesModel(payload: NewGamePayload): NewGamePayload {
  if (payload.payablesLines !== undefined) return payload;
  const employees = payload.employees ?? [];
  const lines: PayableLine[] = employees.map((e) => ({
    id: wageLineId(e.id),
    label: `${e.name} wage`,
    amount: e.salary,
  }));
  const refund = lines.reduce((s, l) => s + l.amount, 0);
  return {
    ...payload,
    payablesLines: lines,
    resources: {
      ...payload.resources,
      eur: payload.resources.eur + refund,
    },
  };
}

/** Merge `usedScenarioIds` with scenario IDs already present in season client queues (older saves). */
function mergeUsedScenarioIds(payload: NewGamePayload): NewGamePayload {
  const fromSave = new Set(payload.usedScenarioIds ?? []);
  for (const loop of Object.values(payload.seasonLoopBySeason ?? {})) {
    if (!loop?.clientsQueue) continue;
    for (const c of loop.clientsQueue) {
      if (c.scenarioId) fromSave.add(c.scenarioId);
    }
  }
  return { ...payload, usedScenarioIds: Array.from(fromSave) };
}

export function loadSave(): NewGamePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const localRaw = localStorage.getItem(SAVE_KEY);
    if (localRaw) return migratePayablesModel(mergeUsedScenarioIds(JSON.parse(localRaw) as NewGamePayload));
    const sessionRaw = sessionStorage.getItem(SAVE_KEY);
    if (!sessionRaw) return null;
    const parsed = JSON.parse(sessionRaw) as NewGamePayload;
    // Migrate old session-only saves to local storage.
    localStorage.setItem(SAVE_KEY, sessionRaw);
    return migratePayablesModel(mergeUsedScenarioIds(parsed));
  } catch {
    return null;
  }
}

export function persistSave(payload: NewGamePayload): boolean {
  if (typeof window === "undefined") return false;
  try {
    const json = JSON.stringify(payload);
    sessionStorage.setItem(SAVE_KEY, json);
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function getContinuePath(save: NewGamePayload | null): string {
  if (!save) return "/game/new";
  const season = Math.max(1, save.seasonNumber || 1);
  if (save.phase === "season") return `/game/season/${season}`;
  if (save.phase === "postseason") return `/game/postseason/${season}`;
  return `/game/preseason/${season}`;
}

