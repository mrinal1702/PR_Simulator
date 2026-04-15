/**
 * Search for maximum employee count by end of Season 2.
 *
 * Tries many build/spouse combinations and varied in-game decisions
 * (focus + hiring style + random candidate picks) and reports the max
 * headcount reached at the Season 2 end checkpoint (post-season complete,
 * before entering pre-season 3).
 *
 * Run:
 * npx tsx --tsconfig tsconfig.json scripts/simulate-max-employees-season2.ts
 */

import type { NewGamePayload } from "../components/NewGameWizard";
import { fireEmployeeForPayrollShortfall } from "../lib/employeeActions";
import { plannedClientCountForSeason } from "../lib/clientEconomyMath";
import {
  applySpouseAtStart,
  STARTING_BUILD_STATS,
  STARTING_REPUTATION,
  type BuildId,
  type SpouseType,
} from "../lib/gameEconomy";
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
import { METRIC_SCALES, clampToScale } from "../lib/metricScales";
import { settlePreseasonAndEnterSeason, liquidityEur, wageLineId, type PayableLine } from "../lib/payablesReceivables";
import { applyPostSeasonChoice } from "../lib/postSeasonResults";
import { getPreseasonFocusDeltaForSeason, type PreseasonFocusId } from "../lib/preseasonFocus";
import { enterNextPreseason } from "../lib/preseasonTransition";
import { applySeason2CarryoverChoice, getSeasonCarryoverEntries } from "../lib/seasonCarryover";
import {
  buildCarryoverSolutionOptionsForClient,
  buildSeasonClients,
  buildSolutionOptionsForClient,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SeasonClient,
  type SeasonClientRun,
  type SolutionOption,
} from "../lib/seasonClientLoop";

type Choice = SolutionOption | "reject";

const BUILDS: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const SPOUSES: SpouseType[] = ["supportive", "influential", "rich", "none"];
const ATTEMPTS_PER_COMBO = 300;

type ComboBest = {
  build: BuildId;
  spouse: SpouseType;
  maxEmployees: number;
  attempts: number;
  achievedInAttempt: number;
  notes: string;
};

function main() {
  const comboResults: ComboBest[] = [];
  let globalBest = -Infinity;
  let globalBestCombo = "";

  for (const build of BUILDS) {
    for (const spouse of SPOUSES) {
      let bestCount = -Infinity;
      let bestAttempt = -1;

      for (let attempt = 0; attempt < ATTEMPTS_PER_COMBO; attempt += 1) {
        const save = runOneAttempt(build, spouse, attempt);
        const count = save.employees?.length ?? 0;
        if (count > bestCount) {
          bestCount = count;
          bestAttempt = attempt;
        }
      }

      comboResults.push({
        build,
        spouse,
        maxEmployees: bestCount,
        attempts: ATTEMPTS_PER_COMBO,
        achievedInAttempt: bestAttempt,
        notes:
          bestCount >= 5
            ? "Hit full practical ceiling (5) by end of Season 2."
            : "Did not reach 5 in search budget.",
      });

      if (bestCount > globalBest) {
        globalBest = bestCount;
        globalBestCombo = `${build} + ${spouse}`;
      }
    }
  }

  console.log("Max employee search by end of Season 2");
  console.log(`Attempts per combo: ${ATTEMPTS_PER_COMBO}`);
  console.log("");
  for (const row of comboResults) {
    console.log(
      `${row.build} / ${row.spouse}: maxEmployees=${row.maxEmployees} (best attempt ${row.achievedInAttempt})`
    );
  }
  console.log("");
  console.log(`GLOBAL MAX EMPLOYEES: ${globalBest}`);
  console.log(`First combo reaching global max: ${globalBestCombo}`);
}

function runOneAttempt(build: BuildId, spouse: SpouseType, attempt: number): NewGamePayload {
  const rng = mulberry32(hash32(`${build}|${spouse}|${attempt}|headcount`));
  const seedBase = `maxemp|${build}|${spouse}|${attempt}`;
  const createdAt = new Date(Date.UTC(2026, 3, 12, 13, 0, attempt)).toISOString();
  let save = createNewSave(build, spouse, createdAt, attempt);

  save = applyPreseasonFocus(save, 1, pickFocus(rng));
  save = runHiring(save, 1, rng, seedBase, "season1");
  save = resolveMandatoryLayoffs(save);
  save = settlePreseasonAndEnterSeason(save, "1");

  save = playSeasonForProfit(save, 1, `${seedBase}|s1`);
  save = { ...save, phase: "postseason", seasonNumber: 1 };
  save = runPostSeasonNoSpend(save, 1);

  save = enterNextPreseason(save, 1);
  save = applyPreseasonFocus(save, 2, pickFocus(rng));
  save = runHiring(save, 2, rng, seedBase, "season2");
  save = resolveMandatoryLayoffs(save);
  save = settlePreseasonAndEnterSeason(save, "2");

  save = resolveCarryoversNoSpend(save, `${seedBase}|carry`);
  save = playSeasonForProfit(save, 2, `${seedBase}|s2`);
  save = { ...save, phase: "postseason", seasonNumber: 2 };
  save = runPostSeasonNoSpend(save, 2);

  return save;
}

