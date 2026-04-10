import {
  computeBudgetTierDeterministic,
  rollClientBudgetTotalInTier,
  rollSeason2ClientBudget,
  sampleClientKindDeterministic,
  season2EntryScoresFromRawStats,
  season2RollClientKindAndTier,
  type ClientKind,
} from "@/lib/clientEconomyMath";
import { pickScenarioForClient } from "@/lib/scenarios";
import {
  computeSeason1SolutionMetrics,
  computeSeason2SolutionMetrics,
} from "@/lib/solutionOutcomeMath";

export type { ClientKind };
export type ClientPreferenceMotive = "spread_first" | "effectiveness_first" | "balanced";

export type ScenarioSolutionLine = {
  solution_archetype_id: number;
  solution_name: string;
  solution_brief: string;
};

export type PostSeasonArcOutcomes = {
  low_visibility_low_effectiveness?: string;
  low_visibility_high_effectiveness?: string;
  high_visibility_low_effectiveness?: string;
  high_visibility_high_effectiveness?: string;
};

export type SeasonClient = {
  id: string;
  displayName: string;
  clientKind: ClientKind;
  problem: string;
  budgetTotal: number;
  budgetSeason1: number;
  budgetSeason2: number;
  scenarioId: string;
  scenarioTitle: string;
  scenarioSolutions: ScenarioSolutionLine[];
  /** Scenario arc shown in post-season 1, chosen by reach/effectiveness threshold combination. */
  postSeasonArcOutcomes?: PostSeasonArcOutcomes;
  hiddenDiscipline: number;
  hiddenPreferenceMotive: ClientPreferenceMotive;
  /**
   * Weight on reach (message spread) in satisfaction; effectiveness weight is `1 − this`.
   * Set at roll time: {@link baseReachWeightForMotive} for motive, plus deterministic jitter.
   */
  satisfactionReachWeight?: number;
};

/** `pending` = accepted, waiting for solution choice (not shown as a player-facing option). */
export type SolutionId =
  | "solution_1"
  | "solution_2"
  | "solution_3"
  | "solution_4"
  | "reject"
  | "pending";

/** Structural archetype (not shown to player). */
export type SolutionArchetype =
  | "minimal"
  | "high_effectiveness"
  | "high_reach"
  | "best"
  | "reject";

export type ArchetypeBasePct = {
  /** Reach (message spread), 0–100. */
  reach: number;
  /** Effectiveness (convincing execution), 0–100. */
  effectiveness: number;
};

/**
 * Pre-variance base profile per archetype (0–100% each).
 * Final scores use 40% this + 60% variance (`computeSeason1SolutionMetrics` for Season 1,
 * `computeSeason2SolutionMetrics` for Season 2+ via `resolveClientOutcome`).
 * Uniform random archetype → E[reach] = E[effectiveness] = 50 before variance.
 *
 * | Archetype           | Role                          |
 * |---------------------|-------------------------------|
 * | minimal             | minimum reach & effectiveness |
 * | high_reach          | high reach, low effectiveness |
 * | high_effectiveness  | low reach, high effectiveness |
 * | best                | maximum reach & effectiveness |
 */
export const SOLUTION_ARCHETYPE_BASE_PCT: Record<Exclude<SolutionArchetype, "reject">, ArchetypeBasePct> = {
  minimal: { reach: 25, effectiveness: 25 },
  high_reach: { reach: 70, effectiveness: 30 },
  high_effectiveness: { reach: 30, effectiveness: 70 },
  best: { reach: 75, effectiveness: 75 },
};

export type SolutionOption = {
  id: SolutionId;
  archetype: SolutionArchetype;
  title: string;
  description: string;
  costBudget: number;
  costCapacity: number;
  baseSpread: number;
  baseEffectiveness: number;
  isRejectOption: boolean;
};

export type ClientOutcome = {
  messageSpread: number;
  messageEffectiveness: number;
  satisfaction: number;
};

/** Post-season 1+ boost step applied to a resolved campaign (per client). */
export type PostSeasonRunRecord = {
  choice: "reach" | "effectiveness" | "none";
  /** Integer percentage points added (1–5), 0 if none. */
  boostPointsApplied: number;
  /** Final reach % (0–100) after boost. */
  reachPercent: number;
  /** Final effectiveness % (0–100) after boost. */
  effectivenessPercent: number;
  /** Reputation change from this resolution (half-arc rules when arc completeness is 50%). */
  reputationDelta: number;
  /** Firm visibility gained from client satisfaction for this resolution. */
  visibilityGain: number;
};

