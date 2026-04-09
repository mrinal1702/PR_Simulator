import type { NewGamePayload } from "@/components/NewGameWizard";

export type PreseasonFocusId = "strategy_workshop" | "network";

/** Stat points for the chosen focus in this pre-season (10 baseline; 15 when doubling down on last season’s track). */
export function getPreseasonFocusDeltaForSeason(
  season: number,
  focus: PreseasonFocusId,
  save: NewGamePayload
): number {
  if (season <= 1) return 10;
  const prevFocus = save.preseasonActionBySeason?.[String(season - 1)];
  if (!prevFocus) return 10;
  return focus === prevFocus ? 15 : 10;
}

export function computePreseasonFocusTotals(save: NewGamePayload): { competence: number; visibility: number } {
  let competence = 0;
  let visibility = 0;
  const entries = Object.entries(save.preseasonActionBySeason ?? {})
    .map(([k, v]) => ({ season: Number(k), focus: v as PreseasonFocusId }))
    .filter((e) => e.focus && Number.isFinite(e.season))
    .sort((a, b) => a.season - b.season);
  for (const { season, focus } of entries) {
    const d = getPreseasonFocusDeltaForSeason(season, focus, save);
    if (focus === "strategy_workshop") competence += d;
    else visibility += d;
  }
  return { competence, visibility };
}

export function getPreseasonFocusCardCopy(
  season: number,
  focus: PreseasonFocusId,
  save: NewGamePayload
): { title: string; subtitle: string } {
  const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
  if (focus === "strategy_workshop") {
    return {
      title: delta >= 15 ? "Advanced strategy intensive" : "Strategy workshop",
      subtitle: `Improve competence by ${delta}`,
    };
  }
  return {
    title: delta >= 15 ? "Industry circle" : "Network",
    subtitle: `Improve visibility by ${delta}`,
  };
}
