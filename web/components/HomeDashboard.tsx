"use client";

import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { loadSave } from "@/lib/saveGameStorage";
import { buildSeason1CaseLog, type BreakdownMetric } from "@/lib/metricBreakdown";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceStatsRows } from "@/components/AgencyFinanceStatsRows";
import { AgencySnapshotCapacityRow, AgencySnapshotMetricRow } from "@/components/AgencySnapshotMetricRow";
import { MetricBreakdownModalBody } from "@/components/MetricBreakdownModalBody";
import { ResourceSymbol } from "@/components/resourceSymbols";
import { EmployeeRosterList } from "@/components/EmployeeRosterList";

/** Home: phase, agency snapshot with breakdowns, and case log. */
export function HomeDashboard() {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showCaseLog, setShowCaseLog] = useState(false);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);

  const refresh = () => setSave(loadSave());

  const phaseLine = useMemo(() => {
    if (!save) return "";
    const phaseLabel =
      save.phase === "preseason" ? "Pre-season" : save.phase === "season" ? "In season" : "Post-season";
    return `Season ${save.seasonNumber} · ${phaseLabel}`;
  }, [save]);

  const caseLog = useMemo(() => (save ? buildSeason1CaseLog(save) : []), [save]);
  const showSeason1CaseLog = save ? save.seasonNumber < 2 : false;

  if (!save) {
    return null;
  }

  const visibilityForBands = getEffectiveVisibilityForAgency(save);
  const competenceForBands = getEffectiveCompetenceForAgency(save);

  return (
    <div className="agency-stats-panel" style={{ marginBottom: "1.5rem", maxWidth: "40rem", marginLeft: "auto", marginRight: "auto" }}>
      <AgencyResourceStrip save={save} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Where you left off
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>{phaseLine}</p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={refresh}>
          Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
        <button type="button" className="btn btn-secondary" onClick={() => setShowStats((v) => !v)}>
          {showStats ? "Hide agency stats" : "Agency stats"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setShowEmployees((v) => !v)}>
          {showEmployees ? "Hide employees" : "Employees"}
        </button>
        {showSeason1CaseLog ? (
          <button type="button" className="btn btn-secondary" onClick={() => setShowCaseLog((v) => !v)}>
            {showCaseLog ? "Hide case log" : "Case log — Season 1"}
          </button>
        ) : null}
      </div>

      {showStats ? (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Agency snapshot</h3>
          <p className="muted" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span className="agency-snapshot-stat-symbol" aria-hidden>
                <ResourceSymbol id="eur" size={17} />
              </span>
              <strong>Cash</strong>: EUR {save.resources.eur.toLocaleString("en-GB")}
            </span>
            {" · "}
            <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }} onClick={() => setBreakdownMetric("eur")}>
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
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Employees</h3>
          <EmployeeRosterList employees={save.employees ?? []} />
        </div>
      ) : null}

      {showSeason1CaseLog && showCaseLog ? (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>Case log — Season 1</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
            Completed client cases from this season.
          </p>
          {caseLog.length === 0 ? (
            <p className="muted" style={{ margin: "0.5rem 0 0" }}>
              No Season 1 cases completed yet.
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

