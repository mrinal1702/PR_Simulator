/**
 * 190 games simulated to end of Pre-season 2 (just before Season 2 in-season):
 * - 5 games: maximize competence via pre-season workshop + greedy competence hires;
 *   Season 1 plan uses max-profit weights; post-season picks effectiveness boost when affordable.
 * - 5 games: maximize visibility via network + greedy visibility hires;
 *   Season 1 plan uses max-vis-gain weights; post-season picks reach boost when affordable.
 * - 180 games: random build/spouse/pre-season-1 activity + random hires; Season 1 plan rotates
 *   through STRATEGIES; post-season always "none".
 *
 * Stats at snapshot: raw competence/visibility and C_score/V_score (solutionOutcomeMath knots).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-to-season2-preseason-end.ts
 */

import fs from "node:fs";
import path from "node:path";
import type { NewGamePayload } from "../components/NewGameWizard";
import {
  applySpouseAtStart,
  STARTING_BUILD_STATS,
  STARTING_REPUTATION,
  type BuildId,
  type SpouseType,
} from "../lib/gameEconomy";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import {
  buildSeasonClients,
  buildSolutionOptionsForClient,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SeasonClient,
  type SeasonLoopState,
  type SolutionOption,
} from "../lib/seasonClientLoop";
import {
  canAffordEffectivenessBoost,
  canAffordReachBoost,
  applyPostSeasonChoice,
} from "../lib/postSeasonResults";
import {
  capacityGainFromProductivity,
  generateCandidates,
  getHireCapForSeason,
  getSalaryBands,
  roleLabel,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "../lib/hiring";
import { wageLineId } from "../lib/payablesReceivables";
import { enterNextPreseason } from "../lib/preseasonTransition";
import { getPreseasonFocusDeltaForSeason, type PreseasonFocusId } from "../lib/preseasonFocus";
import { competenceScoreForVariance, visibilityScoreForVariance } from "../lib/solutionOutcomeMath";
import {
  maxExecutionsPossible,
  mulberry32,
  STRATEGIES,
  type StrategyWeights,
} from "./simulate-multi-strategy-season";

const SEASON = 1;
const SEASON_KEY = "1";
const REP_START = 5;
const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const SPOUSES: SpouseType[] = ["supportive", "influential", "rich", "none"];
const TRIALS_MAX_COMP = 5;
const TRIALS_MAX_VIS = 5;
const TRIALS_VARIED = 180; // 5 + 5 + 180 = 190 total

type GameKind = "max_comp" | "max_vis" | "varied";

type HireChoice =
  | { kind: "intern" }
  | { kind: "full_time"; role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number };

type FullTimeHireChoice = Extract<HireChoice, { kind: "full_time" }>;

function listAffordableFullTime(eur: number): FullTimeHireChoice[] {
  const out: FullTimeHireChoice[] = [];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  for (const tier of tiers) {
    for (const anchor of getSalaryBands(tier).map((b) => b.anchor * 1000)) {
      if (anchor > eur) continue;
      for (const role of roles) {
        out.push({ kind: "full_time", role, tier, salary: anchor });
      }
    }
  }
  return out;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo);
}

function summarize(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const avg = mean(values);
  const variance = values.length <= 1 ? 0 : values.reduce((acc, x) => acc + (x - avg) ** 2, 0) / values.length;
  return {
    min: s[0]!,
    q1: percentile(s, 0.25),
    median: percentile(s, 0.5),
    q3: percentile(s, 0.75),
    max: s[s.length - 1]!,
    avg,
    stdDev: Math.sqrt(variance),
  };
}

function queueMaxTheoreticalProfit(clients: { budgetSeason1: number }[], executableByClient: SolutionOption[][]): number {
  let sum = 0;
  for (let i = 0; i < clients.length; i += 1) {
    const b1 = clients[i]!.budgetSeason1;
    let maxM = 0;
    for (const sol of executableByClient[i]!) {
      maxM = Math.max(maxM, b1 - sol.costBudget);
    }
    sum += maxM;
  }
  return Math.max(sum, 1e-9);
}

