/** Mirrors data/build_value_budget.txt + spouse rules (numbers tunable). */

export type SpouseType = "supportive" | "influential" | "rich" | "none";

export type BuildStats = {
  eur: number;
  competence: number;
  visibility: number;
  firmCapacity: number;
};

/** Apply spouse modifiers at game start (before first season). */
export function applySpouseAtStart(base: BuildStats, spouse: SpouseType): BuildStats {
  switch (spouse) {
    case "rich":
      return { ...base, eur: base.eur + 25_000 };
    case "supportive":
      return { ...base, competence: base.competence + 25 };
    case "influential":
      return { ...base, visibility: base.visibility + 25 };
    case "none":
      return { ...base, firmCapacity: 100 };
    default:
      return base;
  }
}

/** End-of-season spouse grants (no recurring capacity except design changes). */
export function seasonSpouseGrants(spouse: SpouseType): {
  eur: number;
  competence: number;
  visibility: number;
  firmCapacity: number;
} {
  switch (spouse) {
    case "rich":
      return { eur: 25_000, competence: 0, visibility: 0, firmCapacity: 0 };
    case "supportive":
      return { eur: 0, competence: 25, visibility: 0, firmCapacity: 0 };
    case "influential":
      return { eur: 0, competence: 0, visibility: 25, firmCapacity: 0 };
    case "none":
      return { eur: 0, competence: 0, visibility: 0, firmCapacity: 0 };
    default:
      return { eur: 0, competence: 0, visibility: 0, firmCapacity: 0 };
  }
}

export function totalV(s: BuildStats): number {
  return (
    s.eur / 80_000 +
    s.competence / 80 +
    s.visibility / 80 +
    s.firmCapacity / 50
  );
}
