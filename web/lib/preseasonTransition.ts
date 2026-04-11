import type { NewGamePayload } from "@/components/NewGameWizard";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import { pickPreseasonEntrySpouseFlavorLine } from "@/lib/preseasonEntrySpouseCopy";
import type { PreseasonEntryRevealPending } from "@/lib/preseasonEntryReveal";
import {
  employeeTotalCapacityContribution,
  tenureCapacityIncrementFromProductivity,
} from "@/lib/tenureCapacity";

/**
 * Leaving post-season → next pre-season: apply end-of-season spouse support, reset firm capacity
 * to base + employees, advance season and phase. Idempotent per target pre-season season key.
 */
export function enterNextPreseason(save: NewGamePayload, completedPostSeason: number): NewGamePayload {
  const { preseasonEntryRevealPending: _previousEntryReveal, ...saveWithoutReveal } = save;
  const nextSeason = completedPostSeason + 1;
  const key = String(nextSeason);
  const already = saveWithoutReveal.preseasonEntrySpouseGrantSeasons?.includes(key);
  const previousSeason = completedPostSeason;
  const employees = (saveWithoutReveal.employees ?? []).filter(
    (e) => !(e.role === "Intern" && e.seasonHired <= previousSeason)
  );
  const removedInterns = (saveWithoutReveal.employees ?? []).filter(
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

  const employeeCapacityChanges: PreseasonEntryRevealPending["employeeCapacityChanges"] = [];
  for (const e of employees) {
    if (e.role === "Intern") continue;
    const before = employeeTotalCapacityContribution(e);
    const e2 = employeesWithTenure.find((x) => x.id === e.id);
    if (!e2) continue;
    const after = employeeTotalCapacityContribution(e2);
    if (before !== after) {
      employeeCapacityChanges.push({ employeeId: e.id, name: e.name, before, after });
    }
  }

  const spouseDisplayName = saveWithoutReveal.spouseName?.trim() || "Your spouse";
  const spouseFlavorLine = !already
    ? pickPreseasonEntrySpouseFlavorLine(saveWithoutReveal.spouseType, nextSeason, spouseDisplayName)
    : null;
  const g = seasonSpouseGrants(saveWithoutReveal.spouseType);
  const spouseGrantStats: PreseasonEntryRevealPending["spouseGrantStats"] = !already
    ? { eur: g.eur, competence: g.competence, visibility: g.visibility }
    : null;

  const hasSpouseBlock =
    Boolean(spouseFlavorLine) &&
    spouseGrantStats != null &&
    (spouseGrantStats.eur > 0 || spouseGrantStats.competence > 0 || spouseGrantStats.visibility > 0);

  const preseasonEntryRevealPending: PreseasonEntryRevealPending | undefined =
    hasSpouseBlock || employeeCapacityChanges.length > 0
      ? {
          preseasonSeasonKey: key,
          spouseGrantApplied: !already,
          spouseFlavorLine: hasSpouseBlock ? spouseFlavorLine : null,
          spouseGrantStats: hasSpouseBlock ? spouseGrantStats : null,
          employeeCapacityChanges,
        }
      : undefined;

  if (already) {
    return {
      ...saveWithoutReveal,
      seasonNumber: nextSeason,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      employees: employeesWithTenure,
      preseasonEntryRevealPending,
      resources: {
        ...saveWithoutReveal.resources,
        competence: clampToScale(
          saveWithoutReveal.resources.competence - removedInternComp,
          METRIC_SCALES.competence
        ),
        visibility: clampToScale(
          saveWithoutReveal.resources.visibility - removedInternVis,
          METRIC_SCALES.visibility
        ),
        firmCapacity: newCapacity,
      },
    };
  }

  return {
    ...saveWithoutReveal,
    seasonNumber: nextSeason,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    employees: employeesWithTenure,
    preseasonEntrySpouseGrantSeasons: [...(saveWithoutReveal.preseasonEntrySpouseGrantSeasons ?? []), key],
    preseasonEntryRevealPending,
    resources: {
      ...saveWithoutReveal.resources,
      eur: saveWithoutReveal.resources.eur + g.eur,
      competence: clampToScale(
        saveWithoutReveal.resources.competence - removedInternComp + g.competence,
        METRIC_SCALES.competence
      ),
      visibility: clampToScale(
        saveWithoutReveal.resources.visibility - removedInternVis + g.visibility,
        METRIC_SCALES.visibility
      ),
      firmCapacity: newCapacity,
    },
  };
}