type Choice = SolutionOption | "reject";

function liquidityEurSimple(save: NewGamePayload): number {
  const pay = (save.payablesLines ?? []).reduce((s, l) => s + l.amount, 0);
  return save.resources.eur - pay;
}

function competenceGainFromPick(
  c: Candidate,
  mode: "intern" | "full_time",
  tier: HiringTier,
  seasonKey: string
): number {
  const skill = Math.round(c.hiddenSkillScore);
  if (mode === "intern") return 3;
  if (c.role === "data_analyst") return skill;
  if (c.role === "sales_representative") return 0;
  const split = splitBalancedSkill(skill, `${c.id}|${seasonKey}`);
  return split.competence;
}

function visibilityGainFromPick(
  c: Candidate,
  mode: "intern" | "full_time",
  tier: HiringTier,
  seasonKey: string
): number {
  const skill = Math.round(c.hiddenSkillScore);
  if (mode === "intern") return 3;
  if (c.role === "sales_representative") return skill;
  if (c.role === "data_analyst") return 0;
  const split = splitBalancedSkill(skill, `${c.id}|${seasonKey}`);
  return split.visibility;
}

function finalizeHire(
  save: NewGamePayload,
  mode: "intern" | "full_time",
  tier: HiringTier,
  role: HiringRole,
  salary: number,
  candidate: Candidate,
  seasonKey: string
): NewGamePayload {
  const hiredThisSeason = save.hiresBySeason?.[seasonKey] ?? 0;
  const productivity = Math.round(candidate.hiddenProductivityPct);
  const skill = Math.round(candidate.hiddenSkillScore);
  const capGain = capacityGainFromProductivity(productivity);
  let competenceGain = 0;
  let visibilityGain = 0;
  if (mode === "intern") {
    competenceGain = 3;
    visibilityGain = 3;
  } else if (candidate.role === "data_analyst") {
    competenceGain = skill;
  } else if (candidate.role === "sales_representative") {
    visibilityGain = skill;
  } else {
    const split = splitBalancedSkill(skill, `${candidate.id}|${seasonKey}`);
    competenceGain = split.competence;
    visibilityGain = split.visibility;
  }
  const newEmployeeId = `${candidate.id}-${seasonKey}-${hiredThisSeason + 1}`;
  return {
    ...save,
    resources: {
      ...save.resources,
      competence: save.resources.competence + competenceGain,
      visibility: save.resources.visibility + visibilityGain,
      firmCapacity: save.resources.firmCapacity + capGain,
    },
    payablesLines: [
      ...(save.payablesLines ?? []),
      { id: wageLineId(newEmployeeId), label: `${candidate.name} wage`, amount: candidate.salary },
    ],
    hiresBySeason: { ...(save.hiresBySeason ?? {}), [seasonKey]: hiredThisSeason + 1 },
    employees: [
      ...(save.employees ?? []),
      {
        id: newEmployeeId,
        name: candidate.name,
        role: mode === "intern" ? "Intern" : roleLabel(candidate.role),
        salary: candidate.salary,
        seasonHired: Number(seasonKey),
        competenceGain,
        visibilityGain,
        capacityGain: capGain,
        ...(mode === "full_time" ? { productivityPct: productivity, tenureCapacityBonus: 0 } : {}),
      },
    ],
  };
}