/** Season 2 carry-over resolution for a prior-season client run (stored on the original season’s run). */
export type Season2CarryoverResolution = {
  messageSpread: number;
  messageEffectiveness: number;
  satisfaction: number;
  solutionId: SolutionId;
  costBudget: number;
  costCapacity: number;
};

export type SeasonClientRun = {
  clientId: string;
  accepted: boolean;
  solutionId: SolutionId;
  outcome?: ClientOutcome;
  /** Priced solution execution (for history / ledger). */
  costBudget?: number;
  costCapacity?: number;
  solutionTitle?: string;
  /** Filled after the player completes this scenario in the post-season results flow. */
  postSeason?: PostSeasonRunRecord;
  /** Season 2 follow-up on this client: new metrics after base + variance improvement (or do-nothing decay). */
  season2CarryoverResolution?: Season2CarryoverResolution;
};

export type SeasonLoopState = {
  plannedClientCount: number;
  currentClientIndex: number;
  clientsQueue: SeasonClient[];
  runs: SeasonClientRun[];
  lastOutcome?: ClientOutcome;
};

/**
 * Costs are derived from this season’s allocated budget (`budgetSeason1`) and client type.
 * Individual baseline: worst 10%/30 cap, high-effectiveness 30%/45, high-reach 40%/35, best 50%/50 (matches 30k→15k best at tier floor).
 */
const SOLUTION_COST_SCALE: Record<ClientKind, { budget: number; capacity: number }> = {
  individual: { budget: 1, capacity: 1 },
  small_business: { budget: 1.06, capacity: 1.06 },
  corporate: { budget: 1.14, capacity: 1.12 },
};

type ExecutableSolutionDef = {
  id: Exclude<SolutionId, "reject">;
  archetype: Exclude<SolutionArchetype, "reject">;
  title: string;
  description: string;
  /** Message spread base (0–100); mirrors {@link SOLUTION_ARCHETYPE_BASE_PCT}[archetype].reach. */
  baseSpread: number;
  /** Effectiveness base (0–100); mirrors {@link SOLUTION_ARCHETYPE_BASE_PCT}[archetype].effectiveness. */
  baseEffectiveness: number;
  /** Share of Season 1 budget tranche (round 1 execution). */
  budgetSeason1Share: number;
  /** Base capacity cost for individuals; scaled by client type. */
  baseCapacity: number;
};

const EXECUTABLE_SOLUTION_DEFS: ExecutableSolutionDef[] = [
  {
    id: "solution_1",
    archetype: "minimal",
    title: "Low-footprint response",
    description: "Lean response with minimal spend.",
    baseSpread: SOLUTION_ARCHETYPE_BASE_PCT.minimal.reach,
    baseEffectiveness: SOLUTION_ARCHETYPE_BASE_PCT.minimal.effectiveness,
    budgetSeason1Share: 0.1,
    baseCapacity: 30,
  },
  {
    id: "solution_2",
    archetype: "high_effectiveness",
    title: "Precision response",
    description: "Capacity-heavy execution for stronger message quality.",
    baseSpread: SOLUTION_ARCHETYPE_BASE_PCT.high_effectiveness.reach,
    baseEffectiveness: SOLUTION_ARCHETYPE_BASE_PCT.high_effectiveness.effectiveness,
    budgetSeason1Share: 0.3,
    baseCapacity: 45,
  },
  {
    id: "solution_3",
    archetype: "high_reach",
    title: "Amplified push",
    description: "Budget-heavy push to maximize message spread.",
    baseSpread: SOLUTION_ARCHETYPE_BASE_PCT.high_reach.reach,
    baseEffectiveness: SOLUTION_ARCHETYPE_BASE_PCT.high_reach.effectiveness,
    budgetSeason1Share: 0.4,
    baseCapacity: 35,
  },
  {
    id: "solution_4",
    archetype: "best",
    title: "Full-spectrum campaign",
    description: "High budget and high capacity for broad and strong execution.",
    baseSpread: SOLUTION_ARCHETYPE_BASE_PCT.best.reach,
    baseEffectiveness: SOLUTION_ARCHETYPE_BASE_PCT.best.effectiveness,
    budgetSeason1Share: 0.5,
    baseCapacity: 50,
  },
];

