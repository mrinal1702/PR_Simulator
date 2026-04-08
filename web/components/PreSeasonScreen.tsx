"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { persistSave, loadSave } from "@/lib/saveGameStorage";

type Focus = "strategy_workshop" | "network";

export function PreSeasonScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);

  const title = useMemo(() => `Pre-season ${season}`, [season]);
  const seasonKey = String(season);
  const existingSeasonAction = save?.preseasonActionBySeason?.[seasonKey];
  const legacyUsedFlag =
    Boolean(save?.activityFocusUsedInPreseason) &&
    (save?.preseasonActionBySeason == null ||
      Object.keys(save.preseasonActionBySeason).length === 0) &&
    save?.phase === "preseason" &&
    save?.seasonNumber === season;
  const alreadyUsedThisPreseason = Boolean(existingSeasonAction) || legacyUsedFlag;

  const applyFocus = (focus: Focus) => {
    if (!save || alreadyUsedThisPreseason) return;
    const normalizedCounts = {
      strategy_workshop: save.preseasonFocusCounts?.strategy_workshop ?? 0,
      network: save.preseasonFocusCounts?.network ?? 0,
    };
    const normalizedActions = save.preseasonActionBySeason ?? {};
    const updated: NewGamePayload = {
      ...save,
      phase: "preseason",
      seasonNumber: season,
      activityFocusUsedInPreseason: true,
      preseasonActionBySeason: {
        ...normalizedActions,
        [seasonKey]: focus,
      },
      preseasonFocusCounts: {
        ...normalizedCounts,
        [focus]: normalizedCounts[focus] + 1,
      },
      resources:
        focus === "strategy_workshop"
          ? { ...save.resources, competence: save.resources.competence + 10 }
          : { ...save.resources, visibility: save.resources.visibility + 10 },
    };
    setSave(updated);
    persistSave(updated);
    setNotice(
      focus === "strategy_workshop"
        ? "Strategy workshop complete: +10 competence."
        : "Network complete: +10 visibility."
    );
  };

  const saveNow = () => {
    if (!save) return;
    const ok = persistSave(save);
    setNotice(ok ? "Progress saved." : "Could not save right now.");
  };

  if (!save) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>No active save found</h1>
        <p className="muted">Start a new game first to enter pre-season.</p>
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
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Choose one activity focus for this pre-season.
        </p>
      </header>

      <section>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowStats((v) => !v)}>
            {showStats ? "Hide agency stats" : "Agency stats"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowEmployees((v) => !v)}>
            {showEmployees ? "Hide employees" : "Employees"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={saveNow}>
            Save
          </button>
        </div>

        {showStats ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Agency snapshot</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Cash: EUR {save.resources.eur.toLocaleString("en-GB")}
            </p>

            <MetricRow
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
            />
            <MetricRow
              label="Visibility"
              value={save.resources.visibility}
              bandLabel={getMetricBand("visibility", save.resources.visibility).label}
              color={getMetricBand("visibility", save.resources.visibility).color}
              percent={metricPercent("visibility", save.resources.visibility)}
            />
            <MetricRow
              label="Competence"
              value={save.resources.competence}
              bandLabel={getMetricBand("competence", save.resources.competence).label}
              color={getMetricBand("competence", save.resources.competence).color}
              percent={metricPercent("competence", save.resources.competence)}
            />
          </div>
        ) : null}

        {showEmployees ? (
          <div className="agency-stats-panel">
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
                        {e.capacityGain > 0 ? ` · Capacity +${e.capacityGain}` : ""}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="card-grid cols-2" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="choice-card"
            onClick={() => applyFocus("strategy_workshop")}
            disabled={alreadyUsedThisPreseason}
          >
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Strategy workshop</h3>
            <p className="muted" style={{ margin: 0 }}>Improve competence by 10</p>
          </button>
          <button
            type="button"
            className="choice-card"
            onClick={() => applyFocus("network")}
            disabled={alreadyUsedThisPreseason}
          >
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Network</h3>
            <p className="muted" style={{ margin: 0 }}>Improve visibility by 10</p>
          </button>
        </div>
        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
          <Link
            href={`/game/preseason/${season}/hiring`}
            className="btn btn-primary"
            style={{ textDecoration: "none" }}
          >
            Talent Bazaar (Hire employees)
          </Link>
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}
        {!notice && alreadyUsedThisPreseason ? (
          <p style={{ marginTop: "1rem" }} className="muted">
            Focus already used this pre-season:{" "}
            {existingSeasonAction === "strategy_workshop" ? "Strategy workshop" : "Network"}.
          </p>
        ) : null}

        <div style={{ marginTop: "1.25rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            Current resources: EUR {save.resources.eur.toLocaleString("en-GB")} · Competence{" "}
            {save.resources.competence} · Visibility {save.resources.visibility} · Capacity{" "}
            {save.resources.firmCapacity} · Reputation {save.reputation ?? 5}
          </p>
        </div>
      </section>
    </div>
  );
}

function MetricRow({
  label,
  value,
  bandLabel,
  color,
  percent,
}: {
  label: string;
  value: number;
  bandLabel: string;
  color: string;
  percent: number;
}) {
  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <strong>{label}</strong>
        <span className="muted">
          {value} · {bandLabel}
        </span>
      </div>
      <div className="metric-track" role="presentation">
        <div className="metric-fill" style={{ width: `${percent}%`, background: color }} />
        <div className="metric-marker" style={{ left: `${percent}%` }} aria-hidden />
      </div>
    </div>
  );
}