function pickBestCandidateForGoal(
  candidates: Candidate[],
  mode: "intern" | "full_time",
  tier: HiringTier,
  seasonKey: string,
  goal: "comp" | "vis"
): Candidate {
  let best = candidates[0]!;
  let bestScore = goal === "comp" ? competenceGainFromPick(best, mode, tier, seasonKey) : visibilityGainFromPick(best, mode, tier, seasonKey);
  for (const c of candidates) {
    const sc = goal === "comp" ? competenceGainFromPick(c, mode, tier, seasonKey) : visibilityGainFromPick(c, mode, tier, seasonKey);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best;
}

function runHiring(
  save: NewGamePayload,
  rng: () => number,
  seedBase: string,
  seasonKey: string,
  goal: "random" | "comp" | "vis"
): NewGamePayload {
  let s = save;
  const capHires = getHireCapForSeason(Number(seasonKey));
  while ((s.hiresBySeason?.[seasonKey] ?? 0) < capHires) {
    const liq = liquidityEurSimple(s);
    const canIntern = liq >= 10_000;
    const ftOptions = listAffordableFullTime(s.resources.eur);
    const totalChoices = (canIntern ? 1 : 0) + ftOptions.length;
    if (totalChoices === 0) break;

    if (goal === "comp" || goal === "vis") {
      type Scored = { score: number; pick: () => NewGamePayload | null };
      const options: Scored[] = [];
      if (canIntern) {
        const cands = generateCandidates({
          seedBase: `${seedBase}|h${s.hiresBySeason?.[seasonKey] ?? 0}`,
          season: Number(seasonKey),
          role: "campaign_manager",
          tier: "intern",
          salary: 10_000,
          reputation: s.reputation ?? REP_START,
          visibility: s.resources.visibility,
        });
        const cand = pickBestCandidateForGoal(cands, "intern", "intern", seasonKey, goal);
        options.push({
          score: goal === "comp" ? competenceGainFromPick(cand, "intern", "intern", seasonKey) : visibilityGainFromPick(cand, "intern", "intern", seasonKey),
          pick: () => finalizeHire(s, "intern", "intern", "campaign_manager", 10_000, cand, seasonKey),
        });
      }
      for (const ch of ftOptions) {
        const cands = generateCandidates({
          seedBase: `${seedBase}|h${s.hiresBySeason?.[seasonKey] ?? 0}|ft`,
          season: Number(seasonKey),
          role: ch.role,
          tier: ch.tier,
          salary: ch.salary,
          reputation: s.reputation ?? REP_START,
          visibility: s.resources.visibility,
        });
        const cand = pickBestCandidateForGoal(cands, "full_time", ch.tier, seasonKey, goal);
        if (liquidityEurSimple(s) < cand.salary) continue;
        options.push({
          score:
            goal === "comp"
              ? competenceGainFromPick(cand, "full_time", ch.tier, seasonKey)
              : visibilityGainFromPick(cand, "full_time", ch.tier, seasonKey),
          pick: () => finalizeHire(s, "full_time", ch.tier, ch.role, ch.salary, cand, seasonKey),
        });
      }
      if (options.length === 0) break;
      options.sort((a, b) => b.score - a.score);
      const next = options[0]!.pick();
      if (!next) break;
      s = next;
      continue;
    }

    let pickIdx = Math.floor(rng() * totalChoices);
    let ch: HireChoice;
    if (canIntern && pickIdx === 0) {
      ch = { kind: "intern" };
    } else {
      if (canIntern) pickIdx -= 1;
      ch = ftOptions[Math.max(0, Math.min(ftOptions.length - 1, pickIdx))]!;
    }
    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase: `${seedBase}|h${s.hiresBySeason?.[seasonKey] ?? 0}`,
        season: Number(seasonKey),
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: s.reputation ?? REP_START,
        visibility: s.resources.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase: `${seedBase}|h${s.hiresBySeason?.[seasonKey] ?? 0}|ft`,
        season: Number(seasonKey),
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: s.reputation ?? REP_START,
        visibility: s.resources.visibility,
      });
    }
    const cand = cands[Math.floor(rng() * 3)]!;
    if (ch.kind === "intern") {
      s = finalizeHire(s, "intern", "intern", "campaign_manager", 10_000, cand, seasonKey);
    } else {
      s = finalizeHire(s, "full_time", ch.tier, ch.role, ch.salary, cand, seasonKey);
    }
  }
  return s;
}

function applyPreseasonFocus(save: NewGamePayload, season: number, focus: PreseasonFocusId): NewGamePayload {
  const key = String(season);
  const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
  const counts = {
    strategy_workshop: save.preseasonFocusCounts?.strategy_workshop ?? 0,
    network: save.preseasonFocusCounts?.network ?? 0,
  };
  return {
    ...save,
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: { ...(save.preseasonActionBySeason ?? {}), [key]: focus },
    preseasonFocusCounts: { ...counts, [focus]: counts[focus] + 1 },
    resources:
      focus === "strategy_workshop"
        ? { ...save.resources, competence: save.resources.competence + delta }
        : { ...save.resources, visibility: save.resources.visibility + delta },
  };
}

