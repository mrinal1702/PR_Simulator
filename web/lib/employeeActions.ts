import type { NewGamePayload } from "@/components/NewGameWizard";
import { spendEurOrNull } from "@/lib/budgetGuard";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";

const VOLUNTARY_REP_PENALTY = 10;
const SEVERANCE_RATE = 0.2;

export type FireEmployeeResult =
  | { ok: true; save: NewGamePayload }
  | { ok: false; error: string };

/**
 * Voluntary layoff: −10 reputation, 20% severance cash, max one per season per `seasonNumber`, cannot fire same pre-season hire.
 */
export function fireEmployeeVoluntary(
  save: NewGamePayload,
  employeeId: string,
  preseasonSeasonNumber: number
): FireEmployeeResult {
  const emp = save.employees?.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Employee not found." };
  if (emp.seasonHired === preseasonSeasonNumber) {
    return { ok: false, error: "You cannot lay off someone hired in this same pre-season." };
  }
  const sk = String(preseasonSeasonNumber);
  const used = save.voluntaryLayoffsBySeason?.[sk] ?? 0;
  if (used >= 1) {
    return { ok: false, error: "You can only take one voluntary layoff per season." };
  }
  const severance = Math.floor(emp.salary * SEVERANCE_RATE);
  const nextEur = spendEurOrNull(save.resources.eur, severance);
  if (nextEur == null) {
    return { ok: false, error: "Insufficient cash for severance (20% of salary)." };
  }
  const newEmployees = (save.employees ?? []).filter((e) => e.id !== employeeId);
  const newRep = clampToScale((save.reputation ?? 5) - VOLUNTARY_REP_PENALTY, METRIC_SCALES.reputation);

  const next: NewGamePayload = {
    ...save,
    employees: newEmployees,
    reputation: newRep,
    voluntaryLayoffsBySeason: {
      ...(save.voluntaryLayoffsBySeason ?? {}),
      [sk]: used + 1,
    },
    resources: {
      ...save.resources,
      eur: nextEur,
      competence: clampToScale(save.resources.competence - emp.competenceGain, METRIC_SCALES.competence),
      visibility: clampToScale(save.resources.visibility - emp.visibilityGain, METRIC_SCALES.visibility),
      firmCapacity: Math.max(0, save.resources.firmCapacity - emp.capacityGain),
    },
  };
  return { ok: true, save: next };
}

/**
 * Mandatory payroll layoff: no severance and no reputation penalty.
 * Used only when payroll cannot be covered at pre-season checkpoint.
 */
export function fireEmployeeForPayrollShortfall(
  save: NewGamePayload,
  employeeId: string
): FireEmployeeResult {
  const emp = save.employees?.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Employee not found." };
  const newEmployees = (save.employees ?? []).filter((e) => e.id !== employeeId);
  const next: NewGamePayload = {
    ...save,
    employees: newEmployees,
    resources: {
      ...save.resources,
      competence: clampToScale(
        save.resources.competence - emp.competenceGain,
        METRIC_SCALES.competence
      ),
      visibility: clampToScale(
        save.resources.visibility - emp.visibilityGain,
        METRIC_SCALES.visibility
      ),
      firmCapacity: Math.max(0, save.resources.firmCapacity - emp.capacityGain),
    },
  };
  return { ok: true, save: next };
}