function createNewSave(build: BuildId, spouse: SpouseType, createdAt: string, runIndex: number): NewGamePayload {
  const resources = applySpouseAtStart(STARTING_BUILD_STATS[build], spouse);
  return {
    playerName: `HeadcountBot-${runIndex}`,
    agencyName: `Headcount Agency ${runIndex}`,
    gender: "non_binary",
    buildId: build,
    spouseType: spouse,
    spouseGender: spouse === "none" ? null : "non_binary",
    spouseName: spouse === "none" ? null : "Pat",
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
    voluntaryLayoffsBySeason: {},
    seasonCashAdjustmentsBySeason: {},
    talentBazaarBannedNames: [],
    talentBazaarJuniorNamesUsed: [],
    createdAt,
  };
}

function pickFocus(rng: () => number): PreseasonFocusId {
  return rng() < 0.5 ? "strategy_workshop" : "network";
}

function applyPreseasonFocus(save: NewGamePayload, season: number, focus: PreseasonFocusId): NewGamePayload {
  const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
  return {
    ...save,
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: { ...(save.preseasonActionBySeason ?? {}), [String(season)]: focus },
    preseasonFocusCounts: {
      strategy_workshop:
        (save.preseasonFocusCounts?.strategy_workshop ?? 0) + (focus === "strategy_workshop" ? 1 : 0),
      network: (save.preseasonFocusCounts?.network ?? 0) + (focus === "network" ? 1 : 0),
    },
    resources:
      focus === "strategy_workshop"
        ? { ...save.resources, competence: save.resources.competence + delta }
        : { ...save.resources, visibility: save.resources.visibility + delta },
  };
}

function runHiring(
  save: NewGamePayload,
  season: number,
  rng: () => number,
  seedBase: string,
  phaseTag: "season1" | "season2"
): NewGamePayload {
  let next = save;
  const seasonKey = String(season);
  const cap = getHireCapForSeason(season);

  while ((next.hiresBySeason?.[seasonKey] ?? 0) < cap) {
    const liquidity = liquidityEur(next);
    const options = buildHiringOptions(liquidity, phaseTag);
    if (options.length === 0) break;
    const pick = options[Math.floor(rng() * options.length)]!;

    if (pick.kind === "intern") {
      const candidates = generateCandidates({
        seedBase: `${seedBase}|${season}|intern|${next.hiresBySeason?.[seasonKey] ?? 0}`,
        season,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: next.reputation ?? STARTING_REPUTATION,
        visibility: next.resources.visibility,
        competence: next.resources.competence,
      });
      const candidate = candidates[Math.floor(rng() * Math.max(1, candidates.length))];
      if (!candidate) break;
      next = finalizeHire(next, seasonKey, "intern", "campaign_manager", "intern", 10_000, candidate);
      continue;
    }

    const candidates = generateCandidates({
      seedBase: `${seedBase}|${season}|${pick.role}|${pick.tier}|${pick.salary}|${next.hiresBySeason?.[seasonKey] ?? 0}`,
      season,
      role: pick.role,
      tier: pick.tier,
      salary: pick.salary,
      reputation: next.reputation ?? STARTING_REPUTATION,
      visibility: next.resources.visibility,
      competence: next.resources.competence,
    });
    const candidate = candidates[Math.floor(rng() * Math.max(1, candidates.length))];
    if (!candidate) break;
    next = finalizeHire(next, seasonKey, "full_time", pick.role, pick.tier, pick.salary, candidate);
  }

  return next;
}

function buildHiringOptions(
  liquidity: number,
  phaseTag: "season1" | "season2"
): Array<
  | { kind: "intern" }
  | { kind: "full_time"; role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }
> {
  const options: Array<
    | { kind: "intern" }
    | { kind: "full_time"; role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number }
  > = [];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];

  if (liquidity >= 10_000 && phaseTag === "season2") {
    options.push({ kind: "intern" });
    options.push({ kind: "intern" });
  }

  for (const tier of tiers) {
    for (const salary of getSalaryBands(tier).map((band) => band.anchor * 1000)) {
      if (salary > liquidity) continue;
      for (const role of roles) {
        options.push({ kind: "full_time", role, tier, salary });
      }
      // Favor cheaper full-time options for season 1 to preserve headcount into season 2.
      if (phaseTag === "season1" && tier === "junior") {
        options.push({ kind: "full_time", role: "campaign_manager", tier, salary });
      }
    }
  }

  return options;
}

