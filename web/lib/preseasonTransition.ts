import type { NewGamePayload } from "@/components/NewGameWizard";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";

/**
 * Leaving post-season → next pre-season: apply end-of-season spouse support, reset firm capacity
 * to base + employees, advance season and phase. Idempotent per target pre-season season key.
 */
export function enterNextPreseason(save: NewGamePayload, completedPostSeason: number): NewGamePayload {
  const nextSeason = completedPostSeason + 1;
  const key = String(nextSeason);
  const already = save.preseasonEntrySpouseGrantSeasons?.includes(key);
  const employees = save.employees ?? [];
  const capFromEmployees = employees.reduce((s, e) => s + e.capacityGain, 0);
  const baseCap = save.initialResources?.firmCapacity ?? 50;
  const newCapacity = baseCap + capFromEmployees;

  if (already) {
    return {
      ...save,
      seasonNumber: nextSeason,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      resources: {
        ...save.resources,
        firmCapacity: newCapacity,
      },
    };
  }

  const g = seasonSpouseGrants(save.spouseType);

  return {
    ...save,
    seasonNumber: nextSeason,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    preseasonEntrySpouseGrantSeasons: [...(save.preseasonEntrySpouseGrantSeasons ?? []), key],
    resources: {
      ...save.resources,
      eur: save.resources.eur + g.eur,
      competence: clampToScale(save.resources.competence + g.competence, METRIC_SCALES.competence),
      visibility: clampToScale(save.resources.visibility + g.visibility, METRIC_SCALES.visibility),
      firmCapacity: newCapacity,
    },
  };
}
