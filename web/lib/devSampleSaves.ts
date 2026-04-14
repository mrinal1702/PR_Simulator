import type { NewGamePayload } from "@/components/NewGameWizard";
import { applySpouseAtStart, STARTING_BUILD_STATS, STARTING_REPUTATION } from "@/lib/gameEconomy";
import type { SeasonClientRun } from "@/lib/seasonClientLoop";

export function buildSeason1SummarySampleSave(): NewGamePayload {
  const initialResources = applySpouseAtStart(STARTING_BUILD_STATS.velvet_rolodex, "supportive");

  return {
    playerName: "Alex",
    agencyName: "Signal & Salvage",
    gender: "non_binary",
    buildId: "velvet_rolodex",
    spouseType: "supportive",
    spouseGender: "female",
    spouseName: "Mina",
    seasonNumber: 1,
    phase: "postseason",
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: { "1": "network" },
    preseasonFocusCounts: {
      strategy_workshop: 0,
      network: 1,
    },
    reputation: 11,
    resources: {
      eur: 41000,
      competence: 54,
      visibility: 95,
      firmCapacity: 42,
    },
    initialResources,
    initialReputation: STARTING_REPUTATION,
    employees: [],
    seasonLoopBySeason: {
      "1": {
        plannedClientCount: 3,
        currentClientIndex: 3,
        clientsQueue: [
          {
            id: "s1-c1",
            displayName: "Tara Voss",
            clientKind: "small_business",
            budgetTier: 1,
            problem: "A local restaurant owner got filmed berating staff and the clip is now bouncing across every neighborhood page.",
            budgetTotal: 52000,
            budgetSeason1: 36000,
            budgetSeason2: 16000,
            scenarioId: "debug-s1-summary-1",
            scenarioTitle: "The Mayor's Favorite Bistro",
            scenarioSolutions: [],
            hiddenDiscipline: 61,
            hiddenPreferenceMotive: "balanced",
            satisfactionReachWeight: 0.48,
          },
          {
            id: "s1-c2",
            displayName: "Jules Mercer",
            clientKind: "individual",
            budgetTier: 1,
            problem: "A wellness influencer launched a miracle sleep powder and then posted from a nightclub with captions that made the product look fake.",
            budgetTotal: 50000,
            budgetSeason1: 35000,
            budgetSeason2: 15000,
            scenarioId: "debug-s1-summary-2",
            scenarioTitle: "Sleep Powder Spiral",
            scenarioSolutions: [],
            hiddenDiscipline: 44,
            hiddenPreferenceMotive: "spread_first",
            satisfactionReachWeight: 0.68,
          },
          {
            id: "s1-c3",
            displayName: "Northline Robotics",
            clientKind: "corporate",
            budgetTier: 1,
            problem: "A board member's leaked memo made the company sound delighted about layoffs, and investors started calling before HR did.",
            budgetTotal: 68000,
            budgetSeason1: 48000,
            budgetSeason2: 20000,
            scenarioId: "debug-s1-summary-3",
            scenarioTitle: "Memo From the Abyss",
            scenarioSolutions: [],
            hiddenDiscipline: 72,
            hiddenPreferenceMotive: "effectiveness_first",
            satisfactionReachWeight: 0.32,
          },
        ],
        runs: [
          {
            clientId: "s1-c1",
            accepted: true,
            solutionId: "solution_2",
            costBudget: 11000,
            costCapacity: 18,
            solutionTitle: "Rebuild trust with receipts",
            outcome: {
              messageSpread: 71,
              messageEffectiveness: 78,
              satisfaction: 75,
            },
            postSeason: {
              choice: "effectiveness",
              boostPointsApplied: 4,
              reachPercent: 71,
              effectivenessPercent: 78,
              reputationDelta: 4,
              visibilityGain: 8,
            },
          },
          {
            clientId: "s1-c2",
            accepted: true,
            solutionId: "solution_3",
            costBudget: 12000,
            costCapacity: 16,
            solutionTitle: "Turn the mess into a redemption tour",
            outcome: {
              messageSpread: 83,
              messageEffectiveness: 53,
              satisfaction: 74,
            },
            postSeason: {
              choice: "reach",
              boostPointsApplied: 4,
              reachPercent: 83,
              effectivenessPercent: 53,
              reputationDelta: 2,
              visibilityGain: 10,
            },
          },
          {
            clientId: "s1-c3",
            accepted: false,
            solutionId: "reject",
          },
        ],
        lastOutcome: {
          messageSpread: 83,
          messageEffectiveness: 53,
          satisfaction: 74,
        },
      },
    },
    rolloverReviewProgressBySeason: {},
    postSeasonResolutionProgressBySeason: {},
    seasonEntryScoresBySeason: {
      "1": { vScore: 62, cScore: 51 },
    },
    usedScenarioIds: ["debug-s1-summary-1", "debug-s1-summary-2", "debug-s1-summary-3"],
    preseasonEntrySpouseGrantSeasons: [],
    preseasonEntryRevealPending: undefined,
    payrollPaidBySeason: {},
    voluntaryLayoffsBySeason: {},
    talentBazaarBannedNames: [],
    talentBazaarJuniorNamesUsed: [],
    payablesLines: [],
    createdAt: "2026-04-12T10:30:00.000Z",
  };
}