const REJECT_OPTION: SolutionOption = {
  id: "reject",
  archetype: "reject",
  title: "Do nothing",
  description: "Pass on this client — you won't run a campaign for them.",
  costBudget: 0,
  costCapacity: 0,
  baseSpread: 0,
  baseEffectiveness: 0,
  isRejectOption: true,
};

export function buildSolutionOptionsForClient(client: SeasonClient): SolutionOption[] {
  const scale = SOLUTION_COST_SCALE[client.clientKind];
  const b1 = Math.max(0, client.budgetSeason1);
  const executable: SolutionOption[] = EXECUTABLE_SOLUTION_DEFS.map((def) => {
    const costBudget = Math.round(b1 * def.budgetSeason1Share * scale.budget);
    const costCapacity = Math.max(1, Math.round(def.baseCapacity * scale.capacity));
    return {
      id: def.id,
      archetype: def.archetype,
      title: def.title,
      description: def.description,
      costBudget,
      costCapacity,
      baseSpread: def.baseSpread,
      baseEffectiveness: def.baseEffectiveness,
      isRejectOption: false,
    };
  });
  return [...executable, REJECT_OPTION];
}

/**
 * Season 2 carry-over follow-ups: fixed EUR + capacity (not scaled by client budget).
 * Archetype 1 = minimal, 2 = high effectiveness / low reach, 3 = high reach / low effectiveness, 4 = both high.
 * Reach-only costs more cash and less capacity than effectiveness-only.
 */
export const CARRYOVER_SOLUTION_FIXED_COSTS: Record<
  Exclude<SolutionId, "reject" | "pending">,
  { eur: number; capacity: number }
> = {
  solution_1: { eur: 1000, capacity: 5 },
  solution_2: { eur: 3000, capacity: 10 },
  solution_3: { eur: 7000, capacity: 6 },
  solution_4: { eur: 10000, capacity: 15 },
};

const CARRYOVER_DO_NOTHING_OPTION: SolutionOption = {
  ...REJECT_OPTION,
  title: "Do nothing",
  description:
    "Take no new campaign action. Reach and effectiveness each decay by 5 percentage points from the values shown above.",
};

/** Priced options for Season 2 rollover UI / execution (scenario copy merged from client). */
export function buildCarryoverSolutionOptionsForClient(client: SeasonClient): SolutionOption[] {
  const executable: SolutionOption[] = EXECUTABLE_SOLUTION_DEFS.map((def) => {
    const { eur, capacity } = CARRYOVER_SOLUTION_FIXED_COSTS[def.id as keyof typeof CARRYOVER_SOLUTION_FIXED_COSTS];
    return {
      id: def.id,
      archetype: def.archetype,
      title: def.title,
      description: def.description,
      costBudget: eur,
      costCapacity: capacity,
      baseSpread: def.baseSpread,
      baseEffectiveness: def.baseEffectiveness,
      isRejectOption: false,
    };
  });
  const merged = mergeScenarioSolutionCopy(client, executable);
  return [CARRYOVER_DO_NOTHING_OPTION, ...merged];
}

