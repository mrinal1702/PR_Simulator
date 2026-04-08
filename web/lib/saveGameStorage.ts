import type { NewGamePayload } from "@/components/NewGameWizard";

const SAVE_KEY = "dma-save-slot";

export function loadSave(): NewGamePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const localRaw = localStorage.getItem(SAVE_KEY);
    if (localRaw) return JSON.parse(localRaw) as NewGamePayload;
    const sessionRaw = sessionStorage.getItem(SAVE_KEY);
    if (!sessionRaw) return null;
    const parsed = JSON.parse(sessionRaw) as NewGamePayload;
    // Migrate old session-only saves to local storage.
    localStorage.setItem(SAVE_KEY, sessionRaw);
    return parsed;
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

