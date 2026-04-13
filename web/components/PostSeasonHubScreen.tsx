"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import {
  acceptedRunsWithOutcomes,
  buildArc1Text,
  POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY,
  POST_SEASON_REACH_BOOST_COST_EUR,
  getSeason2EffectivenessBoostCostCapacity,
  getSeason2ReachBoostCostEur,
  postSeasonCompletedCount,
  postSeasonNextRunIndex,
} from "@/lib/postSeasonResults";
import type { BreakdownMetric } from "@/lib/metricBreakdown";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceStatsRows } from "@/components/AgencyFinanceStatsRows";
import { AgencySnapshotCapacityRow, AgencySnapshotMetricRow } from "@/components/AgencySnapshotMetricRow";
import { EmployeeRosterList } from "@/components/EmployeeRosterList";
import { MetricBreakdownModalBody } from "@/components/MetricBreakdownModalBody";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { ClientBudgetTier } from "@/lib/clientEconomyMath";
import { getScenarioById } from "@/lib/scenarios";
import {
  getPendingReceivablesEur,
  hasLayoffPressure,
  liquidityEur,
  totalPayables,
} from "@/lib/payablesReceivables";
import {
  applySeasonCloseCarryoverStatGains,
  getPostSeasonResolutionEntries,
  isPostSeasonResolutionComplete,
} from "@/lib/seasonCarryover";

/** 0% dark red → 50% yellow → 100% dark green */
function metricPercentGradientColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const darkRed = { r: 127, g: 29, b: 29 };
  const yellow = { r: 234, g: 179, b: 8 };
  const darkGreen = { r: 22, g: 101, b: 52 };
  let r: number, g: number, b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = darkRed.r + (yellow.r - darkRed.r) * t;
    g = darkRed.g + (yellow.g - darkRed.g) * t;
    b = darkRed.b + (yellow.b - darkRed.b) * t;
  } else {
    const t = (p - 0.5) * 2;
    r = yellow.r + (darkGreen.r - yellow.r) * t;
    g = yellow.g + (darkGreen.g - yellow.g) * t;
    b = yellow.b + (darkGreen.b - yellow.b) * t;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function ScenarioMetricBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span className="scenario-summary-metric-bar" role="img" aria-label={`${w} percent`}>
      <span className="scenario-summary-metric-bar-fill" style={{ width: `${w}%`, display: "block" }} />
    </span>
  );
}

