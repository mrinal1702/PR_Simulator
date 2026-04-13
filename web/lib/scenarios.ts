import type { ClientBudgetTier, ClientKind } from "@/lib/clientEconomyMath";

import scenarioMeta from "../data/scenario_database.json";
import scenariosCorporate from "../data/scenarios_corporate.json";
import scenariosIndividual from "../data/scenarios_individual.json";
import scenariosSmallCompany from "../data/scenarios_small_company.json";

/** Merged pool; JSON lives under `web/data/` so Vercel (root `web/`) can resolve imports. */
const scenarioDatabase = {
  ...scenarioMeta,
  scenarios: [
    ...scenariosIndividual.scenarios,
    ...scenariosSmallCompany.scenarios,
    ...scenariosCorporate.scenarios,
  ],
};

/** JSON rows may add fields over time; `client_name` is authored in split scenario files but must stay optional for typing. */
export type ScenarioRecord = (typeof scenarioDatabase.scenarios)[number] & {
  client_name?: string;
};

function mapClientKindToDbType(kind: ClientKind): string {
  if (kind === "individual") return "Individual";
  if (kind === "small_business") return "Small Company";
  return "Corporate";
}

function tierMatchesBudgetTier(tier: ClientBudgetTier, budgetTier: string): boolean {
  const b = budgetTier.toLowerCase();
  if (tier === 1) return b.includes("very low") || b.includes("low");
  if (tier === 2) return b.includes("mid") || b.includes("high") || b.includes("low");
  return b.includes("mid") || b.includes("high");
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
 * Failsafe: if every scenario is exhausted, try pools in this order (individual tier 1 → SMB tier 1 →
 * corporate tier 1 → repeat at tier 2, then tier 3).
 */
const SCENARIO_FAILOVER_ORDER: { kind: ClientKind; tier: ClientBudgetTier }[] = (() => {
  const order: { kind: ClientKind; tier: ClientBudgetTier }[] = [];
  const kinds: ClientKind[] = ["individual", "small_business", "corporate"];
  for (const tier of [1, 2, 3] as const) {
    for (const kind of kinds) {
      order.push({ kind, tier });
    }
  }
  return order;
})();

/** Thrown when every scenario in the DB is already in `excludeIds` (cannot satisfy uniqueness). */
export const SCENARIO_POOL_EXHAUSTED_MESSAGE =
  "PR_SIMULATOR_NO_SCENARIOS_LEFT: Every scenario has been used this playthrough.";

/** Lookup helper for rollover/history screens that need source scenario arc keys. */
export function getScenarioById(scenarioId: string): ScenarioRecord | undefined {
  return scenarioDatabase.scenarios.find((scenario) => scenario.scenario_id === scenarioId);
}

/**
 * Pick a creative scenario matching client kind and budget tier; deterministic from seed.
 * Never returns a scenario whose `scenario_id` is in `excludeIds` while any unused scenario remains
 * in the database (widens pool: tier+type → same type → global unused).
 */
export function pickScenarioForClient(
  kind: ClientKind,
  budgetTier: ClientBudgetTier,
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
    for (const { kind: fk, tier: ft } of SCENARIO_FAILOVER_ORDER) {
      const c = scenarioDatabase.scenarios.filter(
        (s) =>
          s.client_type === mapClientKindToDbType(fk) &&
          tierMatchesBudgetTier(ft, s.budget_tier) &&
          !excludeIds.has(s.scenario_id)
      );
      if (c.length > 0) {
        candidates = c;
        break;
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error(SCENARIO_POOL_EXHAUSTED_MESSAGE);
  }
  const idx = hashPickIndex(seed, candidates.length);
  return candidates[idx]!;
}
