import type { NewGamePayload } from "@/components/NewGameWizard";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import { employeeTotalCapacityContribution } from "@/lib/tenureCapacity";
import { severanceLineId, wageLineId } from "@/lib/payablesReceivables";

const VOLUNTARY_REP_PENALTY = 10;
const SEVERANCE_RATE = 0.2;

export type FireEmployeeResult =
  | { ok: true; save: NewGamePayload }
  | { ok: false; error: string };

function removePayableLine(save: NewGamePayload, id: string): NewGamePayload {
  const lines = (save.payablesLines ?? []).filter((l) => l.id !== id);
  return { ...save, payablesLines: lines };
}

/**
 * Voluntary layoff: −10 reputation; wage payable replaced by severance payable (settled at Go to season).
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
  const wid = wageLineId(emp.id);
  const lines = [...(save.payablesLines ?? [])];
  const wi = lines.findIndex((l) => l.id === wid);
  if (wi === -1) {
    return { ok: false, error: "No wage payable found for this employee." };
  }
  lines.splice(wi, 1);
  lines.push({
    id: severanceLineId(emp.id),
    label: `Severance (${emp.name})`,
    amount: severance,
  });

  const newEmployees = (save.employees ?? []).filter((e) => e.id !== employeeId);
  const newRep = clampToScale((save.reputation ?? 5) - VOLUNTARY_REP_PENALTY, METRIC_SCALES.reputation);

  const next: NewGamePayload = {
    ...save,
    employees: newEmployees,
    reputation: newRep,
    payablesLines: lines,
    voluntaryLayoffsBySeason: {
      ...(save.voluntaryLayoffsBySeason ?? {}),
      [sk]: used + 1,
    },
    resources: {
      ...save.resources,
      competence: clampToScale(save.resources.competence - emp.competenceGain, METRIC_SCALES.competence),
      visibility: clampToScale(save.resources.visibility - emp.visibilityGain, METRIC_SCALES.visibility),
      firmCapacity: Math.max(0, save.resources.firmCapacity - employeeTotalCapacityContribution(emp)),
    },
  };
  return { ok: true, save: next };
}

/**
 * Mandatory layoff (liquidity shortfall): no severance payable, no reputation penalty.
 */
export function fireEmployeeForPayrollShortfall(
  save: NewGamePayload,
  employeeId: string
): FireEmployeeResult {
  const emp = save.employees?.find((e) => e.id === employeeId);
  if (!emp) return { ok: false, error: "Employee not found." };
  const wid = wageLineId(emp.id);
  const lines = (save.payablesLines ?? []).filter((l) => l.id !== wid);
  const newEmployees = (save.employees ?? []).filter((e) => e.id !== employeeId);
  const next: NewGamePayload = {
    ...save,
    employees: newEmployees,
    payablesLines: lines,
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
      firmCapacity: Math.max(0, save.resources.firmCapacity - employeeTotalCapacityContribution(emp)),
    },
  };
  return { ok: true, save: next };
}