/** Post-season hub: agency snapshot (like season hub) + entry into mandatory results flow. */
export function PostSeasonHubScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showCaseLog, setShowCaseLog] = useState(false);
  const [showCampaignOverview, setShowCampaignOverview] = useState(false);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!save || season < 2 || save.phase !== "postseason") return;
    const normalized = applySeasonCloseCarryoverStatGains(save, season);
    if (normalized === save) return;
    setSave(normalized);
    persistSave(normalized);
  }, [save, season]);

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];

  const [expandedScenario, setExpandedScenario] = useState<Record<string, boolean>>({});
  const [expandedActiveCases, setExpandedActiveCases] = useState<Record<string, boolean>>({});
  const acceptedForResults = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const resultsTotal = acceptedForResults.length;
  const resultsDone =
    resultsTotal === 0 || postSeasonNextRunIndex(acceptedForResults) >= resultsTotal;
  const resultsProgress =
    resultsTotal > 0 ? `${postSeasonCompletedCount(acceptedForResults)} / ${resultsTotal} reviewed` : "—";
  const season1ActiveCasesViewed = save?.postSeasonActiveCasesViewedBySeason?.[seasonKey] === true;

  // Season 2+ resolution tracking
  const s2Entries = useMemo(() => (save && season >= 2 ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);
  const s2ResolutionsDone = useMemo(() => (save && season >= 2 ? isPostSeasonResolutionComplete(save, season) : true), [save, season]);
  const showHubControls = season === 1 || s2ResolutionsDone;
  const showSeasonScenarioButton = season >= 2 && s2ResolutionsDone && !resultsDone && resultsTotal > 0;
  const summaryReady = season >= 2 ? s2ResolutionsDone && resultsDone : resultsDone;

  const activeCases = useMemo(() => {
    if (season < 2 || !loop || !resultsDone) return [];
    return loop.clientsQueue.flatMap((client) => {
      const run = loop.runs.find((entry) => entry.clientId === client.id);
      if (!run?.accepted || run.solutionId === "reject" || !run.postSeason) return [];
      const scenario = getScenarioById(client.scenarioId) as Record<string, unknown> | undefined;
      const boost = run.postSeason.boostPointsApplied ?? 0;
      const initialReach =
        run.postSeason.choice === "reach"
          ? Math.max(0, run.postSeason.reachPercent - boost)
          : run.postSeason.reachPercent;
      const initialEffectiveness =
        run.postSeason.choice === "effectiveness"
          ? Math.max(0, run.postSeason.effectivenessPercent - boost)
          : run.postSeason.effectivenessPercent;
      return [
        {
          client,
          run,
          arc1Text: buildArc1Text(scenario?.arc_1, initialReach, initialEffectiveness),
        },
      ];
    });
  }, [season, loop, resultsDone]);
  const showActiveCasesToggle = season >= 2 && resultsDone && activeCases.length > 0;
  const season1ActiveCases = useMemo(() => {
    if (season !== 1 || !loop || !resultsDone) return [];
    return loop.clientsQueue.flatMap((client) => {
      const run = loop.runs.find((entry) => entry.clientId === client.id);
      if (!run?.accepted || run.solutionId === "reject" || !run.postSeason || !run.outcome) return [];
      const scenario = getScenarioById(client.scenarioId) as Record<string, unknown> | undefined;
      const boost = run.postSeason.boostPointsApplied ?? 0;
      const initialReach =
        run.postSeason.choice === "reach"
          ? Math.max(0, run.postSeason.reachPercent - boost)
          : run.postSeason.reachPercent;
      const initialEffectiveness =
        run.postSeason.choice === "effectiveness"
          ? Math.max(0, run.postSeason.effectivenessPercent - boost)
          : run.postSeason.effectivenessPercent;
      return [
        {
          client,
          run: {
            ...run,
            outcome: run.outcome,
          },
          arc1Text: buildArc1Text(scenario?.arc_1, initialReach, initialEffectiveness),
        },
      ];
    });
  }, [season, loop, resultsDone]);
  const showSeason1ActiveCasesToggle = season === 1 && resultsDone && season1ActiveCases.length > 0;

  const scenarioOverviewRows = useMemo(() => {
    if (!loop) return [];
    return loop.clientsQueue.flatMap((client) => {
      const run = loop.runs.find((r) => r.clientId === client.id);
      if (!run || !run.accepted || run.solutionId === "reject") return [];
      return [{ client, run }];
    });
  }, [loop]);

  const saveNow = () => {
    if (!save) return;
    const ok = persistSave(save);
    setNotice(ok ? "Progress saved." : "Could not save right now.");
  };

  const refresh = () => setSave(loadSave());

  const openSeason1ActiveCases = () => {
    if (!save) return;
    setShowCaseLog(true);
    if (season1ActiveCasesViewed) return;
    const next: NewGamePayload = {
      ...save,
      postSeasonActiveCasesViewedBySeason: {
        ...(save.postSeasonActiveCasesViewedBySeason ?? {}),
        [seasonKey]: true,
      },
    };
    setSave(next);
    persistSave(next);
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

  const visibilityForBands = getEffectiveVisibilityForAgency(save);
  const competenceForBands = getEffectiveCompetenceForAgency(save);

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Post-season {season}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Review outcomes and optional boosts. Competence is unchanged from the end of the season, while season-close carry-over outcomes are already reflected in reputation and visibility.
        </p>
      </header>

      <AgencyResourceStrip save={save} />

      <div className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p
          style={{
            margin: 0,
            fontWeight: 600,
            color: hasLayoffPressure(save) ? "#dc2626" : "#16a34a",
          }}
        >
          {hasLayoffPressure(save) ? "Layoff pressure" : "No layoff pressure"}
        </p>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
          Liquidity EUR {liquidityEur(save).toLocaleString("en-GB")} · Payables EUR{" "}
          {totalPayables(save).toLocaleString("en-GB")} · Receivables EUR{" "}
          {getPendingReceivablesEur(save).toLocaleString("en-GB")}
        </p>
      </div>

      {season >= 2 ? (
        <div className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>Post-season checklist</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
            {!s2ResolutionsDone
              ? "Start by acknowledging each completed scenario resolution."
              : !resultsDone
                ? `Completed scenarios are acknowledged. Next, review your fresh Season ${season} scenarios.`
                : "All post-season scenario reviews are complete. You can inspect the finished cases or continue to the season summary."}
          </p>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            {s2Entries.length > 0 ? (
              <Link
                href={`/game/postseason/${season}/resolutions`}
                className={`btn ${s2ResolutionsDone ? "btn-secondary" : "btn-primary"}`}
                style={{ textDecoration: "none" }}
              >
                Completed scenarios
              </Link>
            ) : null}
            {showSeasonScenarioButton ? (
              <Link
                href={`/game/postseason/${season}/results`}
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                Season {season} scenarios
              </Link>
            ) : null}
            {summaryReady ? (
              <Link
                href={`/game/postseason/${season}/summary`}
                className="btn btn-next-hint"
                style={{ textDecoration: "none" }}
              >
                Season summary
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section>
        {showHubControls ? (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowStats((v) => !v)}>
              {showStats ? "Hide agency stats" : "Agency stats"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEmployees((v) => !v)}>
              {showEmployees ? "Hide employees" : "Employees"}
            </button>
            {showSeason1ActiveCasesToggle ? (
              <button
                type="button"
                className={`btn ${season1ActiveCasesViewed ? "btn-secondary" : "btn-next-hint"}`}
                onClick={() => {
                  if (showCaseLog) {
                    setShowCaseLog(false);
                  } else {
                    openSeason1ActiveCases();
                  }
                }}
              >
                {showCaseLog ? "Hide active cases" : "Active Cases"}
              </button>
            ) : showActiveCasesToggle ? (
              <button type="button" className="btn btn-secondary" onClick={() => setShowCaseLog((v) => !v)}>
                {showCaseLog ? "Hide active cases" : "Active Cases"}
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={saveNow}>
              Save
            </button>
            <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={refresh}>
              Refresh
            </button>
          </div>
        ) : null}

        {showStats ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Agency snapshot</h3>
            <p className="muted" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <span className="agency-snapshot-stat-symbol" aria-hidden>
                  <ResourceSymbol id="eur" size={17} />
                </span>
                <strong>Cash</strong>: EUR {save.resources.eur.toLocaleString("en-GB")}
              </span>
              {" · "}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
                onClick={() => setBreakdownMetric("eur")}
              >
                Breakdown
              </button>
            </p>
            <AgencyFinanceStatsRows
              save={save}
              onPayables={() => setBreakdownMetric("payables")}
              onReceivables={() => setBreakdownMetric("receivables")}
            />
            <AgencySnapshotMetricRow
              symbolId="reputation"
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
              onBreakdown={() => setBreakdownMetric("reputation")}
            />
            <AgencySnapshotMetricRow
              symbolId="visibility"
              label="Visibility"
              value={visibilityForBands}
              bandLabel={getMetricBand("visibility", visibilityForBands).label}
              color={getMetricBand("visibility", visibilityForBands).color}
              percent={metricPercent("visibility", visibilityForBands)}
              onBreakdown={() => setBreakdownMetric("visibility")}
            />
            <AgencySnapshotMetricRow
              symbolId="competence"
              label="Competence"
              value={competenceForBands}
              bandLabel={getMetricBand("competence", competenceForBands).label}
              color={getMetricBand("competence", competenceForBands).color}
              percent={metricPercent("competence", competenceForBands)}
              onBreakdown={() => setBreakdownMetric("competence")}
            />
            <AgencySnapshotCapacityRow
              firmCapacity={save.resources.firmCapacity}
              onBreakdown={() => setBreakdownMetric("firmCapacity")}
            />
          </div>
        ) : null}

        {showEmployees ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Employees</h3>
            <EmployeeRosterList employees={save.employees ?? []} />
          </div>
        ) : null}

        {showCaseLog && season === 1 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>
              Active Cases
            </h3>
            <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
              Reviewed Season 1 campaigns now live here with your follow-up action and final metrics.
            </p>
            {season1ActiveCases.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No cases logged.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.65rem" }}>
                {season1ActiveCases.map(({ client, run, arc1Text }) => {
                  const expanded = expandedActiveCases[client.id] ?? false;
                  const toggle = () => setExpandedActiveCases((m) => ({ ...m, [client.id]: !expanded }));
                  return (
                    <div
                      key={client.id}
                      style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem 0.85rem", textAlign: "left" }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={toggle}
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                          padding: "0.6rem 0.75rem",
                          fontSize: "0.96rem",
                        }}
                      >
                        <span>{client.scenarioTitle}</span>
                        <span>{expanded ? "Hide" : "Open"}</span>
                      </button>
                      {expanded ? (
                        <div style={{ marginTop: "0.85rem" }}>
                          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.92rem" }}>
                            {client.problem}
                          </p>
                          <p style={{ margin: "0 0 0.4rem", fontSize: "0.92rem" }}>
                            <strong>Your in-season decision:</strong> {run.solutionTitle ?? run.solutionId}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>In-season cost:</strong> EUR {(run.costBudget ?? 0).toLocaleString("en-GB")} · Capacity {run.costCapacity ?? 0}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
                            <strong>First update:</strong> {arc1Text}
                          </p>
                          <p style={{ margin: "0 0 0.35rem", fontSize: "0.92rem" }}>
                            <strong>Your action:</strong> {postSeasonChoiceLabel(run.postSeason?.choice ?? "none")}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>Post-season action cost:</strong> {postSeasonSeason1ChoiceCostLabel(run.postSeason?.choice ?? "none")}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>Fees this season:</strong> EUR {client.budgetSeason1.toLocaleString("en-GB")}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.55rem", fontSize: "0.88rem" }}>
                            <strong>Fees next season:</strong> EUR {client.budgetSeason2.toLocaleString("en-GB")}
                          </p>
                          <p className="scenario-campaign-results-kicker">Current Solution Metrics</p>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(run.postSeason?.reachPercent ?? run.outcome.messageSpread) }}>
                              Reach — {run.postSeason?.reachPercent ?? run.outcome.messageSpread}%
                            </span>
                            <ScenarioMetricBar pct={run.postSeason?.reachPercent ?? run.outcome.messageSpread} />
                          </div>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(run.postSeason?.effectivenessPercent ?? run.outcome.messageEffectiveness) }}>
                              Effectiveness — {run.postSeason?.effectivenessPercent ?? run.outcome.messageEffectiveness}%
                            </span>
                            <ScenarioMetricBar pct={run.postSeason?.effectivenessPercent ?? run.outcome.messageEffectiveness} />
                          </div>
                          <p
                            style={{
                              margin: "0.45rem 0 0",
                              fontSize: "0.92rem",
                              fontWeight: 600,
                              color:
                                (run.postSeason?.reputationDelta ?? 0) < 0
                                  ? "#dc2626"
                                  : (run.postSeason?.reputationDelta ?? 0) === 0
                                    ? "#fbbf24"
                                    : "#22c55e",
                            }}
                          >
                            {(run.postSeason?.reputationDelta ?? 0) < 0
                              ? `Reputation Loss: ${run.postSeason?.reputationDelta ?? 0}`
                              : `Reputation Gain: ${(run.postSeason?.reputationDelta ?? 0) > 0 ? "+" : ""}${run.postSeason?.reputationDelta ?? 0}`}
                          </p>
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
                            Visibility Gain: {(run.postSeason?.visibilityGain ?? 0) >= 0 ? "+" : ""}
                            {run.postSeason?.visibilityGain ?? 0}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {showCaseLog && season >= 2 && showActiveCasesToggle ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>
              Active Cases — Season {season}
            </h3>
            <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
              Reviewed Season {season} scenarios now live here with your chosen post-season action and final metrics.
            </p>
            {activeCases.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No active cases to show.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.65rem" }}>
                {activeCases.map(({ client, run, arc1Text }) => {
                  const expanded = expandedActiveCases[client.id] ?? false;
                  const toggle = () => setExpandedActiveCases((m) => ({ ...m, [client.id]: !expanded }));
                  return (
                    <div
                      key={client.id}
                      style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem 0.85rem", textAlign: "left" }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={toggle}
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                          padding: "0.6rem 0.75rem",
                          fontSize: "0.96rem",
                        }}
                      >
                        <span>{client.scenarioTitle}</span>
                        <span>{expanded ? "Hide" : "Open"}</span>
                      </button>
                      {expanded ? (
                        <div style={{ marginTop: "0.85rem" }}>
                          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.92rem" }}>
                            {client.problem}
                          </p>
                          <p style={{ margin: "0 0 0.4rem", fontSize: "0.92rem" }}>
                            <strong>Your in-season decision:</strong> {run.solutionTitle ?? run.solutionId}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
                            <strong>First update:</strong> {arc1Text}
                          </p>
                          <p style={{ margin: "0 0 0.35rem", fontSize: "0.92rem" }}>
                            <strong>Your action:</strong> {postSeasonChoiceLabel(run.postSeason?.choice ?? "none")}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>In-season cost:</strong> EUR {(run.costBudget ?? 0).toLocaleString("en-GB")} · Capacity {run.costCapacity ?? 0}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>Post-season action cost:</strong>{" "}
                            {postSeasonChoiceCostLabel(run.postSeason?.choice ?? "none", client)}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
                            <strong>Fees this season:</strong> EUR {client.budgetSeason1.toLocaleString("en-GB")}
                          </p>
                          <p className="muted" style={{ margin: "0 0 0.55rem", fontSize: "0.88rem" }}>
                            <strong>Fees next season:</strong> EUR {client.budgetSeason2.toLocaleString("en-GB")}
                          </p>
                          <p className="scenario-campaign-results-kicker">Current Solution Metrics</p>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(run.postSeason?.reachPercent ?? run.outcome?.messageSpread ?? 0) }}>
                              Reach — {run.postSeason?.reachPercent ?? run.outcome?.messageSpread ?? 0}%
                            </span>
                            <ScenarioMetricBar pct={run.postSeason?.reachPercent ?? run.outcome?.messageSpread ?? 0} />
                          </div>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(run.postSeason?.effectivenessPercent ?? run.outcome?.messageEffectiveness ?? 0) }}>
                              Effectiveness — {run.postSeason?.effectivenessPercent ?? run.outcome?.messageEffectiveness ?? 0}%
                            </span>
                            <ScenarioMetricBar pct={run.postSeason?.effectivenessPercent ?? run.outcome?.messageEffectiveness ?? 0} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {season === 1 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <>
              <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Campaign results</h3>
              <p className="muted" style={{ margin: 0 }}>
                {resultsTotal === 0
                  ? "No completed campaigns to review (every client was rejected or has no outcome)."
                  : resultsDone
                    ? "You have finished reviewing every campaign for this season."
                    : ""}
              </p>
              {resultsTotal > 0 ? (
                <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                  Progress: {resultsProgress}
                </p>
              ) : null}
              <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.65rem" }}>
                {showSeason1ActiveCasesToggle ? (
                  <button
                    type="button"
                    className={`btn ${season1ActiveCasesViewed ? "btn-secondary" : "btn-next-hint"}`}
                    onClick={openSeason1ActiveCases}
                  >
                    Active Cases
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>Active Cases</button>
                )}
                {summaryReady ? (
                  <Link
                    href={`/game/postseason/${season}/summary`}
                    className={season1ActiveCasesViewed ? "btn btn-next-hint" : "btn btn-secondary"}
                    style={{ textDecoration: "none" }}
                  >
                    Season summary
                  </Link>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>Season summary</button>
                )}
                {!resultsDone && resultsTotal > 0 ? (
                  <Link href={`/game/postseason/${season}/results`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                    View results
                  </Link>
                ) : null}
              </div>
            </>
          </div>
        ) : null}

        {season === 1 && resultsDone && scenarioOverviewRows.length > 0 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "1.05rem" }}>Campaign overview</h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.92rem" }}>Here's how your campaigns performed this season.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCampaignOverview((v) => !v)}>
              {showCampaignOverview ? "Hide campaign overview" : "Campaign overview"}
            </button>
            {showCampaignOverview ? (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.85rem" }}>
                {scenarioOverviewRows.map(({ client, run }) => {
                  const expanded = expandedScenario[client.id] ?? false;
                  const toggle = () => setExpandedScenario((m) => ({ ...m, [client.id]: !expanded }));
                  const outcome = run.outcome;
                  const repDelta = run.postSeason?.reputationDelta ?? 0;
                  const visGain = run.postSeason?.visibilityGain ?? 0;
                  return (
                    <div
                      key={client.id}
                      style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.85rem 1rem", textAlign: "left" }}
                    >
                      <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>{client.scenarioTitle}</p>
                      <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>{client.displayName}</p>
                      {!expanded ? (
                        <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
                          {client.problem.length > 160 ? `${client.problem.slice(0, 160)}…` : client.problem}
                        </p>
                      ) : (
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", lineHeight: 1.5 }}>{client.problem}</p>
                      )}
                      <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem" }} onClick={toggle}>
                        {expanded ? "Show less" : "Show more"}
                      </button>

                      <p style={{ margin: "0.65rem 0 0.25rem", fontSize: "0.92rem" }}>
                        <strong>Decision:</strong> {run.solutionTitle ?? run.solutionId}
                      </p>

                      <p className="scenario-campaign-results-kicker">Campaign Results</p>

                      {outcome ? (
                        <>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(outcome.messageSpread) }}>
                              Reach — {outcome.messageSpread}%
                            </span>
                            <ScenarioMetricBar pct={outcome.messageSpread} />
                          </div>
                          <div className="scenario-summary-metric-row">
                            <span style={{ color: metricPercentGradientColor(outcome.messageEffectiveness) }}>
                              Effectiveness — {outcome.messageEffectiveness}%
                            </span>
                            <ScenarioMetricBar pct={outcome.messageEffectiveness} />
                          </div>
                        </>
                      ) : (
                        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
                          No campaign outcome recorded for this run.
                        </p>
                      )}

                      {run.postSeason ? (
                        <>
                          <p
                            style={{
                              margin: "0.45rem 0 0",
                              fontSize: "0.92rem",
                              fontWeight: 600,
                              color: repDelta < 0 ? "#dc2626" : repDelta === 0 ? "#fbbf24" : "#22c55e",
                            }}
                          >
                            {repDelta < 0 ? `Reputation Loss: ${repDelta}` : `Reputation Gain: ${repDelta > 0 ? "+" : ""}${repDelta}`}
                          </p>
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
                            Visibility Gain: {visGain >= 0 ? "+" : ""}{visGain}
                          </p>
                        </>
                      ) : (
                        <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.85rem" }}>
                          Post-season review not completed for this campaign.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}

      </section>

      {breakdownMetric ? (
        <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Metric breakdown">
          <div className="game-modal">
            <MetricBreakdownModalBody metric={breakdownMetric} save={save} />
            <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" onClick={() => setBreakdownMetric(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function postSeasonChoiceLabel(choice: "reach" | "effectiveness" | "none"): string {
  switch (choice) {
    case "reach":
      return "Increased Reach";
    case "effectiveness":
      return "Increased Effectiveness";
    default:
      return "Did Nothing";
  }
}

function postSeasonChoiceCostLabel(
  choice: "reach" | "effectiveness" | "none",
  client: { budgetSeason1: number; budgetSeason2: number; budgetTier?: ClientBudgetTier; scenarioTitle: string } & Parameters<typeof getSeason2ReachBoostCostEur>[0]
): string {
  if (choice === "reach") {
    return `EUR ${getSeason2ReachBoostCostEur(client).toLocaleString("en-GB")}`;
  }
  if (choice === "effectiveness") {
    return `${getSeason2EffectivenessBoostCostCapacity(client)} capacity`;
  }
  return "No extra cost";
}

function postSeasonSeason1ChoiceCostLabel(choice: "reach" | "effectiveness" | "none"): string {
  if (choice === "reach") {
    return `EUR ${POST_SEASON_REACH_BOOST_COST_EUR.toLocaleString("en-GB")}`;
  }
  if (choice === "effectiveness") {
    return `${POST_SEASON_EFFECTIVENESS_BOOST_COST_CAPACITY} capacity`;
  }
  return "No extra cost";
}

