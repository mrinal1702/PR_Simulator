export function canAfford(currentEur: number, costEur: number): boolean {
  return Number.isFinite(currentEur) && Number.isFinite(costEur) && costEur >= 0 && currentEur >= costEur;
}

export function spendEurOrNull(currentEur: number, costEur: number): number | null {
  if (!canAfford(currentEur, costEur)) return null;
  return currentEur - costEur;
}

