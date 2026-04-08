"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { persistSave, loadSave } from "@/lib/saveGameStorage";
import {
  generateCandidates,
  getHireCapForSeason,
  getSalaryBands,
  normalizeSalary,
  roleLabel,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "@/lib/hiring";

type Focus = "strategy_workshop" | "network";

export function PreSeasonScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [screen, setScreen] = useState<"agency" | "hiring">("agency");

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
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScreen((v) => (v === "agency" ? "hiring" : "agency"))}
          >
            {screen === "agency" ? "Talent Bazaar (Hiring)" : "Return to agency screen"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowStats((v) => !v)}>
            {showStats ? "Hide agency stats" : "Agency stats"}
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

        {screen === "agency" ? (
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
        ) : (
          <HiringPanel save={save} season={season} onSave={setSave} onNotice={setNotice} onBack={() => setScreen("agency")} />
        )}

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

function HiringPanel({
  save,
  season,
  onSave,
  onNotice,
  onBack,
}: {
  save: NewGamePayload;
  season: number;
  onSave: (next: NewGamePayload) => void;
  onNotice: (msg: string) => void;
  onBack: () => void;
}) {
  const [role, setRole] = useState<HiringRole | null>(null);
  const [tier, setTier] = useState<HiringTier>("junior");
  const [budgetInput, setBudgetInput] = useState<string>("15000");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const seasonKey = String(season);
  const hiredThisSeason = save.hiresBySeason?.[seasonKey] ?? 0;
  const cap = getHireCapForSeason(season);
  const capReached = hiredThisSeason >= cap;

  const resolveCandidates = () => {
    if (!role) return;
    const rawBudget = Number.parseInt(budgetInput, 10);
    const normalized = normalizeSalary(tier, Number.isFinite(rawBudget) ? rawBudget : 0);
    setBudgetInput(String(normalized));
    const next = generateCandidates({
      seedBase: `${save.createdAt}|${save.playerName}`,
      season,
      role,
      tier,
      salary: normalized,
      reputation: save.reputation ?? 5,
      visibility: save.resources.visibility,
    });
    setCandidates(next);
  };

  const hireCandidate = (candidate: Candidate) => {
    if (capReached) return;
    const productivity = Math.round(candidate.hiddenProductivityPct);
    const skill = Math.round(candidate.hiddenSkillScore);
    const capGain = Math.round((25 * productivity) / 100);
    let competenceGain = 0;
    let visibilityGain = 0;
    if (candidate.tier === "intern") {
      competenceGain = 3;
      visibilityGain = 3;
    } else if (candidate.role === "data_analyst") {
      competenceGain = skill;
    } else if (candidate.role === "sales_representative") {
      visibilityGain = skill;
    } else {
      competenceGain = Math.round(skill / 2);
      visibilityGain = skill - competenceGain;
    }
    const updated: NewGamePayload = {
      ...save,
      resources: {
        ...save.resources,
        competence: save.resources.competence + competenceGain,
        visibility: save.resources.visibility + visibilityGain,
        firmCapacity: save.resources.firmCapacity + capGain,
      },
      hiresBySeason: {
        ...(save.hiresBySeason ?? {}),
        [seasonKey]: hiredThisSeason + 1,
      },
    };
    onSave(updated);
    persistSave(updated);
    onNotice(`Hired ${candidate.name} (${roleLabel(candidate.role)}). Autosaved.`);
    const prodLine =
      productivity <= 25
        ? "Mostly decorative this cycle, but technically on payroll."
        : productivity <= 50
        ? "Some sparks of effort, but still warming up to agency speed."
        : productivity <= 75
        ? "Solid contributor: dependable output with room to sharpen."
        : "Absolute engine this cycle, quietly carrying real workload.";
    const skillPct = candidate.tier === "intern" ? 60 : Math.round((skill / (candidate.tier === "junior" ? 20 : candidate.tier === "mid" ? 40 : 80)) * 100);
    const skillLine =
      skillPct <= 25
        ? "You found the budget mystery box version of this salary band."
        : skillPct <= 50
        ? "Serviceable hire: not a steal, not a disaster, just workable."
        : skillPct <= 75
        ? "Strong value pickup for this band, strategy team approves."
        : "Elite value hit: this salary band just overdelivered hard.";
    window.alert(
      `${prodLine}\n${skillLine}\n\nProductivity: ${productivity}%\nSkill: +${skill}\nCapacity gain: +${capGain}\nCompetence gain: +${competenceGain}\nVisibility gain: +${visibilityGain}`
    );
    setRole(null);
    setTier("junior");
    setBudgetInput("15000");
    setCandidates([]);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <p className="muted" style={{ margin: 0 }}>
          Max hires this pre-season: {cap} · Hired: {hiredThisSeason}
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Return to agency screen
          </button>
        </div>
      </div>

      <div className="card-grid cols-3" style={{ marginTop: "0.75rem" }}>
        {(["data_analyst", "campaign_manager", "sales_representative"] as HiringRole[]).map((r) => (
          <button key={r} type="button" className={`choice-card${role === r ? " selected" : ""}`} onClick={() => setRole(r)}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>{roleLabel(r)}</h3>
            <p className="muted" style={{ margin: 0 }}>Choose role first</p>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.9rem", alignItems: "end" }}>
        <label className="field" style={{ minWidth: "180px", margin: 0 }}>
          <span>Seniority</span>
          <select value={tier} onChange={(e) => setTier(e.target.value as HiringTier)}>
            <option value="intern">Intern</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </label>
        <label className="field" style={{ minWidth: "180px", margin: 0 }}>
          <span>Budget (salary)</span>
          <input
            type="number"
            step={5000}
            value={tier === "intern" ? 10000 : budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            disabled={tier === "intern"}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={resolveCandidates} disabled={!role || capReached}>
          Find employees
        </button>
      </div>
      <p className="muted" style={{ marginTop: "0.45rem" }}>
        Salary bands: {getSalaryBands(tier).map((b) => b.label).join(" · ")}
      </p>

      {capReached ? (
        <p style={{ marginTop: "0.75rem" }}>Hire cap reached for this pre-season.</p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="card-grid cols-3" style={{ marginTop: "1rem" }}>
          {candidates.map((c) => (
            <div key={c.id} className="choice-card" style={{ textAlign: "left" }}>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>{c.name}</h3>
              <p className="muted" style={{ margin: "0 0 0.4rem" }}>
                {roleLabel(c.role)} · {c.tier} · EUR {c.salary.toLocaleString("en-GB")}
              </p>
              <p style={{ margin: 0 }}>{c.description}</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => hireCandidate(c)}>
                Hire
              </button>
            </div>
          ))}
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