export function buildSeason2SummaryNoLayoffSampleSave(): NewGamePayload {
  const initialResources = applySpouseAtStart(STARTING_BUILD_STATS.velvet_rolodex, "supportive");

  return {
    playerName: "Alex",
    agencyName: "Signal & Salvage",
    gender: "non_binary",
    buildId: "velvet_rolodex",
    spouseType: "supportive",
    spouseGender: "female",
    spouseName: "Mina",
    seasonNumber: 2,
    phase: "postseason",
    activityFocusUsedInPreseason: true,
    preseasonActionBySeason: { "1": "network", "2": "strategy_workshop" },
    preseasonFocusCounts: {
      strategy_workshop: 1,
      network: 1,
    },
    reputation: 42,
    resources: {
      eur: 82000,
      competence: 74,
      visibility: 134,
      firmCapacity: 41,
    },
    initialResources,
    initialReputation: STARTING_REPUTATION,
    employees: [
      {
        id: "emp-senior",
        name: "Leah Park",
        role: "Senior Strategist",
        salary: 9000,
        seasonHired: 1,
        competenceGain: 8,
        visibilityGain: 3,
        capacityGain: 14,
        productivityPct: 82,
        tenureCapacityBonus: 2,
      },
      {
        id: "emp-analyst",
        name: "Owen Price",
        role: "Media Analyst",
        salary: 7000,
        seasonHired: 2,
        competenceGain: 4,
        visibilityGain: 2,
        capacityGain: 10,
        productivityPct: 64,
        tenureCapacityBonus: 0,
      },
    ],
    seasonLoopBySeason: {
      "1": {
        plannedClientCount: 2,
        currentClientIndex: 2,
        clientsQueue: [
          {
            id: "s1-c1",
            displayName: "Cora Bell",
            clientKind: "small_business",
            budgetTier: 1,
            problem: "A beloved bakery chain got roasted for shrinking portions while quietly raising prices.",
            budgetTotal: 52000,
            budgetSeason1: 36000,
            budgetSeason2: 16000,
            scenarioId: "debug-s2-rollover-1",
            scenarioTitle: "Bakery Backlash",
            scenarioSolutions: [],
            hiddenDiscipline: 58,
            hiddenPreferenceMotive: "balanced",
            satisfactionReachWeight: 0.48,
            postSeasonArcOutcomes: {
              low_visibility_low_effectiveness: "The apology lands with a thud and regulars keep posting side-by-side comparisons.",
              low_visibility_high_effectiveness: "The owner looks contrite and local coverage softens, even if the story stays small.",
              high_visibility_low_effectiveness: "The response travels fast, but people mostly share it to mock the spin.",
              high_visibility_high_effectiveness: "The turnaround is visible and believable enough to calm the regulars.",
            },
          },
          {
            id: "s1-c2",
            displayName: "Northstar Events",
            clientKind: "corporate",
            budgetTier: 1,
            problem: "A flagship conference imploded after a speaker scandal and the brand was accused of panic-booking replacements.",
            budgetTotal: 70000,
            budgetSeason1: 49000,
            budgetSeason2: 21000,
            scenarioId: "debug-s2-rollover-2",
            scenarioTitle: "Conference Collapse",
            scenarioSolutions: [],
            hiddenDiscipline: 67,
            hiddenPreferenceMotive: "effectiveness_first",
            satisfactionReachWeight: 0.34,
            postSeasonArcOutcomes: {
              low_visibility_low_effectiveness: "Trade press stays skeptical and sponsors keep asking pointed questions.",
              low_visibility_high_effectiveness: "The message does not travel far, but it reassures the people who matter.",
              high_visibility_low_effectiveness: "Everyone sees the response, but almost nobody believes it.",
              high_visibility_high_effectiveness: "A widely seen reset gives the event brand a credible second act.",
            },
          },
        ],
        runs: [
          {
            clientId: "s1-c1",
            accepted: true,
            solutionId: "solution_2",
            costBudget: 11000,
            costCapacity: 18,
            solutionTitle: "Publish the receipts",
            outcome: {
              messageSpread: 67,
              messageEffectiveness: 74,
              satisfaction: 71,
            },
            postSeason: {
              choice: "effectiveness",
              boostPointsApplied: 4,
              reachPercent: 67,
              effectivenessPercent: 74,
              reputationDelta: 3,
              visibilityGain: 8,
            },
            season2CarryoverResolution: {
              messageSpread: 76,
              messageEffectiveness: 84,
              satisfaction: 80,
              solutionId: "solution_4",
              costBudget: 9000,
              costCapacity: 11,
            },
          },
          {
            clientId: "s1-c2",
            accepted: true,
            solutionId: "solution_3",
            costBudget: 15000,
            costCapacity: 16,
            solutionTitle: "Flood the timeline with the replacement lineup",
            outcome: {
              messageSpread: 81,
              messageEffectiveness: 57,
              satisfaction: 65,
            },
            postSeason: {
              choice: "reach",
              boostPointsApplied: 4,
              reachPercent: 81,
              effectivenessPercent: 57,
              reputationDelta: 2,
              visibilityGain: 9,
            },
            season2CarryoverResolution: {
              messageSpread: 79,
              messageEffectiveness: 73,
              satisfaction: 75,
              solutionId: "solution_2",
              costBudget: 7000,
              costCapacity: 9,
            },
          },
        ],
        lastOutcome: {
          messageSpread: 79,
          messageEffectiveness: 73,
          satisfaction: 75,
        },
      },
      "2": {
        plannedClientCount: 2,
        currentClientIndex: 2,
        clientsQueue: [
          {
            id: "s2-c1",
            displayName: "Milo Hart",
            clientKind: "individual",
            budgetTier: 1,
            problem: "A comedian's charity gala joke bombed, and now every clip makes it look like the event itself was cynical.",
            budgetTotal: 50000,
            budgetSeason1: 35000,
            budgetSeason2: 15000,
            scenarioId: "debug-s2-fresh-1",
            scenarioTitle: "Gala Joke Fallout",
            scenarioSolutions: [],
            hiddenDiscipline: 49,
            hiddenPreferenceMotive: "spread_first",
            satisfactionReachWeight: 0.66,
            postSeasonArcOutcomes: {
              low_visibility_low_effectiveness: "The story sputters on, with fans confused and critics unconvinced.",
              low_visibility_high_effectiveness: "The correction reaches the right people, even if it never becomes a broad rebound.",
              high_visibility_low_effectiveness: "Everyone sees the explanation, but it mostly keeps the joke alive.",
              high_visibility_high_effectiveness: "The recovery feels human enough to turn a bad clip into a manageable bump.",
            },
          },
          {
            id: "s2-c2",
            displayName: "Harbor Mobility",
            clientKind: "small_business",
            budgetTier: 2,
            problem: "A scooter start-up promised a safety overhaul after crashes, then shipped a glossy campaign that looked like dodging the issue.",
            budgetTotal: 69000,
            budgetSeason1: 48000,
            budgetSeason2: 21000,
            scenarioId: "debug-s2-fresh-2",
            scenarioTitle: "Scooter Safety Spiral",
            scenarioSolutions: [],
            hiddenDiscipline: 63,
            hiddenPreferenceMotive: "effectiveness_first",
            satisfactionReachWeight: 0.37,
            postSeasonArcOutcomes: {
              low_visibility_low_effectiveness: "The promise of reform feels thin, and city reporters keep circling.",
              low_visibility_high_effectiveness: "The company looks serious in the rooms that matter, buying itself breathing room.",
              high_visibility_low_effectiveness: "The campaign gets attention, but mostly for the wrong reasons.",
              high_visibility_high_effectiveness: "Visible accountability starts to outpace the original criticism.",
            },
          },
        ],
        runs: [
          {
            clientId: "s2-c1",
            accepted: true,
            solutionId: "solution_3",
            costBudget: 12000,
            costCapacity: 14,
            solutionTitle: "Make the apology travel",
            outcome: {
              messageSpread: 72,
              messageEffectiveness: 58,
              satisfaction: 67,
            },
            postSeason: {
              choice: "reach",
              boostPointsApplied: 4,
              reachPercent: 76,
              effectivenessPercent: 58,
              reputationDelta: 20,
              visibilityGain: 12,
            },
          },
          {
            clientId: "s2-c2",
            accepted: true,
            solutionId: "solution_2",
            costBudget: 14000,
            costCapacity: 18,
            solutionTitle: "Prove the fix before selling it",
            outcome: {
              messageSpread: 61,
              messageEffectiveness: 77,
              satisfaction: 71,
            },
            postSeason: {
              choice: "effectiveness",
              boostPointsApplied: 4,
              reachPercent: 61,
              effectivenessPercent: 81,
              reputationDelta: 32,
              visibilityGain: 15,
            },
          },
        ],
        lastOutcome: {
          messageSpread: 61,
          messageEffectiveness: 81,
          satisfaction: 71,
        },
      },
    },
    rolloverReviewProgressBySeason: { "2": 2 },
    postSeasonResolutionProgressBySeason: { "2": 2 },
    seasonEntryScoresBySeason: {
      "1": { vScore: 62, cScore: 54 },
      "2": { vScore: 67, cScore: 58 },
    },
    usedScenarioIds: [
      "debug-s2-rollover-1",
      "debug-s2-rollover-2",
      "debug-s2-fresh-1",
      "debug-s2-fresh-2",
    ],
    preseasonEntrySpouseGrantSeasons: ["2"],
    preseasonEntryRevealPending: undefined,
    payrollPaidBySeason: { "2": true },
    voluntaryLayoffsBySeason: {},
    seasonCashAdjustmentsBySeason: {},
    talentBazaarBannedNames: [],
    talentBazaarJuniorNamesUsed: [],
    payablesLines: [
      { id: "wage-emp-senior", label: "Leah Park wage", amount: 9000 },
      { id: "wage-emp-analyst", label: "Owen Price wage", amount: 7000 },
    ],
    createdAt: "2026-04-12T16:00:00.000Z",
  };
}

