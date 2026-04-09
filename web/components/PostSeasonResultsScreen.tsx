"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  acceptedRunsWithOutcomes,
  applyPostSeasonChoice,
  buildPostSeasonArcBlurb,
  canAffordEffectivenessBoost,
  canAffordReachBoost,
  POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY,
  POST_SEASON_REACH_BOOST_COST_EUR,
  postSeasonBoostPointsFromCompetence,
  postSeasonCompletedCount,
  postSeasonNextRunIndex,
  postSeasonScenarioCompletenessPercent,
} from "@/lib/postSeasonResults";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

export function PostSeasonResultsScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];

  const accepted = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const nextIdx = useMemo(() => postSeasonNextRunIndex(accepted), [accepted]);
  const completed = useMemo(() => postSeasonCompletedCount(accepted), [accepted]);
  const total = accepted.length;
  const done = total > 0 && nextIdx >= total;
  const currentRun = !done && nextIdx < total ? accepted[nextIdx] : null;
  const currentClient = currentRun ? loop?.clientsQueue.find((c) => c.id === currentRun.clientId) : null;

  const boostPreview = save ? postSeasonBoostPointsFromCompetence(save.resources.competence) : 0;

  const commitChoice = (choice: "reach" | "effectiveness" | "none") => {
    if (!save || !loop || !currentRun || busy) return;
    setBusy(true);
    setNotice("");
    const next = applyPostSeasonChoice(save, seasonKey, currentRun.clientId, choice, season);
    if (!next) {
      setNotice("Could not apply that choice (check resources).");
      setBusy(false);
      return;
    }
    const ok = persistSave(next);
    setSave(next);
    const updatedRun = next.seasonLoopBySeason?.[seasonKey]?.runs.find((r) => r.clientId === currentRun.clientId);
    const ps = updatedRun?.postSeason;
    const rewardLine =
      ps != null
        ? `Reputation ${(ps.reputationDelta ?? 0) >= 0 ? "+" : ""}${ps.reputationDelta ?? 0} · Visibility +${ps.visibilityGain ?? 0}`
        : "";
    setNotice([rewardLine, ok ? "" : "Saved locally may have failed."].filter(Boolean).join(" · "));
    setBusy(false);
  };

  if (!save) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>No active save found</h1>
        <Link href="/game/new" className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          New game
        </Link>
      </div>
    );
  }

  if (!loop) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Post-season {season} · Results</h1>
        <p className="muted">No season data for this year. Return to the season hub.</p>
        <Link href={`/game/season/${season}`} className="btn btn-secondary" style={{ textDecoration: "none", width: "fit-content" }}>
          Back to season hub
        </Link>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Post-season {season} · Results</h1>
        <p className="muted">There are no completed campaigns to review (every client was rejected or has no outcome).</p>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          Back to post-season
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Post-season {season} · Results complete</h1>
        <p className="muted">You have reviewed every campaign from this season in order.</p>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          Back to post-season
        </Link>
      </div>
    );
  }

  if (!currentRun?.outcome || !currentClient) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="muted">Missing client data for this step.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setSave(loadSave())}>
          Refresh
        </button>
      </div>
    );
  }

  const reach = currentRun.outcome.messageSpread;
  const effectiveness = currentRun.outcome.messageEffectiveness;
  const completeness = postSeasonScenarioCompletenessPercent(season);
  const affordReach = canAffordReachBoost(save.resources.eur);
  const affordEff = canAffordEffectivenessBoost(save.resources.firmCapacity);

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`} className="muted">
            Post-season {season}
          </Link>
        </p>
        <h1 style={{ margin: 0 }}>Campaign results</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Scenario {completed + 1} of {total}
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Scenario arc completeness
        </p>
        <div className="metric-track" role="presentation" style={{ marginTop: "0.35rem" }}>
          <div className="metric-fill" style={{ width: `${completeness}%`, background: "var(--accent)" }} />
        </div>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
          {completeness}% complete
        </p>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem", fontFamily: "var(--font-display)" }}>{currentClient.scenarioTitle}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {currentClient.displayName} · {currentClient.problem}
        </p>
        <p style={{ margin: "0.75rem 0 0" }}>
          <strong>Message reach:</strong> {reach}% · <strong>Message effectiveness:</strong> {effectiveness}%
        </p>
        <p style={{ margin: "0.75rem 0 0", lineHeight: 1.55 }}>{buildPostSeasonArcBlurb(currentClient, reach, effectiveness)}</p>
      </section>

      <section className="agency-stats-panel">
        <h3 style={{ marginTop: 0, fontSize: "1.05rem" }}>Optional boost</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          Pick one: boost reach or boost effectiveness. You can only choose one per scenario. Current boost value: <strong>+{boostPreview}%</strong>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.85rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !affordReach}
            onClick={() => commitChoice("reach")}
            style={{ justifyContent: "space-between", textAlign: "left" }}
          >
            <span>
              Boost reach (+{boostPreview}% max 5%) — costs EUR {POST_SEASON_REACH_BOOST_COST_EUR.toLocaleString("en-GB")}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !affordEff}
            onClick={() => commitChoice("effectiveness")}
            style={{ justifyContent: "space-between", textAlign: "left" }}
          >
            <span>
              Boost effectiveness (+{boostPreview}% max 5%) — costs {POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY} capacity
            </span>
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => commitChoice("none")}>
            Do nothing (no cost)
          </button>
        </div>
        {!affordReach ? (
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.88rem" }}>
            Reach boost is unavailable: need EUR {POST_SEASON_REACH_BOOST_COST_EUR.toLocaleString("en-GB")} (you have{" "}
            {save.resources.eur.toLocaleString("en-GB")}).
          </p>
        ) : null}
        {!affordEff ? (
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            Effectiveness boost is unavailable: need {POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY} capacity (you have{" "}
            {save.resources.firmCapacity}).
          </p>
        ) : null}
        {notice ? <p style={{ marginTop: "0.75rem" }}>{notice}</p> : null}
      </section>
    </div>
  );
}