export function archetypeIdFromSolutionId(id: SolutionId): number | null {
  if (id === "reject") return null;
  const n = Number.parseInt(id.replace("solution_", ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Apply creative scenario names/briefs from DB onto priced options (archetype ids 1–4). */
export function mergeScenarioSolutionCopy(client: SeasonClient, options: SolutionOption[]): SolutionOption[] {
  const sols = client.scenarioSolutions;
  if (!sols?.length) return options;
  const byId = new Map<number, { name: string; brief: string }>();
  for (const s of sols) {
    byId.set(s.solution_archetype_id, { name: s.solution_name, brief: s.solution_brief });
  }
  return options.map((opt) => {
    if (opt.isRejectOption) return opt;
    const aid = archetypeIdFromSolutionId(opt.id);
    if (aid == null) return opt;
    const copy = byId.get(aid);
    if (!copy) return opt;
    return { ...opt, title: copy.name, description: copy.brief };
  });
}

export function buildSolutionOptionsForClientWithScenario(client: SeasonClient): SolutionOption[] {
  return mergeScenarioSolutionCopy(client, buildSolutionOptionsForClient(client));
}

/** Motive-only baseline reach weights (before per-client jitter). */
export function baseReachWeightForMotive(motive: ClientPreferenceMotive): number {
  if (motive === "spread_first") return 0.72;
  if (motive === "effectiveness_first") return 0.3;
  return 0.5;
}

/** Max absolute deviation from the motive base (e.g. 0.72 → 0.64…0.80 when 0.08). */
const SATISFACTION_REACH_WEIGHT_JITTER = 0.08;
const SATISFACTION_REACH_WEIGHT_MIN = 0.12;
const SATISFACTION_REACH_WEIGHT_MAX = 0.88;

function rollSatisfactionReachWeight(baseReach: number, salt: string): number {
  const n = hashNumber(salt);
  const t = (n % 10001) / 10000;
  const jitter = (t * 2 - 1) * SATISFACTION_REACH_WEIGHT_JITTER;
  const w = baseReach + jitter;
  return Math.max(SATISFACTION_REACH_WEIGHT_MIN, Math.min(SATISFACTION_REACH_WEIGHT_MAX, w));
}

/** Reach weight used in satisfaction; falls back to motive baseline if missing (older saves). */
export function getSatisfactionReachWeight(client: SeasonClient): number {
  const w = client.satisfactionReachWeight;
  if (w != null && Number.isFinite(w)) {
    return Math.max(0, Math.min(1, w));
  }
  return baseReachWeightForMotive(client.hiddenPreferenceMotive);
}

export function computeSatisfactionFromWeights(
  spread: number,
  effectiveness: number,
  reachWeight: number
): number {
  const rw = Math.max(0, Math.min(1, reachWeight));
  return Math.round(spread * rw + effectiveness * (1 - rw));
}

export function buildSeasonClients(
  seedBase: string,
  season: number,
  count: number,
  agency: { reputation: number; visibility: number; competence?: number },
  usedScenarioIds: readonly string[] = [],
  seasonEntryScores?: { vScore?: number; cScore?: number }
): { clients: SeasonClient[]; usedScenarioIds: string[] } {
  const clients: SeasonClient[] = [];
  const exclude = new Set(usedScenarioIds);

  const rep = agency.reputation;
  const competence = agency.competence ?? 0;
  const entryV =
    seasonEntryScores?.vScore !== undefined && Number.isFinite(seasonEntryScores.vScore)
      ? seasonEntryScores.vScore
      : season2EntryScoresFromRawStats(agency.visibility, competence).vScore;
  const entryC =
    seasonEntryScores?.cScore !== undefined && Number.isFinite(seasonEntryScores.cScore)
      ? seasonEntryScores.cScore
      : season2EntryScoresFromRawStats(agency.visibility, competence).cScore;

  let hadCorporate = false;
  let hadTier2 = false;

  for (let i = 0; i < count; i += 1) {
    const h = hashNumber(`${seedBase}-season-${season}-client-${i}`);
    const kindSeed = `${seedBase}|s${season}|c${i}|${rep}|${agency.visibility}`;
    let kind: ClientKind;
    let tier: 1 | 2;
    let total: number;

    if (season === 2) {
      const roll = season2RollClientKindAndTier({
        seedBase: kindSeed,
        reputation: rep,
        entryVScore: entryV,
        entryCScore: entryC,
        slotIndex: i,
        plannedClientCount: count,
        hadCorporateBeforeSlot: hadCorporate,
        hadTier2BeforeSlot: hadTier2,
      });
      kind = roll.kind;
      tier = roll.tier;
      total = rollSeason2ClientBudget(kind, tier, kindSeed, i, entryV);
      if (kind === "corporate") hadCorporate = true;
      if (tier === 2) hadTier2 = true;
    } else {
      kind = sampleClientKindDeterministic(kindSeed, rep, agency.visibility, season);
      tier = computeBudgetTierDeterministic(`${kindSeed}|tier`, season, agency.visibility, rep);
      total = rollClientBudgetTotalInTier(kind, tier, agency.visibility);
    }
    const motive: ClientPreferenceMotive =
      kind === "corporate"
        ? (["effectiveness_first", "balanced", "effectiveness_first"] as const)[h % 3]
        : kind === "small_business"
          ? (["balanced", "spread_first", "effectiveness_first"] as const)[h % 3]
          : (["spread_first", "balanced", "spread_first"] as const)[h % 3];
    const split = splitBudgetBySeason(total);
    const scenario = pickScenarioForClient(kind, tier, `${kindSeed}|scn|${tier}`, exclude);
    exclude.add(scenario.scenario_id);
    const arc2Source = (scenario as { arc_2?: unknown }).arc_2;
    const postSeasonArcOutcomes: PostSeasonArcOutcomes | undefined =
      arc2Source && typeof arc2Source === "object"
        ? {
            low_visibility_low_effectiveness: (
              arc2Source as { low_visibility_low_effectiveness?: unknown }
            ).low_visibility_low_effectiveness as string | undefined,
            low_visibility_high_effectiveness: (
              arc2Source as { low_visibility_high_effectiveness?: unknown }
            ).low_visibility_high_effectiveness as string | undefined,
            high_visibility_low_effectiveness: (
              arc2Source as { high_visibility_low_effectiveness?: unknown }
            ).high_visibility_low_effectiveness as string | undefined,
            high_visibility_high_effectiveness: (
              arc2Source as { high_visibility_high_effectiveness?: unknown }
            ).high_visibility_high_effectiveness as string | undefined,
          }
        : undefined;
    const baseReach = baseReachWeightForMotive(motive);
    const satisfactionReachWeight = rollSatisfactionReachWeight(baseReach, `${seedBase}-satw-${season}-${i}`);
    clients.push({
      id: `s${season}-c${i + 1}`,
      displayName: scenario.client_name ?? scenario.client_subtype,
      clientKind: kind,
      problem: scenario.problem_summary,
      budgetTotal: total,
      budgetSeason1: split.season1,
      budgetSeason2: split.season2,
      scenarioId: scenario.scenario_id,
      scenarioTitle: scenario.scenario_title,
      scenarioSolutions: scenario.solutions.map((s) => ({
        solution_archetype_id: s.solution_archetype_id,
        solution_name: s.solution_name,
        solution_brief: s.solution_brief,
      })),
      postSeasonArcOutcomes,
      hiddenDiscipline:
        kind === "corporate" ? 45 + (h % 41) : kind === "small_business" ? 38 + (h % 45) : 30 + (h % 56),
      hiddenPreferenceMotive: motive,
      satisfactionReachWeight,
    });
  }

  return { clients, usedScenarioIds: Array.from(exclude) };
}

/**
 * Approximate ~70% / remainder split using whole thousands only (no decimals).
 * Tunable later per tier; tier min/max bands live in {@link CLIENT_BUDGET_TIER_RANGES} (`clientEconomyMath.ts`).
 */
export function splitBudgetBySeason(total: number): { season1: number; season2: number } {
  if (total <= 0) return { season1: 0, season2: 0 };
  const season1Thousands = Math.round((total * 0.7) / 1000);
  const season1 = season1Thousands * 1000;
  const season2 = total - season1;
  return { season1, season2 };
}

export function canAffordSolution(solution: SolutionOption, budget: number, capacity: number): boolean {
  return budget >= solution.costBudget && capacity >= solution.costCapacity;
}

export function resolveClientOutcome(args: {
  seed: string;
  solution: SolutionOption;
  visibility: number;
  competence: number;
  discipline: number;
  /** Weight on reach in satisfaction (0–1); effectiveness uses `1 − this`. Set at client creation with jitter around motive baseline. */
  satisfactionReachWeight: number;
  /**
   * Which C/V knot tables to use for the additive-force model. Season 1 keeps legacy
   * normalization; Season 2+ uses median-recalibrated knots.
   */
  outcomeScoreSeason?: 1 | 2;
}): ClientOutcome {
  const metricsInput = {
    baseReach: args.solution.baseSpread,
    baseEffectiveness: args.solution.baseEffectiveness,
    visibility: args.visibility,
    competence: args.competence,
    discipline: args.discipline,
    seed: args.seed,
  };
  const { reach: messageSpread, effectiveness: messageEffectiveness } =
    (args.outcomeScoreSeason ?? 1) === 2
      ? computeSeason2SolutionMetrics(metricsInput)
      : computeSeason1SolutionMetrics(metricsInput);

  const satisfaction = computeSatisfactionFromWeights(
    messageSpread,
    messageEffectiveness,
    args.satisfactionReachWeight
  );
  return { messageSpread, messageEffectiveness, satisfaction };
}

function hashNumber(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
