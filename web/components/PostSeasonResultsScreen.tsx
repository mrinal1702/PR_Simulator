"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  acceptedRunsWithOutcomes,
  applyPostSeasonChoice,
  buildArc1Text,
  canAffordEffectivenessBoost,
  canAffordReachBoost,
  canAffordSeason2EffectivenessBoost,
  canAffordSeason2ReachBoost,
  getClientBudgetTier,
  getSeason2EffectivenessBoostCostCapacity,
  getSeason2ReachBoostCostEur,
  POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY,
  POST_SEASON_REACH_BOOST_COST_EUR,
  postSeasonCompletedCount,
  postSeasonNextRunIndex,
  postSeasonScenarioCompletenessPercent,
} from "@/lib/postSeasonResults";
import { isPostSeasonResolutionComplete } from "@/lib/seasonCarryover";
import { getScenarioById } from "@/lib/scenarios";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceBreakdownHost } from "@/components/AgencyFinanceBreakdownHost";
import { AgencyFinanceSnapshot } from "@/components/AgencyFinanceSnapshot";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { BreakdownMetric } from "@/lib/metricBreakdown";

export function PostSeasonResultsScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [blurbExpanded, setBlurbExpanded] = useState(false);
  const prevScenarioClientIdRef = useRef<string | null>(null);

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];
  const resolutionsDone = useMemo(
    () => (save && season >= 2 ? isPostSeasonResolutionComplete(save, season) : true),
    [save, season]
  );

  const accepted = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const nextIdx = useMemo(() => postSeasonNextRunIndex(accepted), [accepted]);
  const completed = useMemo(() => postSeasonCompletedCount(accepted), [accepted]);
  const total = accepted.length;
  const done = total > 0 && nextIdx >= total;
  const currentRun = !done && nextIdx < total ? accepted[nextIdx] : null;
  const currentClient = currentRun ? loop?.clientsQueue.find((c) => c.id === currentRun.clientId) : null;

  useEffect(() => {
    setBlurbExpanded(false);
  }, [currentClient?.id]);

  useEffect(() => {
    const id = currentClient?.id;
    if (!id) return;
    const prev = prevScenarioClientIdRef.current;
    if (prev !== null && prev !== id && total > 1) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    prevScenarioClientIdRef.current = id;
  }, [currentClient?.id, total]);

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
    setNotice(ok ? "" : "Saved locally may have failed.");
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
      <>
        <div className="shell shell-wide">
          <header style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem" }}>
              <Link href="/">← {GAME_TITLE}</Link>
            </p>
            <h1 style={{ margin: 0 }}>Post-season {season} · Results</h1>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              No season data for this year. Return to the season hub.
            </p>
          </header>
          <AgencyResourceStrip save={save} />
          <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />
          <Link href={`/game/season/${season}`} className="btn btn-secondary" style={{ textDecoration: "none", width: "fit-content" }}>
            Back to season hub
          </Link>
        </div>
        {breakdownMetric ? (
          <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
        ) : null}
      </>
    );
  }

  if (season >= 2 && !resolutionsDone) {
    return (
      <>
        <div className="shell shell-wide">
          <header style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem" }}>
              <Link href="/">← {GAME_TITLE}</Link>
            </p>
            <h1 style={{ margin: 0 }}>Post-season {season} · Scenario review</h1>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              Review the completed rollover scenarios first, then return here for the fresh Season {season} scenarios.
            </p>
          </header>
          <AgencyResourceStrip save={save} />
          <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />
          <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
            Back to post-season
          </Link>
        </div>
        {breakdownMetric ? (
          <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
        ) : null}
      </>
    );
  }

  if (total === 0) {
    return (
      <>
        <div className="shell shell-wide">
          <header style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem" }}>
              <Link href="/">← {GAME_TITLE}</Link>
            </p>
            <h1 style={{ margin: 0 }}>Post-season {season} · Results</h1>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              There are no completed campaigns to review (every client was rejected or has no outcome).
            </p>
          </header>
          <AgencyResourceStrip save={save} />
          <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />
          <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
            Back to post-season
          </Link>
        </div>
        {breakdownMetric ? (
          <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
        ) : null}
      </>
    );
  }

  if (done) {
    return (
      <>
        <div className="shell shell-wide">
          <header style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem" }}>
              <Link href="/">← {GAME_TITLE}</Link>
            </p>
            <h1 style={{ margin: 0 }}>Post-season {season} · Results complete</h1>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              You have reviewed every campaign from this season in order.
            </p>
          </header>
          <AgencyResourceStrip save={save} />
          <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />
          <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
            Back to post-season
          </Link>
        </div>
        {breakdownMetric ? (
          <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
        ) : null}
      </>
    );
  }

  if (!currentRun?.outcome || !currentClient) {
    return (
      <>
        <div className="shell shell-wide">
          <header style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem" }}>
              <Link href="/">← {GAME_TITLE}</Link>
            </p>
            <h1 style={{ margin: 0 }}>Post-season {season} · Results</h1>
            <p className="muted" style={{ marginTop: "0.5rem" }}>Missing client data for this step.</p>
          </header>
          <AgencyResourceStrip save={save} />
          <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />
          <button type="button" className="btn btn-secondary" onClick={() => setSave(loadSave())}>
            Refresh
          </button>
        </div>
        {breakdownMetric ? (
          <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
        ) : null}
      </>
    );
  }

  const reach = currentRun.outcome.messageSpread;
  const effectiveness = currentRun.outcome.messageEffectiveness;
  const completeness = postSeasonScenarioCompletenessPercent(season);
  const season2Flow = season >= 2;
  const scenario = currentClient ? getScenarioById(currentClient.scenarioId) : undefined;
  const arc1Text = buildArc1Text(
    (scenario as Record<string, unknown> | undefined)?.arc_1,
    reach,
    effectiveness
  );
  const clientKindLabel = currentClient.clientKind.replace(/_/g, " ");
  const affordReach = season2Flow
    ? canAffordSeason2ReachBoost(save.resources.eur, currentClient)
    : canAffordReachBoost(save.resources.eur);
  const affordEff = season2Flow
    ? canAffordSeason2EffectivenessBoost(save.resources.firmCapacity, currentClient)
    : canAffordEffectivenessBoost(save.resources.firmCapacity);
  const reachCost = season2Flow ? getSeason2ReachBoostCostEur(currentClient) : POST_SEASON_REACH_BOOST_COST_EUR;
  const effCost = season2Flow
    ? getSeason2EffectivenessBoostCostCapacity(currentClient)
    : POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY;
  const budgetTier = season2Flow ? getClientBudgetTier(currentClient) : 1;

  return (
    <>
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`} className="muted">
            Post-season {season}
          </Link>
        </p>
        <h1 style={{ margin: 0 }}>Scenario review</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Scenario {completed + 1} of {total}
        </p>
      </header>

      <AgencyResourceStrip save={save} />
      <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />

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
        <p
          className="muted"
          style={{ margin: "0 0 0.2rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {clientKindLabel}
        </p>
        <h2 style={{ margin: "0 0 0.2rem", fontSize: "1.15rem", fontFamily: "var(--font-display)" }}>{currentClient.scenarioTitle}</h2>
        <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.9rem" }}>{currentClient.displayName}</p>

        {!blurbExpanded ? (
          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
            {currentClient.problem.length > 160 ? `${currentClient.problem.slice(0, 160)}…` : currentClient.problem}
          </p>
        ) : (
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", lineHeight: 1.55 }}>{currentClient.problem}</p>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "0.3rem 0.6rem", fontSize: "0.82rem" }}
          onClick={() => setBlurbExpanded((v) => !v)}
        >
          {blurbExpanded ? "Show less" : "Show more"}
        </button>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p className="scenario-campaign-results-kicker">Your in-season choice</p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.96rem", lineHeight: 1.5 }}>
          <strong>{currentRun.solutionTitle ?? currentRun.solutionId}</strong>
        </p>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p className="scenario-campaign-results-kicker">So what happened?</p>
        <p className="muted" style={{ margin: "0.35rem 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
          <strong>Message reach:</strong> {reach}% · <strong>Message effectiveness:</strong> {effectiveness}%
        </p>
        <p style={{ margin: 0, lineHeight: 1.55, fontSize: "0.95rem" }}>{arc1Text}</p>
      </section>

      <section className="agency-stats-panel">
        <p className="scenario-campaign-results-kicker">Optional boost</p>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.92rem" }}>
          {season2Flow
            ? `Pick one: increase reach or increase effectiveness. You can only choose one per scenario. Each increase is based on your Season ${season} competence score, up to 5%, with a small roll. This is a tier ${budgetTier} client.`
            : "Pick one: increase reach or increase effectiveness. You can only choose one per scenario. Each increase is based on firm competence, up to 5%."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.85rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !affordReach}
            onClick={() => commitChoice("reach")}
            style={{ justifyContent: "flex-start", textAlign: "left" }}
          >
            <span className="postseason-boost-cost-line">
              Increase reach (up to 5%) — costs{" "}
              <ResourceSymbol id="eur" size={16} />
              {" "}
              {reachCost.toLocaleString("en-GB")}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !affordEff}
            onClick={() => commitChoice("effectiveness")}
            style={{ justifyContent: "flex-start", textAlign: "left" }}
          >
            <span className="postseason-boost-cost-line">
              Increase effectiveness (up to 5%) — costs{" "}
              <ResourceSymbol id="capacity" size={16} />
              {" "}
              {effCost} capacity
            </span>
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => commitChoice("none")}>
            Do nothing (no cost)
          </button>
        </div>
        {!affordReach ? (
          <p className="muted postseason-boost-unavailable" style={{ margin: "0.5rem 0 0", fontSize: "0.88rem" }}>
            Reach boost is unavailable: need{" "}
            <ResourceSymbol id="eur" size={15} />
            {" "}
            {reachCost.toLocaleString("en-GB")} (you have{" "}
            <ResourceSymbol id="eur" size={15} />
            {" "}
            {save.resources.eur.toLocaleString("en-GB")}).
          </p>
        ) : null}
        {!affordEff ? (
          <p className="muted postseason-boost-unavailable" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            Effectiveness boost is unavailable: need{" "}
            <ResourceSymbol id="capacity" size={15} />
            {" "}
            {effCost} capacity (you have{" "}
            <ResourceSymbol id="capacity" size={15} />
            {" "}
            {save.resources.firmCapacity}).
          </p>
        ) : null}
        {notice ? <p style={{ marginTop: "0.75rem" }}>{notice}</p> : null}
      </section>
    </div>
    {breakdownMetric ? (
      <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
    ) : null}
    </>
  );
}