function bestSeasonPlanGameAccurate(
  saveTemplate: NewGamePayload,
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  vis0: number,
  comp0: number,
  rep0: number,
  createdAt: string,
  w: StrategyWeights,
  postPolicy: "max_comp" | "max_vis" | "none_only"
): Choice[] {
  const n = clients.length;
  const executableByClient = clients.map((client) =>
    buildSolutionOptionsForClient(client).filter((o) => !o.isRejectOption)
  );
  const maxExec = maxExecutionsPossible(clients, startEur, startCap, executableByClient);
  const minExecRequired = maxExec > 0 ? 1 : 0;
  const queueMaxProfit = queueMaxTheoreticalProfit(clients, executableByClient);
  const nq = Math.max(n, 1);
  const maxRepBand = 5 * nq;

  let bestScore = -Infinity;
  let bestExec = -1;
  let bestMargin = -Infinity;
  let bestPicks: Choice[] = [];

  const scoreLeaf = (picks: Choice[]): number => {
    let eur = startEur;
    let cap = startCap;
    const satisfactions: number[] = [];
    let totalMargin = 0;

    for (let i = 0; i < n; i += 1) {
      const client = clients[i]!;
      const choice = picks[i]!;
      const b1 = client.budgetSeason1;
      if (choice === "reject") continue;
      const outcome = resolveClientOutcome({
        seed: `${createdAt}-${SEASON_KEY}-${client.id}-${choice.id}`,
        solution: choice,
        visibility: vis0,
        competence: comp0,
        discipline: client.hiddenDiscipline,
        satisfactionReachWeight: getSatisfactionReachWeight(client),
      });
      totalMargin += b1 - choice.costBudget;
      eur = eur + b1 - choice.costBudget;
      cap = Math.max(0, cap - choice.costCapacity);
      satisfactions.push(outcome.satisfaction);
    }
    const executed = satisfactions.length;
    if (executed < minExecRequired) return -Infinity;

    const loop: SeasonLoopState = {
      plannedClientCount: n,
      currentClientIndex: n,
      clientsQueue: clients,
      runs: [],
    };
    let s: NewGamePayload = {
      ...saveTemplate,
      resources: { ...saveTemplate.resources, eur, firmCapacity: cap },
      reputation: rep0,
      seasonLoopBySeason: { [SEASON_KEY]: { ...loop, runs: [] } },
    };

    for (let i = 0; i < n; i += 1) {
      const client = clients[i]!;
      const choice = picks[i]!;
      if (choice === "reject") {
        s = {
          ...s,
          seasonLoopBySeason: {
            ...s.seasonLoopBySeason,
            [SEASON_KEY]: {
              ...s.seasonLoopBySeason![SEASON_KEY]!,
              runs: [...(s.seasonLoopBySeason![SEASON_KEY]!.runs ?? []), { clientId: client.id, accepted: false, solutionId: "reject" }],
            },
          },
        };
        continue;
      }
      const outcome = resolveClientOutcome({
        seed: `${createdAt}-${SEASON_KEY}-${client.id}-${choice.id}`,
        solution: choice,
        visibility: vis0,
        competence: comp0,
        discipline: client.hiddenDiscipline,
        satisfactionReachWeight: getSatisfactionReachWeight(client),
      });
      s = {
        ...s,
        resources: {
          ...s.resources,
          eur: s.resources.eur + client.budgetSeason1 - choice.costBudget,
          firmCapacity: Math.max(0, s.resources.firmCapacity - choice.costCapacity),
        },
        seasonLoopBySeason: {
          ...s.seasonLoopBySeason,
          [SEASON_KEY]: {
            ...s.seasonLoopBySeason![SEASON_KEY]!,
            runs: [
              ...(s.seasonLoopBySeason![SEASON_KEY]!.runs ?? []),
              {
                clientId: client.id,
                accepted: true,
                solutionId: choice.id,
                outcome,
                costBudget: choice.costBudget,
                costCapacity: choice.costCapacity,
                solutionTitle: choice.title,
              },
            ],
          },
        },
      };
    }

    let sPost = s;
    const runs = sPost.seasonLoopBySeason![SEASON_KEY]!.runs;
    for (const r of runs) {
      if (!r.accepted || r.solutionId === "reject" || !r.outcome) continue;
      let choice: "reach" | "effectiveness" | "none" = "none";
      if (postPolicy === "max_comp") {
        choice = canAffordEffectivenessBoost(sPost.resources.firmCapacity) ? "effectiveness" : "none";
      } else if (postPolicy === "max_vis") {
        choice = canAffordReachBoost(sPost.resources.eur) ? "reach" : "none";
      }
      const next = applyPostSeasonChoice(sPost, SEASON_KEY, r.clientId, choice, SEASON);
      if (next) sPost = next;
    }

    const endVis = sPost.resources.visibility;
    const endRep = sPost.reputation ?? rep0;
    const meanSat = executed ? satisfactions.reduce((a, b) => a + b, 0) / executed : 0;
    const totalVisGain = endVis - vis0;
    const repNet = endRep - rep0;

    const normP = totalMargin / queueMaxProfit;
    const normV = totalVisGain / (10 * nq);
    const normR = repNet / maxRepBand;
    const normS = meanSat / 100;

    return (
      w.wProfit * normP + w.wVisGain * normV + w.wReputation * normR + w.wSatisfaction * normS
    );
  };

  const dfs = (i: number, eur: number, cap: number, picks: Choice[]) => {
    if (i >= n) {
      const sc = scoreLeaf(picks);
      const evalMargin = picks.reduce((sum, pick, idx) => {
        if (pick === "reject") return sum;
        return sum + clients[idx]!.budgetSeason1 - pick.costBudget;
      }, 0);
      const exec = picks.filter((p) => p !== "reject").length;
      if (
        sc > bestScore ||
        (sc === bestScore && exec > bestExec) ||
        (sc === bestScore && exec === bestExec && evalMargin > bestMargin)
      ) {
        bestScore = sc;
        bestExec = exec;
        bestMargin = evalMargin;
        bestPicks = [...picks];
      }
      return;
    }
    const client = clients[i]!;
    const b1 = client.budgetSeason1;
    const liquid = eur + b1;
    dfs(i + 1, eur, cap, [...picks, "reject"]);
    for (const solution of executableByClient[i]!) {
      if (!canAffordSolution(solution, liquid, cap)) continue;
      dfs(i + 1, eur + b1 - solution.costBudget, cap - solution.costCapacity, [...picks, solution]);
    }
  };

  dfs(0, startEur, startCap, []);
  return bestPicks;
}

