import type { EmployeeRecord } from "@/lib/tenureCapacity";

/** Roster UI skill % (0–100): same bands as hiring report / EmployeeRosterList. */
export function inferSkillPct(employee: EmployeeRecord): number | null {
  if (employee.role === "Intern") return null;
  const tierMax = employee.salary < 40_000 ? 20 : employee.salary < 65_000 ? 40 : 80;
  const totalSkill =
    employee.role === "Data Analyst"
      ? employee.competenceGain
      : employee.role === "Sales Representative"
        ? employee.visibilityGain
        : employee.competenceGain + employee.visibilityGain;
  if (totalSkill <= 0) return 0;
  return Math.round((totalSkill / tierMax) * 100);
}
