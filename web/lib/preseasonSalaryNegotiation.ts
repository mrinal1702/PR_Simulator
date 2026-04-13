import type { NewGamePayload } from "@/components/NewGameWizard";
import type { EmployeeRecord } from "@/lib/tenureCapacity";
import { liquidityEur, wageLineId } from "@/lib/payablesReceivables";
import { inferSkillPct } from "@/lib/employeeSkillDisplay";

export type PreseasonSalaryNegotiationV3 = {
  seasonKey: "3";
  asks: Array<{ employeeId: string; raiseEur: number }>;
  resolved: Partial<Record<string, "paid" | "left">>;
};

export const HIGH_PRODUCTIVITY_THRESHOLD = 51;
export const HIGH_SKILL_THRESHOLD = 51;
const ASK_PROBABILITY = 0.75;

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

function rand01(seed: string): number {
  return (hash32(seed) >>> 0) / 4294967295;
}

export function raiseEurForSalary(salary: number): number {
  if (salary < 40_000) return 5_000;
  if (salary < 65_000) return 10_000;
  return 15_000;
}

export function countRaiseRollDimensions(employee: EmployeeRecord): 0 | 1 | 2 {
  if (employee.role === "Intern") return 0;
  const skillPct = inferSkillPct(employee);
  const skillHigh = skillPct != null && skillPct >= HIGH_SKILL_THRESHOLD;
  const prodHigh =
    employee.productivityPct != null && employee.productivityPct >= HIGH_PRODUCTIVITY_THRESHOLD;
  if (!prodHigh && !skillHigh) return 0;
  if (prodHigh && skillHigh) return 2;
  return 1;
}

export function rollSalaryAsk(seedBase: string, rollCount: 1 | 2): boolean {
  if (rollCount === 1) {
    return rand01(`${seedBase}|r1`) < ASK_PROBABILITY;
  }
  const r1 = rand01(`${seedBase}|r1`) < ASK_PROBABILITY;
  const r2 = rand01(`${seedBase}|r2`) < ASK_PROBABILITY;
  return r1 || r2;
}

export function computePreseason3SalaryAsks(
  save: Pick<NewGamePayload, "createdAt" | "playerName" | "employees">
): Array<{ employeeId: string; raiseEur: number }> {
  const employees = save.employees ?? [];
  const asks: Array<{ employeeId: string; raiseEur: number }> = [];
  for (const e of employees) {
    const n = countRaiseRollDimensions(e);
    if (n === 0) continue;
    const seedBase = `${save.createdAt}|${save.playerName}|preseason3SalaryAsk|3|${e.id}`;
    if (!rollSalaryAsk(seedBase, n === 2 ? 2 : 1)) continue;
    asks.push({ employeeId: e.id, raiseEur: raiseEurForSalary(e.salary) });
  }
  return asks;
}

export function canAffordPayRaise(save: NewGamePayload, raiseEur: number): boolean {
  return liquidityEur(save) >= raiseEur;
}

export function applyPayRaise(
  save: NewGamePayload,
  employeeId: string,
  raiseEur: number
): NewGamePayload {
  const wid = wageLineId(employeeId);
  const lines = (save.payablesLines ?? []).map((l) =>
    l.id === wid ? { ...l, amount: l.amount + raiseEur } : l
  );
  const employees = (save.employees ?? []).map((e) =>
    e.id === employeeId ? { ...e, salary: e.salary + raiseEur } : e
  );
  return { ...save, employees, payablesLines: lines };
}

export function hasUnresolvedSalaryNegotiationV3(save: NewGamePayload): boolean {
  const v = save.preseasonSalaryNegotiationV3;
  if (!v || v.seasonKey !== "3") return false;
  for (const a of v.asks) {
    if (!v.resolved[a.employeeId]) return true;
  }
  return false;
}

export function reconcileSalaryNegotiationWithRoster(save: NewGamePayload): NewGamePayload {
  const v = save.preseasonSalaryNegotiationV3;
  if (!v || v.seasonKey !== "3") return save;
  const ids = new Set((save.employees ?? []).map((e) => e.id));
  let changed = false;
  const resolved = { ...v.resolved };
  for (const a of v.asks) {
    if (!resolved[a.employeeId] && !ids.has(a.employeeId)) {
      resolved[a.employeeId] = "left";
      changed = true;
    }
  }
  if (!changed) return save;
  return { ...save, preseasonSalaryNegotiationV3: finalizeNegotiationState({ ...v, resolved }) };
}

function finalizeNegotiationState(v: PreseasonSalaryNegotiationV3): PreseasonSalaryNegotiationV3 | undefined {
  for (const a of v.asks) {
    if (!v.resolved[a.employeeId]) return v;
  }
  return undefined;
}

export function resolveSalaryAskPaid(
  save: NewGamePayload,
  employeeId: string,
  raiseEur: number
): NewGamePayload {
  const v = save.preseasonSalaryNegotiationV3;
  if (!v || v.seasonKey !== "3") return save;
  const updated = applyPayRaise(save, employeeId, raiseEur);
  const resolved = { ...v.resolved, [employeeId]: "paid" as const };
  return {
    ...updated,
    preseasonSalaryNegotiationV3: finalizeNegotiationState({ ...v, resolved }),
  };
}

export function resolveSalaryAskLeft(save: NewGamePayload, employeeId: string): NewGamePayload {
  const v = save.preseasonSalaryNegotiationV3;
  if (!v || v.seasonKey !== "3") return save;
  const resolved = { ...v.resolved, [employeeId]: "left" as const };
  return {
    ...save,
    preseasonSalaryNegotiationV3: finalizeNegotiationState({ ...v, resolved }),
  };
}
