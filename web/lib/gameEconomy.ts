/** Mirrors data/build_value_budget.txt + spouse rules (numbers tunable). */

export type BuildId = "velvet_rolodex" | "summa_cum_basement" | "portfolio_pivot";
export type SpouseType = "supportive" | "influential" | "rich" | "none";

export type BuildStats = {
  eur: number;
  competence: number;
  visibility: number;
  firmCapacity: number;
};

export const ECONOMY_BENCHMARK = {
  eur: 80_000,
  competence: 80,
  visibility: 80,
  firmCapacity: 50,
} as const;

/**
 * Baseline build resources BEFORE spouse.
 * Target: equal Total_V across all builds.
 */
export const STARTING_BUILD_STATS: Record<BuildId, BuildStats> = {
  velvet_rolodex: { eur: 16_000, competence: 30, visibility: 80, firmCapacity: 50 },
  summa_cum_basement: { eur: 16_000, competence: 80, visibility: 30, firmCapacity: 50 },
  portfolio_pivot: { eur: 80_000, competence: 22, visibility: 24, firmCapacity: 50 },
};

/** Apply spouse modifiers at game start (before first season). */
export function applySpouseAtStart(base: BuildStats, spouse: SpouseType): BuildStats {
  switch (spouse) {
    case "rich":
      return { ...base, eur: base.eur + 20_000 };
    case "supportive":
      return { ...base, competence: base.competence + 20 };
    case "influential":
      return { ...base, visibility: base.visibility + 20 };
    case "none":
      return { ...base, firmCapacity: 100 };
    default:
      return base;
  }
}

/** End-of-season spouse grants (`none` intentionally has no recurring inflow). */
export function seasonSpouseGrants(spouse: SpouseType): BuildStats {
  switch (spouse) {
    case "rich":
      return { eur: 20_000, competence: 0, visibility: 0, firmCapacity: 0 };
    case "supportive":
      return { eur: 0, competence: 20, visibility: 0, firmCapacity: 0 };
    case "influential":
      return { eur: 0, competence: 0, visibility: 20, firmCapacity: 0 };
    case "none":
      return { eur: 0, competence: 0, visibility: 0, firmCapacity: 0 };
    default:
      return { eur: 0, competence: 0, visibility: 0, firmCapacity: 0 };
  }
}

export function totalV(s: BuildStats): number {
  return (
    s.eur / ECONOMY_BENCHMARK.eur +
    s.competence / ECONOMY_BENCHMARK.competence +
    s.visibility / ECONOMY_BENCHMARK.visibility +
    s.firmCapacity / ECONOMY_BENCHMARK.firmCapacity
  );
}

export type EconomyValidation = {
  ok: boolean;
  baseEqual: boolean;
  spouseEqualExceptNone: boolean;
  noneHigherAtStart: boolean;
  noneHasNoSeasonIncome: boolean;
  targetBaseV: number;
  baseByBuild: Record<BuildId, number>;
  spouseStartByBuild: Record<BuildId, Record<SpouseType, number>>;
};

/**
 * Auto-patches build totals to a target V by adjusting competence only.
 * This is intentionally simple and deterministic for design-time correction.
 */
export function patchBuildsToEqualTotalV(
  builds: Record<BuildId, BuildStats>,
  targetV: number
): Record<BuildId, BuildStats> {
  const out: Record<BuildId, BuildStats> = { ...builds };
  (Object.keys(out) as BuildId[]).forEach((id) => {
    const current = out[id];
    const deficitV = targetV - totalV(current);
    if (Math.abs(deficitV) < 1e-9) return;
    // 1 competence point = 1 / 80 V
    const competenceDelta = deficitV * ECONOMY_BENCHMARK.competence;
    out[id] = { ...current, competence: round2(current.competence + competenceDelta) };
  });
  return out;
}

export function validateEconomyInvariants(
  builds: Record<BuildId, BuildStats> = STARTING_BUILD_STATS,
  tolerance = 1e-6
): EconomyValidation {
  const ids = Object.keys(builds) as BuildId[];
  const spouses: SpouseType[] = ["supportive", "influential", "rich", "none"];

  const baseByBuild = Object.fromEntries(ids.map((id) => [id, totalV(builds[id])])) as Record<
    BuildId,
    number
  >;
  const targetBaseV = baseByBuild[ids[0]];
  const baseEqual = ids.every((id) => Math.abs(baseByBuild[id] - targetBaseV) <= tolerance);

  const spouseStartByBuild = Object.fromEntries(
    ids.map((id) => {
      const row = Object.fromEntries(
        spouses.map((s) => [s, totalV(applySpouseAtStart(builds[id], s))])
      ) as Record<SpouseType, number>;
      return [id, row];
    })
  ) as Record<BuildId, Record<SpouseType, number>>;

  const spouseEqualExceptNone = (["supportive", "influential", "rich"] as const).every((s) =>
    ids.every(
      (id) => Math.abs(spouseStartByBuild[id][s] - spouseStartByBuild[ids[0]][s]) <= tolerance
    )
  );

  const noneHigherAtStart = ids.every((id) => spouseStartByBuild[id].none > spouseStartByBuild[id].rich);
  const noneHasNoSeasonIncome = totalV(seasonSpouseGrants("none")) === 0;

  const ok =
    baseEqual &&
    spouseEqualExceptNone &&
    noneHigherAtStart &&
    noneHasNoSeasonIncome;

  return {
    ok,
    baseEqual,
    spouseEqualExceptNone,
    noneHigherAtStart,
    noneHasNoSeasonIncome,
    targetBaseV,
    baseByBuild,
    spouseStartByBuild,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
