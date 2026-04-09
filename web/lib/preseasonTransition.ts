import type { NewGamePayload } from "@/components/NewGameWizard";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import {
  employeeTotalCapacityContribution,
  tenureCapacityIncrementFromProductivity,
} from "@/lib/tenureCapacity";

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
  const employeesWithTenure = employees.map((e) => {
    if (e.role === "Intern") return e;
    const prod = e.productivityPct;
    if (prod == null) return e;
    const seasonsWithFirm = nextSeason - e.seasonHired;
    const inc = tenureCapacityIncrementFromProductivity(prod, seasonsWithFirm);
    if (inc <= 0) return e;
    return { ...e, tenureCapacityBonus: (e.tenureCapacityBonus ?? 0) + inc };
  });
  const capFromEmployees = employeesWithTenure.reduce((s, e) => s + employeeTotalCapacityContribution(e), 0);
  const baseCap = save.initialResources?.firmCapacity ?? 50;
  const newCapacity = baseCap + capFromEmployees;

  if (already) {
    return {
      ...save,
      seasonNumber: nextSeason,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      employees: employeesWithTenure,
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
    employees: employeesWithTenure,
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
