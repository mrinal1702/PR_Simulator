import type { NewGamePayload } from "@/components/NewGameWizard";
import { getPostSeasonResolutionEntries } from "@/lib/seasonCarryover";

export type EndOfSeasonClientReviewRow = {
  clientId: string;
  scenarioTitle: string;
  clientDisplayName: string;
  reach: number;
  effectiveness: number;
  satisfaction: number;
  source: "rollover" | "season_campaign";
};

/**
 * Rows for the post–Season N (N ≥ 3) “Client reviews” digest: rollover scenarios whose carryover
 * finished this post-season, plus same-season campaigns that completed the post-season results flow.
 */
export function getEndOfPostSeasonClientReviewRows(
  save: NewGamePayload,
  postSeasonSeason: number
): EndOfSeasonClientReviewRow[] {
  if (postSeasonSeason < 3) return [];

  const rows: EndOfSeasonClientReviewRow[] = [];

  for (const { client, run } of getPostSeasonResolutionEntries(save, postSeasonSeason)) {
    const res = run.season2CarryoverResolution!;
    rows.push({
      clientId: client.id,
      scenarioTitle: client.scenarioTitle,
      clientDisplayName: client.displayName,
      reach: res.messageSpread,
      effectiveness: res.messageEffectiveness,
      satisfaction: res.satisfaction,
      source: "rollover",
    });
  }

  const loopKey = String(postSeasonSeason);
  const loop = save.seasonLoopBySeason?.[loopKey];
  if (loop) {
    for (const client of loop.clientsQueue) {
      const run = loop.runs.find((r) => r.clientId === client.id);
      if (!run?.accepted || run.solutionId === "reject" || !run.outcome || !run.postSeason) continue;
      rows.push({
        clientId: client.id,
        scenarioTitle: client.scenarioTitle,
        clientDisplayName: client.displayName,
        reach: run.postSeason.reachPercent,
        effectiveness: run.postSeason.effectivenessPercent,
        satisfaction: run.outcome.satisfaction,
        source: "season_campaign",
      });
    }
  }

  return rows;
}
