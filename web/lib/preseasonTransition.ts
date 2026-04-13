import type { NewGamePayload } from "@/components/NewGameWizard";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import { pickPreseasonEntrySpouseFlavorLine } from "@/lib/preseasonEntrySpouseCopy";
import type { PreseasonEntryRevealPending } from "@/lib/preseasonEntryReveal";
import { getSpouseVacationSeasonalBonus } from "@/lib/shoppingCenter";
import {
  employeeTotalCapacityContribution,
  tenureCapacityIncrementFromProductivity,
} from "@/lib/tenureCapacity";
import { wageLineId } from "@/lib/payablesReceivables";
import { computePreseason3SalaryAsks } from "@/lib/preseasonSalaryNegotiation";

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

  // Rebuild wage payables for all surviving full-time employees. These were cleared by
  // settlePreseasonAndEnterSeason at season start; we re-accrue them now so they are visible
  // (and deducted) when the player starts the next season.
  const rolloverWageLines = employeesWithTenure
    .filter((e) => e.role !== "Intern")
    .map((e) => ({ id: wageLineId(e.id), label: `${e.name} wage`, amount: e.salary }));

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
  const baseGrant = seasonSpouseGrants(saveWithoutReveal.spouseType);
  const vacationBonus = getSpouseVacationSeasonalBonus(saveWithoutReveal, nextSeason);
  const g = {
    eur: baseGrant.eur + vacationBonus.eur,
    competence: baseGrant.competence + vacationBonus.competence,
    visibility: baseGrant.visibility + vacationBonus.visibility,
  };
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

  const preseasonSalaryNegotiationV3 =
    nextSeason === 3
      ? saveWithoutReveal.preseasonSalaryNegotiationV3 ??
        (() => {
          const asks = computePreseason3SalaryAsks({
            createdAt: saveWithoutReveal.createdAt,
            playerName: saveWithoutReveal.playerName,
            employees: employeesWithTenure,
          });
          return asks.length > 0 ? { seasonKey: "3" as const, asks, resolved: {} } : undefined;
        })()
      : undefined;

  if (already) {
    // Idempotent path: spouse grant already applied. Payables may already contain new-hire
    // wage lines from this pre-season — don't overwrite them. Only ensure rollover wages exist
    // (they should; this guards against stale saves where they were cleared).
    const existingIds = new Set((saveWithoutReveal.payablesLines ?? []).map((l) => l.id));
    const missingRolloverLines = rolloverWageLines.filter((l) => !existingIds.has(l.id));
    return {
      ...saveWithoutReveal,
      seasonNumber: nextSeason,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      employees: employeesWithTenure,
      payablesLines: [...(saveWithoutReveal.payablesLines ?? []), ...missingRolloverLines],
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
      preseasonSalaryNegotiationV3,
    };
  }

  return {
    ...saveWithoutReveal,
    seasonNumber: nextSeason,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    employees: employeesWithTenure,
    payablesLines: rolloverWageLines,
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
    preseasonSalaryNegotiationV3,
  };
}
