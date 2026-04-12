"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import {
  acceptedRunsWithOutcomes,
  postSeasonCompletedCount,
  postSeasonNextRunIndex,
} from "@/lib/postSeasonResults";
import { buildSeasonCaseLog, buildSeason1CaseLog, type BreakdownMetric } from "@/lib/metricBreakdown";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceStatsRows } from "@/components/AgencyFinanceStatsRows";
import { EmployeeRosterList } from "@/components/EmployeeRosterList";
import { MetricBreakdownModalBody } from "@/components/MetricBreakdownModalBody";
import { ResourceSymbol } from "@/components/resourceSymbols";
import {
  getPendingReceivablesEur,
  hasLayoffPressure,
  liquidityEur,
  totalPayables,
} from "@/lib/payablesReceivables";
import {
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
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [notice, setNotice] = useState("");

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];

  const [expandedScenario, setExpandedScenario] = useState<Record<string, boolean>>({});
  const acceptedForResults = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const resultsTotal = acceptedForResults.length;
  const resultsDone =
    resultsTotal === 0 || postSeasonNextRunIndex(acceptedForResults) >= resultsTotal;
  const resultsProgress =
    resultsTotal > 0 ? `${postSeasonCompletedCount(acceptedForResults)} / ${resultsTotal} reviewed` : "—";
  /** Summary is available and is the forward path (reviews done, or nothing to review). */
  const summaryReady = resultsDone;

  const caseLog = useMemo(() => (save && season === 1 ? buildSeason1CaseLog(save) : []), [save, season]);
  const activeCases = useMemo(
    () => (save && season >= 2 ? buildSeasonCaseLog(save, seasonKey) : []),
    [save, season, seasonKey]
  );

  // Season 2+ resolution tracking
  const s2Entries = useMemo(() => (save && season >= 2 ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);
  const s2ResolutionsDone = useMemo(() => (save && season >= 2 ? isPostSeasonResolutionComplete(save, season) : true), [save, season]);

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

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Post-season {season}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Review outcomes and optional boosts. Visibility and competence are unchanged from the end of the season; capacity reflects campaigns you ran.
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

      <section>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowStats((v) => !v)}>
            {showStats ? "Hide agency stats" : "Agency stats"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowEmployees((v) => !v)}>
            {showEmployees ? "Hide employees" : "Employees"}
          </button>
          {season === 1 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setShowCaseLog((v) => !v)}>
              {showCaseLog ? "Hide case log" : "Case log — Season 1"}
            </button>
          ) : season >= 2 ? (
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

        {showStats ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Agency snapshot</h3>
            <p className="muted" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <ResourceSymbol id="eur" size={17} />
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
            <MetricRow
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
              onBreakdown={() => setBreakdownMetric("reputation")}
            />
            <MetricRow
              label="Visibility"
              value={save.resources.visibility}
              bandLabel={getMetricBand("visibility", save.resources.visibility).label}
              color={getMetricBand("visibility", save.resources.visibility).color}
              percent={metricPercent("visibility", save.resources.visibility)}
              onBreakdown={() => setBreakdownMetric("visibility")}
            />
            <MetricRow
              label="Competence"
              value={save.resources.competence}
              bandLabel={getMetricBand("competence", save.resources.competence).label}
              color={getMetricBand("competence", save.resources.competence).color}
              percent={metricPercent("competence", save.resources.competence)}
              onBreakdown={() => setBreakdownMetric("competence")}
            />
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              Capacity: {save.resources.firmCapacity}
              {" · "}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
                onClick={() => setBreakdownMetric("firmCapacity")}
              >
                Breakdown
              </button>
            </p>
          </div>
        ) : null}

        {showEmployees ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Employees</h3>
            <EmployeeRosterList employees={save.employees ?? []} />
          </div>
        ) : null}

        {showCaseLog && (season === 1 || season >= 2) ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>
              {season === 1 ? "Case log — Season 1" : `Active Cases — Season ${season}`}
            </h3>
            {season >= 2 ? (
              <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
                Fresh cases from Season {season} only. Prior-season rollover scenarios are not shown here.
              </p>
            ) : null}
            {(season === 1 ? caseLog : activeCases).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No cases logged.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.65rem" }}>
                {(season === 1 ? caseLog : activeCases).map((entry) => (
                  <div
                    key={entry.clientId}
                    style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem 0.85rem", textAlign: "left" }}
                  >
                    <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>{entry.scenarioTitle}</p>
                    <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.92rem" }}>
                      {entry.problemSummary}
                    </p>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
                      <strong>Decision:</strong> {entry.decisionLabel}
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                      Resource cost: EUR {entry.costBudget.toLocaleString("en-GB")} · Capacity {entry.costCapacity}
                      <br />
                      Net cash from this client: EUR {entry.moneyEarned.toLocaleString("en-GB")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
          {season === 1 ? (
            <>
              <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Campaign results</h3>
              <p className="muted" style={{ margin: 0 }}>
                {resultsTotal === 0
                  ? "No completed campaigns to review (every client was rejected or has no outcome)."
                  : resultsDone
                    ? "You have finished reviewing every campaign for this season."
                    : "You must review each campaign in order — same order as during the season (rejected clients are skipped)."}
              </p>
              {resultsTotal > 0 ? (
                <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                  Progress: {resultsProgress}
                </p>
              ) : null}
              <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.65rem" }}>
                {summaryReady ? (
                  <Link href={`/game/postseason/${season}/summary`} className="btn btn-next-hint" style={{ textDecoration: "none" }}>
                    Season summary
                  </Link>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>Season summary</button>
                )}
                {resultsTotal === 0 ? (
                  <button type="button" className="btn btn-primary" disabled style={{ opacity: 0.55 }}>View results</button>
                ) : (
                  <Link href={`/game/postseason/${season}/results`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                    View results
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Completed scenarios</h3>
              <p className="muted" style={{ margin: 0 }}>
                {s2Entries.length === 0
                  ? "No rollover scenarios to resolve for this season."
                  : s2ResolutionsDone
                    ? "All scenario resolutions reviewed."
                    : `Review each resolved scenario in order. ${s2Entries.length} total.`}
              </p>
              <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.65rem" }}>
                {resultsDone ? (
                  <Link href={`/game/postseason/${season}/summary`} className="btn btn-next-hint" style={{ textDecoration: "none" }}>
                    Season summary
                  </Link>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>Season summary</button>
                )}
                {s2ResolutionsDone ? (
                  <Link href={`/game/postseason/${season}/history`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
                    Scenario history
                  </Link>
                ) : null}
                {resultsTotal === 0 ? (
                  <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>Season 2 scenarios</button>
                ) : (
                  <Link href={`/game/postseason/${season}/results`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
                    Season 2 scenarios
                  </Link>
                )}
                {s2Entries.length === 0 ? (
                  <button type="button" className="btn btn-primary" disabled style={{ opacity: 0.55 }}>Completed scenarios</button>
                ) : (
                  <Link href={`/game/postseason/${season}/resolutions`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                    Completed scenarios
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        {season === 1 && resultsDone && scenarioOverviewRows.length > 0 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "1.05rem" }}>Campaign overview</h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.92rem" }}>Here's how your campaigns performed this season.</p>
            <div style={{ display: "grid", gap: "0.75rem" }}>
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

function MetricRow({
  label,
  value,
  bandLabel,
  color,
  percent,
  onBreakdown,
}: {
  label: string;
  value: number;
  bandLabel: string;
  color: string;
  percent: number;
  onBreakdown: () => void;
}) {
  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <strong>{label}</strong>
        <span className="muted" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {value} · {bandLabel}
          <button type="button" className="btn btn-secondary" style={{ padding: "0.15rem 0.45rem", fontSize: "0.78rem" }} onClick={onBreakdown}>
            Breakdown
          </button>
        </span>
      </div>
      <div className="metric-track" role="presentation">
        <div className="metric-fill" style={{ width: `${percent}%`, background: color }} />
        <div className="metric-marker" style={{ left: `${percent}%` }} aria-hidden />
      </div>
    </div>
  );
}
