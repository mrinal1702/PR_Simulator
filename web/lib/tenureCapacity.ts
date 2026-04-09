/**
 * Tenure-based capacity: each post-season → pre-season transition, full-time employees
 * gain capacity from productivity. First season with firm: ceil(productivity% × 20 / 100).
 * From the second season onward: same formula but capped at +10 per year.
 */

import type { NewGamePayload } from "@/components/NewGameWizard";

export type EmployeeRecord = NonNullable<NewGamePayload["employees"]>[number];

/** Total capacity this employee contributes (hire + tenure rewards). */
export function employeeTotalCapacityContribution(e: EmployeeRecord): number {
  return e.capacityGain + (e.tenureCapacityBonus ?? 0);
}

/**
 * @param productivityPct 0–100 (hiring roll)
 * @param seasonsWithFirm Completed seasons with the firm after this transition (nextSeason - seasonHired)
 */
export function tenureCapacityIncrementFromProductivity(
  productivityPct: number,
  seasonsWithFirm: number
): number {
  if (seasonsWithFirm < 1) return 0;
  const p = Math.max(0, Math.min(100, productivityPct));
  const raw = Math.ceil((p * 20) / 100);
  if (seasonsWithFirm === 1) return raw;
  return Math.min(raw, 10);
}

/** Compact line for agency stats employee rows: hire capacity + optional tenure bonus. */
export function formatEmployeeCapacitySuffix(e: EmployeeRecord): string {
  const base = e.capacityGain;
  const t = e.tenureCapacityBonus ?? 0;
  if (base <= 0 && t <= 0) return "";
  if (t > 0 && base > 0) return ` · Capacity +${base} (+${t} tenure)`;
  if (t > 0) return ` · Capacity +${t} tenure`;
  return ` · Capacity +${base}`;
}
