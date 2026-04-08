import {
  computeBudgetTierDeterministic,
  rollClientBudgetTotalInTier,
  sampleClientKindDeterministic,
  type ClientKind,
} from "@/lib/clientEconomyMath";
import { pickScenarioForClient } from "@/lib/scenarios";

export type { ClientKind };
export type ClientPreferenceMotive = "spread_first" | "effectiveness_first" | "balanced";

export type ScenarioSolutionLine = {
  solution_archetype_id: number;
  solution_name: string;
  solution_brief: string;
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
  hiddenDiscipline: number;
  hiddenPreferenceMotive: ClientPreferenceMotive;
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

export type SeasonClientRun = {
  clientId: string;
  accepted: boolean;
  solutionId: SolutionId;
  outcome?: ClientOutcome;
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
  baseSpread: number;
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
    baseSpread: 30,
    baseEffectiveness: 30,
    budgetSeason1Share: 0.1,
    baseCapacity: 30,
  },
  {
    id: "solution_2",
    archetype: "high_effectiveness",
    title: "Precision response",
    description: "Capacity-heavy execution for stronger message quality.",
    baseSpread: 32,
    baseEffectiveness: 68,
    budgetSeason1Share: 0.3,
    baseCapacity: 45,
  },
  {
    id: "solution_3",
    archetype: "high_reach",
    title: "Amplified push",
    description: "Budget-heavy push to maximize message spread.",
    baseSpread: 70,
    baseEffectiveness: 35,
    budgetSeason1Share: 0.4,
    baseCapacity: 35,
  },
  {
    id: "solution_4",
    archetype: "best",
    title: "Full-spectrum campaign",
    description: "High budget and high capacity for broad and strong execution.",
    baseSpread: 76,
    baseEffectiveness: 76,
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

function archetypeIdFromSolutionId(id: SolutionId): number | null {
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

export function buildSeasonClients(
  seedBase: string,
  season: number,
  count: number,
  agency: { reputation: number; visibility: number },
  usedScenarioIds: readonly string[] = []
): { clients: SeasonClient[]; usedScenarioIds: string[] } {
  const clients: SeasonClient[] = [];
  const exclude = new Set(usedScenarioIds);

  const rep = agency.reputation;

  for (let i = 0; i < count; i += 1) {
    const h = hashNumber(`${seedBase}-season-${season}-client-${i}`);
    const kindSeed = `${seedBase}|s${season}|c${i}|${rep}|${agency.visibility}`;
    const kind = sampleClientKindDeterministic(kindSeed, rep, agency.visibility, season);
    const motive: ClientPreferenceMotive =
      kind === "corporate"
        ? (["effectiveness_first", "balanced", "effectiveness_first"] as const)[h % 3]
        : kind === "small_business"
          ? (["balanced", "spread_first", "effectiveness_first"] as const)[h % 3]
          : (["spread_first", "balanced", "spread_first"] as const)[h % 3];
    const tier = computeBudgetTierDeterministic(`${kindSeed}|tier`, season, agency.visibility, rep);
    const total = rollClientBudgetTotalInTier(kind, tier, agency.visibility);
    const split = splitBudgetBySeason(total);
    const scenario = pickScenarioForClient(kind, tier, `${kindSeed}|scn|${tier}`, exclude);
    exclude.add(scenario.scenario_id);
    clients.push({
      id: `s${season}-c${i + 1}`,
      displayName: scenario.client_subtype,
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
      hiddenDiscipline:
        kind === "corporate" ? 45 + (h % 41) : kind === "small_business" ? 38 + (h % 45) : 30 + (h % 56),
      hiddenPreferenceMotive: motive,
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
  motive: ClientPreferenceMotive;
}): ClientOutcome {
  const n = hashNumber(args.seed);
  const variance = (offset: number, amp: number) => ((n + offset) % (amp * 2 + 1)) - amp;
  const disciplineSwing = (args.discipline - 50) * 0.35;

  const messageSpread = Math.max(
    0,
    Math.round(args.solution.baseSpread + args.visibility * 0.18 + args.competence * 0.08 + disciplineSwing + variance(7, 10))
  );
  const messageEffectiveness = Math.max(
    0,
    Math.round(args.solution.baseEffectiveness + args.competence * 0.22 + disciplineSwing + variance(13, 9))
  );

  const satisfaction = computeSatisfaction(messageSpread, messageEffectiveness, args.motive);
  return { messageSpread, messageEffectiveness, satisfaction };
}

function computeSatisfaction(spread: number, effectiveness: number, motive: ClientPreferenceMotive): number {
  if (motive === "spread_first") return Math.round(spread * 0.72 + effectiveness * 0.28);
  if (motive === "effectiveness_first") return Math.round(spread * 0.3 + effectiveness * 0.7);
  return Math.round(spread * 0.5 + effectiveness * 0.5);
}

function hashNumber(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