function finalizeHire(
  save: NewGamePayload,
  seasonKey: string,
  mode: "intern" | "full_time",
  role: HiringRole,
  tier: HiringTier,
  salary: number,
  candidate: Candidate
): NewGamePayload {
  const hired = save.hiresBySeason?.[seasonKey] ?? 0;
  const skill = Math.round(candidate.hiddenSkillScore);
  const productivity = Math.round(candidate.hiddenProductivityPct);
  const capacityGain = capacityGainFromProductivity(productivity);
  let competenceGain = 0;
  let visibilityGain = 0;

  if (mode === "intern") {
    competenceGain = 3;
    visibilityGain = 3;
  } else if (role === "data_analyst") {
    competenceGain = skill;
  } else if (role === "sales_representative") {
    visibilityGain = skill;
  } else {
    const split = splitBalancedSkill(skill, `${candidate.id}|${seasonKey}`);
    competenceGain = split.competence;
    visibilityGain = split.visibility;
  }

  const employeeId = `${candidate.id}-${seasonKey}-${hired + 1}`;
  const payablesLines: PayableLine[] = [
    ...(save.payablesLines ?? []),
    { id: wageLineId(employeeId), label: `${candidate.name} wage`, amount: salary },
  ];

  return {
    ...save,
    resources: {
      ...save.resources,
      competence: clampToScale(save.resources.competence + competenceGain, METRIC_SCALES.competence),
      visibility: clampToScale(save.resources.visibility + visibilityGain, METRIC_SCALES.visibility),
      firmCapacity: save.resources.firmCapacity + capacityGain,
    },
    payablesLines,
    hiresBySeason: { ...(save.hiresBySeason ?? {}), [seasonKey]: hired + 1 },
    employees: [
      ...(save.employees ?? []),
      {
        id: employeeId,
        name: candidate.name,
        role: mode === "intern" ? "Intern" : roleLabel(role),
        salary,
        seasonHired: Number(seasonKey),
        competenceGain,
        visibilityGain,
        capacityGain,
        ...(mode === "full_time" ? { productivityPct: productivity, tenureCapacityBonus: 0 } : {}),
      },
    ],
  };
}

function resolveMandatoryLayoffs(save: NewGamePayload): NewGamePayload {
  let next = save;
  let guard = 0;
  while (liquidityEur(next) < 0 && (next.employees?.length ?? 0) > 0 && guard < 25) {
    guard += 1;
    const employee = (next.employees ?? []).reduce((worst, current) =>
      current.salary > worst.salary ? current : worst
    );
    const result = fireEmployeeForPayrollShortfall(next, employee.id);
    if (!result.ok) break;
    next = result.save;
  }
  return next;
}

function playSeasonForProfit(save: NewGamePayload, season: number, seedBase: string): NewGamePayload {
  const seasonKey = String(season);
  const planned = plannedClientCountForSeason(
    season,
    save.resources.visibility,
    `${seedBase}|slots`,
    save.seasonEntryScoresBySeason?.[seasonKey]?.vScore
  );

  const built = buildSeasonClients(
    seedBase,
    season,
    planned,
    {
      reputation: save.reputation ?? STARTING_REPUTATION,
      visibility: save.resources.visibility,
      competence: save.resources.competence,
    },
    save.usedScenarioIds ?? [],
    save.seasonEntryScoresBySeason?.[seasonKey]
  );

  const picks = bestProfitPlan(save, season, built.clients, seedBase);
  return applySeasonPlan(save, season, built.clients, built.usedScenarioIds, picks, seedBase);
}

