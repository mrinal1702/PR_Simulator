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

/** Thrown when every scenario in the DB is already in `excludeIds` (cannot satisfy uniqueness). */
export const SCENARIO_POOL_EXHAUSTED_MESSAGE =
  "PR_SIMULATOR_NO_SCENARIOS_LEFT: Every scenario has been used this playthrough.";

/**
 * Pick a creative scenario matching client kind and budget tier; deterministic from seed.
 * Never returns a scenario whose `scenario_id` is in `excludeIds` while any unused scenario remains
 * in the database (widens pool: tier+type → same type → global unused).
 */
export function pickScenarioForClient(
  kind: ClientKind,
  budgetTier: 1 | 2,
  seed: string,
  excludeIds: ReadonlySet<string>
): ScenarioRecord {
  const wantType = mapClientKindToDbType(kind);
  const pool = scenarioDatabase.scenarios.filter(
    (s) => s.client_type === wantType && tierMatchesBudgetTier(budgetTier, s.budget_tier)
  );
  const fallbackType = scenarioDatabase.scenarios.filter((s) => s.client_type === wantType);
  const allUnused = scenarioDatabase.scenarios.filter((s) => !excludeIds.has(s.scenario_id));

  let candidates = pool.filter((s) => !excludeIds.has(s.scenario_id));
  if (candidates.length === 0) {
    candidates = fallbackType.filter((s) => !excludeIds.has(s.scenario_id));
  }
  if (candidates.length === 0) {
    candidates = allUnused;
  }
  if (candidates.length === 0) {
    throw new Error(SCENARIO_POOL_EXHAUSTED_MESSAGE);
  }
  const idx = hashPickIndex(seed, candidates.length);
  return candidates[idx]!;
}
