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
import {
  buildMetricBreakdown,
  buildSeason1CaseLog,
  formatSigned,
  type BreakdownMetric,
} from "@/lib/metricBreakdown";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { formatEmployeeCapacitySuffix } from "@/lib/tenureCapacity";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";

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

  const acceptedForResults = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const resultsTotal = acceptedForResults.length;
  const resultsDone =
    resultsTotal > 0 && postSeasonNextRunIndex(acceptedForResults) >= resultsTotal;
  const resultsProgress =
    resultsTotal > 0 ? `${postSeasonCompletedCount(acceptedForResults)} / ${resultsTotal} reviewed` : "—";

  const caseLog = useMemo(() => (save && season === 1 ? buildSeason1CaseLog(save) : []), [save, season]);

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
            <p className="muted" style={{ marginTop: 0 }}>
              Cash: EUR {save.resources.eur.toLocaleString("en-GB")}
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
            {(save.employees ?? []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No employees hired yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {[...(save.employees ?? [])]
                  .sort((a, b) => b.salary - a.salary)
                  .map((e) => (
                    <div key={e.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.7rem 0.8rem" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {e.name} · {e.role}
                      </p>
                      <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                        Salary: EUR {e.salary.toLocaleString("en-GB")}
                        {e.visibilityGain > 0 ? ` · Visibility +${e.visibilityGain}` : ""}
                        {e.competenceGain > 0 ? ` · Competence +${e.competenceGain}` : ""}
                        {formatEmployeeCapacitySuffix(e)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : null}

        {showCaseLog && season === 1 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>Case log — Season 1</h3>
            {caseLog.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No cases logged.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.65rem" }}>
                {caseLog.map((entry) => (
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
            {resultsDone || resultsTotal === 0 ? (
              <Link href={`/game/postseason/${season}/summary`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
                Season summary
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.55 }}>
                Season summary
              </button>
            )}
            {resultsTotal === 0 ? (
              <button type="button" className="btn btn-primary" disabled style={{ opacity: 0.55 }}>
                View results
              </button>
            ) : (
              <Link href={`/game/postseason/${season}/results`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                View results
              </Link>
            )}
          </div>
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}

      </section>

      {breakdownMetric ? (
        <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Metric breakdown">
          <div className="game-modal">
            <p className="game-modal-kicker">Agency ledger</p>
            <h2 style={{ marginTop: 0 }}>
              {breakdownMetric === "eur"
                ? "Wealth breakdown"
                : breakdownMetric === "visibility"
                  ? "Visibility breakdown"
                  : breakdownMetric === "competence"
                    ? "Competence breakdown"
                    : breakdownMetric === "firmCapacity"
                      ? "Capacity breakdown"
                      : "Reputation breakdown"}
            </h2>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {buildMetricBreakdown(breakdownMetric, save).map((line) => (
                <p key={line.label} style={{ margin: 0 }}>
                  {line.label}: {formatSigned(breakdownMetric, line.value)}
                </p>
              ))}
            </div>
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
