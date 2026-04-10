import type { NewGamePayload } from "@/components/NewGameWizard";
import type { SeasonClient, SeasonClientRun } from "@/lib/seasonClientLoop";
import type { BuildId } from "@/lib/gameEconomy";

export type CarryoverEntry = {
  client: SeasonClient;
  run: SeasonClientRun & { outcome: NonNullable<SeasonClientRun["outcome"]> };
};

export function getSeasonCarryoverEntries(save: NewGamePayload, season: number): CarryoverEntry[] {
  if (season <= 1) return [];
  const previousSeasonKey = String(season - 1);
  const previousLoop = save.seasonLoopBySeason?.[previousSeasonKey];
  if (!previousLoop) return [];

  const runByClient = new Map(previousLoop.runs.map((r) => [r.clientId, r]));
  const out: CarryoverEntry[] = [];
  for (const client of previousLoop.clientsQueue) {
    const run = runByClient.get(client.id);
    if (!run?.accepted || run.solutionId === "reject" || !run.outcome) continue;
    out.push({
      client,
      run: {
        ...run,
        outcome: run.outcome,
      },
    });
  }
  return out;
}

export function getSeasonCarryoverProgress(save: NewGamePayload, season: number): number {
  const key = String(season);
  const raw = save.rolloverReviewProgressBySeason?.[key] ?? 0;
  return Math.max(0, Math.floor(raw));
}

export function isSeasonCarryoverComplete(save: NewGamePayload, season: number): boolean {
  const entries = getSeasonCarryoverEntries(save, season);
  if (entries.length === 0) return true;
  return getSeasonCarryoverProgress(save, season) >= entries.length;
}

export function advanceSeasonCarryoverProgress(save: NewGamePayload, season: number): NewGamePayload {
  const key = String(season);
  const entries = getSeasonCarryoverEntries(save, season);
  const current = getSeasonCarryoverProgress(save, season);
  const next = Math.min(entries.length, current + 1);
  return {
    ...save,
    rolloverReviewProgressBySeason: {
      ...(save.rolloverReviewProgressBySeason ?? {}),
      [key]: next,
    },
  };
}

export function applyBuildOutcomeShift(
  buildId: BuildId,
  reach: number,
  effectiveness: number
): { reach: number; effectiveness: number } {
  let reachDelta = 0;
  let effectivenessDelta = 0;
  if (buildId === "summa_cum_basement") {
    reachDelta = -5;
    effectivenessDelta = 5;
  } else if (buildId === "velvet_rolodex") {
    reachDelta = 5;
    effectivenessDelta = -5;
  }
  return {
    reach: clampPercent(reach + reachDelta),
    effectiveness: clampPercent(effectiveness + effectivenessDelta),
  };
}

export function highLowLabelsFromThreshold(
  reach: number,
  effectiveness: number
): { reach: "high" | "low"; effectiveness: "high" | "low" } {
  return {
    reach: reach >= 50 ? "high" : "low",
    effectiveness: effectiveness >= 50 ? "high" : "low",
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