/**
 * Season 2 post-season **in progress**: one rollover resolution recap left, first fresh campaign
 * post-season boost already chosen, second fresh campaign still waiting (reach / effectiveness / none).
 */
export function buildSeason2PostseasonMidFlowSampleSave(): NewGamePayload {
  const base = buildSeason2SummaryNoLayoffSampleSave();
  const loop = base.seasonLoopBySeason?.["2"];
  if (!loop) return base;

  const runs: SeasonClientRun[] = loop.runs.map((r) => {
    if (r.clientId === "s2-c2") {
      const { postSeason: _ps, ...rest } = r;
      return rest;
    }
    return r;
  });

  return {
    ...base,
    postSeasonResolutionProgressBySeason: { "2": 1 },
    seasonLoopBySeason: {
      ...base.seasonLoopBySeason,
      "2": { ...loop, runs },
    },
    createdAt: "2026-04-15T12:00:00.000Z",
  };
}

/**
 * End of Season 2 (post-season), same financial story as {@link buildSeason2SummaryNoLayoffSampleSave},
 * with cumulative wage payables settled for dev tooling (shopping budget / profit flashcard).
 * Wages settled: Season 1 start Leah 9k + Season 2 start 16k = 25k.
 */
export function buildShoppingCenterSampleSave(): NewGamePayload {
  const base = buildSeason2SummaryNoLayoffSampleSave();
  return {
    ...base,
    cumulativeWagesPaidEur: 25_000,
    createdAt: "2026-04-13T18:30:00.000Z",
  };
}
