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
  const previousSeason = completedPostSeason;
  const employees = (save.employees ?? []).filter(
    (e) => !(e.role === "Intern" && e.seasonHired <= previousSeason)
  );
  const removedInterns = (save.employees ?? []).filter(
    (e) => e.role === "Intern" && e.seasonHired <= previousSeason
  );
  const removedInternComp = removedInterns.reduce((s, e) => s + e.competenceGain, 0);
  const removedInternVis = removedInterns.reduce((s, e) => s + e.visibilityGain, 0);
  const capFromEmployees = employees.reduce((s, e) => s + e.capacityGain, 0);
  const baseCap = save.initialResources?.firmCapacity ?? 50;
  const newCapacity = baseCap + capFromEmployees;

  if (already) {
    return {
      ...save,
      seasonNumber: nextSeason,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      employees,
      resources: {
        ...save.resources,
        competence: clampToScale(
          save.resources.competence - removedInternComp,
          METRIC_SCALES.competence
        ),
        visibility: clampToScale(
          save.resources.visibility - removedInternVis,
          METRIC_SCALES.visibility
        ),
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
    employees,
    preseasonEntrySpouseGrantSeasons: [...(save.preseasonEntrySpouseGrantSeasons ?? []), key],
    resources: {
      ...save.resources,
      eur: save.resources.eur + g.eur,
      competence: clampToScale(
        save.resources.competence - removedInternComp + g.competence,
        METRIC_SCALES.competence
      ),
      visibility: clampToScale(
        save.resources.visibility - removedInternVis + g.visibility,
        METRIC_SCALES.visibility
      ),
      firmCapacity: newCapacity,
    },
  };
}