function runOneGame(args: {
  rng: () => number;
  gameIndex: number;
  kind: GameKind;
}): { competence: number; visibility: number; cScore: number; vScore: number } {
  const { rng, gameIndex, kind } = args;
  const build = BUILDS[Math.floor(rng() * BUILDS.length)]!;
  const spouse = SPOUSES[Math.floor(rng() * SPOUSES.length)]!;
  const createdAt = new Date(Date.UTC(2026, 3, 10, 12, 0, gameIndex)).toISOString();
  const playerName = `Sim-${gameIndex}`;
  const seedBase = `${createdAt}|${playerName}`;

  let resources = applySpouseAtStart(STARTING_BUILD_STATS[build], spouse);
  if (kind === "max_comp") {
    resources = { ...resources, competence: resources.competence + 10 };
  } else if (kind === "max_vis") {
    resources = { ...resources, visibility: resources.visibility + 10 };
  } else {
    const roll = rng();
    if (roll < 1 / 3) resources = { ...resources, competence: resources.competence + 10 };
    else if (roll < 2 / 3) resources = { ...resources, visibility: resources.visibility + 10 };
  }

  let save: NewGamePayload = {
    playerName,
    agencyName: `Agency-${gameIndex}`,
    gender: "non_binary",
    buildId: build,
    spouseType: spouse,
    spouseGender: "non_binary",
    spouseName: "Pat",
    seasonNumber: 1,
    phase: "preseason",
    activityFocusUsedInPreseason: false,
    preseasonActionBySeason: {},
    preseasonFocusCounts: { strategy_workshop: 0, network: 0 },
    reputation: STARTING_REPUTATION,
    resources,
    initialResources: { ...resources },
    initialReputation: STARTING_REPUTATION,
    hiresBySeason: {},
    employees: [],
    usedScenarioIds: [],
    payablesLines: [],
    preseasonEntrySpouseGrantSeasons: [],
    createdAt,
  };

  const hireGoal = kind === "max_comp" ? "comp" : kind === "max_vis" ? "vis" : "random";
  save = runHiring(save, rng, seedBase, SEASON_KEY, hireGoal);

  const planned = plannedClientCountForSeason(SEASON, save.resources.visibility, seedBase);
  const { clients, usedScenarioIds } = buildSeasonClients(
    seedBase,
    SEASON,
    Math.max(1, planned),
    { reputation: save.reputation ?? REP_START, visibility: save.resources.visibility },
    save.usedScenarioIds ?? []
  );
  save = { ...save, usedScenarioIds };

  const vis0 = save.resources.visibility;
  const comp0 = save.resources.competence;
  const rep0 = save.reputation ?? REP_START;
  const startEur = save.resources.eur;
  const startCap = save.resources.firmCapacity;

  const strat: StrategyWeights =
    kind === "max_comp"
      ? STRATEGIES.find((s) => s.id === "max-profit")!
      : kind === "max_vis"
        ? STRATEGIES.find((s) => s.id === "max-vis-gain")!
        : STRATEGIES[gameIndex % STRATEGIES.length]!;

  const postPolicy = kind === "max_comp" ? "max_comp" : kind === "max_vis" ? "max_vis" : "none_only";
  const picks = bestSeasonPlanGameAccurate(save, clients, startEur, startCap, vis0, comp0, rep0, createdAt, strat, postPolicy);

  let s = save;
  const loop: SeasonLoopState = {
    plannedClientCount: clients.length,
    currentClientIndex: clients.length,
    clientsQueue: clients,
    runs: [],
  };
  s = { ...s, seasonNumber: 1, phase: "season", seasonLoopBySeason: { [SEASON_KEY]: { ...loop, runs: [] } } };

  let eur = startEur;
  let cap = startCap;
  for (let i = 0; i < clients.length; i += 1) {
    const client = clients[i]!;
    const choice = picks[i]!;
    if (choice === "reject") {
      s = {
        ...s,
        seasonLoopBySeason: {
          ...s.seasonLoopBySeason,
          [SEASON_KEY]: {
            ...s.seasonLoopBySeason![SEASON_KEY]!,
            runs: [...s.seasonLoopBySeason![SEASON_KEY]!.runs, { clientId: client.id, accepted: false, solutionId: "reject" }],
          },
        },
      };
      continue;
    }
    const outcome = resolveClientOutcome({
      seed: `${createdAt}-${SEASON_KEY}-${client.id}-${choice.id}`,
      solution: choice,
      visibility: vis0,
      competence: comp0,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
    });
    eur = eur + client.budgetSeason1 - choice.costBudget;
    cap = Math.max(0, cap - choice.costCapacity);
    s = {
      ...s,
      resources: { ...s.resources, eur, firmCapacity: cap },
      seasonLoopBySeason: {
        ...s.seasonLoopBySeason,
        [SEASON_KEY]: {
          ...s.seasonLoopBySeason![SEASON_KEY]!,
          runs: [
            ...s.seasonLoopBySeason![SEASON_KEY]!.runs,
            {
              clientId: client.id,
              accepted: true,
              solutionId: choice.id,
              outcome,
              costBudget: choice.costBudget,
              costCapacity: choice.costCapacity,
              solutionTitle: choice.title,
            },
          ],
        },
      },
    };
  }

  const runs = s.seasonLoopBySeason![SEASON_KEY]!.runs;
  for (const r of runs) {
    if (!r.accepted || r.solutionId === "reject" || !r.outcome) continue;
    let psChoice: "reach" | "effectiveness" | "none" = "none";
    if (postPolicy === "max_comp") {
      psChoice = canAffordEffectivenessBoost(s.resources.firmCapacity) ? "effectiveness" : "none";
    } else if (postPolicy === "max_vis") {
      psChoice = canAffordReachBoost(s.resources.eur) ? "reach" : "none";
    }
    const next = applyPostSeasonChoice(s, SEASON_KEY, r.clientId, psChoice, SEASON);
    if (next) s = next;
  }

  s = { ...s, phase: "postseason" };
  s = enterNextPreseason(s, 1);

  const focus2: PreseasonFocusId =
    kind === "max_comp" ? "strategy_workshop" : kind === "max_vis" ? "network" : gameIndex % 2 === 0 ? "strategy_workshop" : "network";
  s = applyPreseasonFocus(s, 2, focus2);

  const competence = s.resources.competence;
  const visibility = s.resources.visibility;
  return {
    competence,
    visibility,
    cScore: competenceScoreForVariance(competence),
    vScore: visibilityScoreForVariance(visibility),
  };
}