function bestProfitPlan(
  save: NewGamePayload,
  season: number,
  clients: SeasonClient[],
  seedBase: string
): Choice[] {
  const startEur = save.resources.eur;
  const startCap = save.resources.firmCapacity;
  const optionsByClient = clients.map((client) =>
    buildSolutionOptionsForClient(client).filter((option) => !option.isRejectOption)
  );
  const needOne = maxExecutionsPossible(clients, startEur, startCap, optionsByClient) > 0;

  let bestProfit = -Infinity;
  let bestExec = -1;
  let bestPicks: Choice[] = [];

  const dfs = (index: number, eur: number, cap: number, picks: Choice[]) => {
    if (index >= clients.length) {
      let profit = 0;
      let exec = 0;
      for (let i = 0; i < clients.length; i += 1) {
        const choice = picks[i]!;
        if (choice === "reject") continue;
        exec += 1;
        profit += clients[i]!.budgetSeason1 - choice.costBudget;
      }
      if (needOne && exec === 0) return;
      if (profit > bestProfit || (profit === bestProfit && exec > bestExec)) {
        bestProfit = profit;
        bestExec = exec;
        bestPicks = [...picks];
      }
      return;
    }

    const client = clients[index]!;
    const liquid = eur + client.budgetSeason1;
    dfs(index + 1, eur, cap, [...picks, "reject"]);
    for (const option of optionsByClient[index]!) {
      if (!canAffordSolution(option, liquid, cap)) continue;
      dfs(
        index + 1,
        eur + client.budgetSeason1 - option.costBudget,
        cap - option.costCapacity,
        [...picks, option]
      );
    }
  };

  dfs(0, startEur, startCap, []);
  return bestPicks;
}

function applySeasonPlan(
  save: NewGamePayload,
  season: number,
  clients: SeasonClient[],
  usedScenarioIds: string[],
  picks: Choice[],
  seedBase: string
): NewGamePayload {
  const seasonKey = String(season);
  const outcomeScoreSeason: 1 | 2 | 3 = season >= 3 ? 3 : season >= 2 ? 2 : 1;
  const visibility = save.resources.visibility;
  const competence = save.resources.competence;
  let eur = save.resources.eur;
  let cap = save.resources.firmCapacity;
  const runs: SeasonClientRun[] = [];

  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]!;
    const choice = picks[index]!;
    if (choice === "reject") {
      runs.push({ clientId: client.id, accepted: false, solutionId: "reject" });
      continue;
    }

    const outcome = resolveClientOutcome({
      seed: `${seedBase}|${season}|${client.id}|${choice.id}`,
      solution: choice,
      visibility,
      competence,
      discipline: client.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(client),
      outcomeScoreSeason,
    });

    eur += client.budgetSeason1 - choice.costBudget;
    cap = Math.max(0, cap - choice.costCapacity);
    runs.push({
      clientId: client.id,
      accepted: true,
      solutionId: choice.id,
      outcome,
      costBudget: choice.costBudget,
      costCapacity: choice.costCapacity,
      solutionTitle: choice.title,
    });
  }

  return {
    ...save,
    phase: "season",
    seasonNumber: season,
    usedScenarioIds,
    resources: {
      ...save.resources,
      eur,
      firmCapacity: cap,
    },
    seasonLoopBySeason: {
      ...(save.seasonLoopBySeason ?? {}),
      [seasonKey]: {
        plannedClientCount: clients.length,
        currentClientIndex: clients.length,
        clientsQueue: clients,
        runs,
      },
    },
  };
}

function runPostSeasonNoSpend(save: NewGamePayload, season: number): NewGamePayload {
  const seasonKey = String(season);
  const loop = save.seasonLoopBySeason?.[seasonKey];
  if (!loop) return save;

  let next = save;
  for (const run of loop.runs) {
    if (!run.accepted || run.solutionId === "reject" || !run.outcome) continue;
    const updated = applyPostSeasonChoice(next, seasonKey, run.clientId, "none", season);
    if (updated) next = updated;
  }
  return next;
}

function resolveCarryoversNoSpend(save: NewGamePayload, seedBase: string): NewGamePayload {
  let next = save;
  const entries = getSeasonCarryoverEntries(next, 2);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const options = buildCarryoverSolutionOptionsForClient(entry.client);
    const doNothing = options.find((option) => option.id === "reject") ?? options[0];
    if (!doNothing) continue;
    const updated = applySeason2CarryoverChoice(
      structuredClone(next),
      2,
      entry.client.id,
      doNothing,
      `${seedBase}|${entry.client.id}|${index}|none`
    );
    if (updated) next = updated;
  }
  return next;
}

function maxExecutionsPossible(
  clients: SeasonClient[],
  startEur: number,
  startCap: number,
  optionsByClient: SolutionOption[][]
): number {
  let best = 0;
  const dfs = (index: number, eur: number, cap: number, count: number) => {
    if (index >= clients.length) {
      best = Math.max(best, count);
      return;
    }
    const client = clients[index]!;
    const liquid = eur + client.budgetSeason1;
    dfs(index + 1, eur, cap, count);
    for (const option of optionsByClient[index]!) {
      if (!canAffordSolution(option, liquid, cap)) continue;
      dfs(index + 1, eur + client.budgetSeason1 - option.costBudget, cap - option.costCapacity, count + 1);
    }
  };
  dfs(0, startEur, startCap, 0);
  return best;
}

function hash32(input: string): number {
  let h = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    h ^= input.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main();
