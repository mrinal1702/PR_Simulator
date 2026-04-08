import type { ClientKind } from "@/lib/clientEconomyMath";

import scenarioDatabase from "../../data/scenario_database.json";

export type ScenarioRecord = (typeof scenarioDatabase.scenarios)[number];

function mapClientKindToDbType(kind: ClientKind): string {
  if (kind === "individual") return "Individual";
  if (kind === "small_business") return "Small Company";
  return "Corporate";
}

function tierMatchesBudgetTier(tier: 1 | 2, budgetTier: string): boolean {
  const b = budgetTier.toLowerCase();
  if (tier === 1) return b.includes("very low") || b.includes("low");
  return b.includes("mid") || b.includes("high") || b.includes("low");
}

function hashPickIndex(seed: string, modulo: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

/**
 * Pick a creative scenario matching client kind and budget tier; deterministic from seed.
 */
export function pickScenarioForClient(
  kind: ClientKind,
  budgetTier: 1 | 2,
  seed: string
): ScenarioRecord {
  const wantType = mapClientKindToDbType(kind);
  const pool = scenarioDatabase.scenarios.filter(
    (s) => s.client_type === wantType && tierMatchesBudgetTier(budgetTier, s.budget_tier)
  );
  const fallback = scenarioDatabase.scenarios.filter((s) => s.client_type === wantType);
  const use = pool.length > 0 ? pool : fallback;
  const idx = hashPickIndex(seed, use.length);
  return use[idx]!;
}