function main() {
  const competence: number[] = [];
  const visibility: number[] = [];
  const cScores: number[] = [];
  const vScores: number[] = [];

  let gi = 0;
  for (let i = 0; i < TRIALS_MAX_COMP; i += 1, gi += 1) {
    const rng = mulberry32(0x53324232 ^ gi * 0x9e3779b9);
    const r = runOneGame({ rng, gameIndex: gi, kind: "max_comp" });
    competence.push(r.competence);
    visibility.push(r.visibility);
    cScores.push(r.cScore);
    vScores.push(r.vScore);
  }
  for (let i = 0; i < TRIALS_MAX_VIS; i += 1, gi += 1) {
    const rng = mulberry32(0x53324232 ^ gi * 0x9e3779b9);
    const r = runOneGame({ rng, gameIndex: gi, kind: "max_vis" });
    competence.push(r.competence);
    visibility.push(r.visibility);
    cScores.push(r.cScore);
    vScores.push(r.vScore);
  }
  for (let i = 0; i < TRIALS_VARIED; i += 1, gi += 1) {
    const rng = mulberry32(0x53324232 ^ gi * 0x9e3779b9);
    const r = runOneGame({ rng, gameIndex: gi, kind: "varied" });
    competence.push(r.competence);
    visibility.push(r.visibility);
    cScores.push(r.cScore);
    vScores.push(r.vScore);
  }

  const report = {
    meta: {
      totalGames: TRIALS_MAX_COMP + TRIALS_MAX_VIS + TRIALS_VARIED,
      maxCompGames: TRIALS_MAX_COMP,
      maxVisGames: TRIALS_MAX_VIS,
      variedGames: TRIALS_VARIED,
      snapshot: "End of Pre-season 2 (after one focus pick); before settlePreseasonAndEnterSeason",
    },
    competence: summarize(competence),
    visibility: summarize(visibility),
    cScore: summarize(cScores),
    vScore: summarize(vScores),
  };

  const outDir = path.resolve(process.cwd(), "scripts", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "season2-preseason-end-190.json");
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const line = (label: string, s: (typeof report)["competence"]) =>
    console.log(
      `${label}: min=${s.min.toFixed(2)} q1=${s.q1.toFixed(2)} median=${s.median.toFixed(2)} q3=${s.q3.toFixed(2)} max=${s.max.toFixed(2)} avg=${s.avg.toFixed(2)} sd=${s.stdDev.toFixed(2)}`
    );

  console.log(`Simulated ${report.meta.totalGames} games (5 max-comp + 5 max-vis + 180 varied) to end of Pre-season 2.\n`);
  line("Competence", report.competence);
  line("Visibility", report.visibility);
  line("C_score", report.cScore);
  line("V_score", report.vScore);
  console.log(`\nSaved: ${outPath}`);
}

main();
