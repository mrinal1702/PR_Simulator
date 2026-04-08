"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  capacityGainFromProductivity,
  generateCandidates,
  getHireCapForSeason,
  getSalaryBands,
  roleLabel,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "@/lib/hiring";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { canAfford, spendEurOrNull } from "@/lib/budgetGuard";

type EmploymentMode = "intern" | "full_time";
type HireReport = {
  title: string;
  productivityLine: string;
  skillLine: string;
  productivity: number;
  skill: number;
  capGain: number;
  competenceGain: number;
  visibilityGain: number;
};

export function HiringScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<EmploymentMode>("intern");
  const [tier, setTier] = useState<Exclude<HiringTier, "intern">>("junior");
  const [role, setRole] = useState<HiringRole | null>(null);
  const [salary, setSalary] = useState<number>(15_000);
  const [stage, setStage] = useState<"home" | "results">("home");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hireReport, setHireReport] = useState<HireReport | null>(null);

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

  const seasonKey = String(season);
  const hiredThisSeason = save.hiresBySeason?.[seasonKey] ?? 0;
  const cap = getHireCapForSeason(season);
  const capReached = hiredThisSeason >= cap;
  const salaryOptions = useMemo(() => {
    if (mode === "intern") return [];
    return getSalaryBands(tier)
      .map((b) => b.anchor * 1000)
      .filter((value) => canAfford(save.resources.eur, value));
  }, [mode, tier, save.resources.eur]);
  const canAffordIntern = canAfford(save.resources.eur, 10_000);
  const canAffordSelected = mode === "intern" ? canAffordIntern : canAfford(save.resources.eur, salary);

  const findEmployees = () => {
    if (capReached) return;
    if (mode === "full_time" && !role) return;
    if (!canAffordSelected) {
      setNotice("Insufficient budget for this hire.");
      return;
    }
    const selectionTier: HiringTier = mode === "intern" ? "intern" : tier;
    const selectionRole: HiringRole = mode === "intern" ? "campaign_manager" : (role as HiringRole);
    const selectedSalary = mode === "intern" ? 10_000 : salary;
    const next = generateCandidates({
      seedBase: `${save.createdAt}|${save.playerName}`,
      season,
      role: selectionRole,
      tier: selectionTier,
      salary: selectedSalary,
      reputation: save.reputation ?? 5,
      visibility: save.resources.visibility,
    });
    setCandidates(next);
    setStage("results");
  };

  const hireCandidate = (candidate: Candidate) => {
    if (capReached) return;
    const nextEur = spendEurOrNull(save.resources.eur, candidate.salary);
    if (nextEur == null) {
      setNotice("Cannot hire: budget would go negative.");
      setStage("home");
      return;
    }
    const productivity = Math.round(candidate.hiddenProductivityPct);
    const skill = Math.round(candidate.hiddenSkillScore);
    const capGain = capacityGainFromProductivity(productivity);
    let competenceGain = 0;
    let visibilityGain = 0;
    if (mode === "intern") {
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
        eur: nextEur,
        competence: save.resources.competence + competenceGain,
        visibility: save.resources.visibility + visibilityGain,
        firmCapacity: save.resources.firmCapacity + capGain,
      },
      hiresBySeason: {
        ...(save.hiresBySeason ?? {}),
        [seasonKey]: hiredThisSeason + 1,
      },
    };
    setSave(updated);
    persistSave(updated);
    setNotice(`Hired ${candidate.name}. Autosaved.`);

    const prodLine =
      productivity <= 25
        ? "Mostly decorative this cycle, but technically on payroll."
        : productivity <= 50
        ? "Some sparks of effort, but still warming up to agency speed."
        : productivity <= 75
        ? "Solid contributor: dependable output with room to sharpen."
        : "Absolute engine this cycle, quietly carrying real workload.";
    const skillPct =
      mode === "intern"
        ? 60
        : Math.round((skill / (tier === "junior" ? 20 : tier === "mid" ? 40 : 80)) * 100);
    const skillLine =
      skillPct <= 25
        ? "You found the budget mystery box version of this salary band."
        : skillPct <= 50
        ? "Serviceable hire: not a steal, not a disaster, just workable."
        : skillPct <= 75
        ? "Strong value pickup for this band, strategy team approves."
        : "Elite value hit: this salary band just overdelivered hard.";

    setHireReport({
      title: `${candidate.name} joined the agency`,
      productivityLine: prodLine,
      skillLine,
      productivity,
      skill,
      capGain,
      competenceGain,
      visibilityGain,
    });

    setStage("home");
    setMode("intern");
    setTier("junior");
    setRole(null);
    setSalary(15_000);
    setCandidates([]);
  };

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.2rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Talent Bazaar</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Cash: EUR {save.resources.eur.toLocaleString("en-GB")} · Max hires this pre-season: {cap} · Hired: {hiredThisSeason}
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setStage("home")}
          disabled={stage === "home"}
        >
          Back
        </button>
        <Link href={`/game/preseason/${season}`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Return to agency screen
        </Link>
      </div>

      {notice ? <p>{notice}</p> : null}
      {capReached ? <p>Hire cap reached for this pre-season.</p> : null}

      {stage === "home" ? (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>1) Pick intern or full-time employee</h2>
          <div className="card-grid cols-2" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className={`choice-card${mode === "intern" ? " selected" : ""}`}
              onClick={() => {
                setMode("intern");
                setRole(null);
              }}
            >
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>Intern (10k fixed)</h3>
              <p className="muted" style={{ margin: 0 }}>
                Fixed +3 competence and +3 visibility. Interns leave after 1 season.
              </p>
              {!canAffordIntern ? (
                <p className="muted" style={{ marginTop: "0.45rem" }}>
                  Unavailable: not enough budget.
                </p>
              ) : null}
            </button>
            <button type="button" className={`choice-card${mode === "full_time" ? " selected" : ""}`} onClick={() => setMode("full_time")}>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>Full-time employee</h3>
              <p className="muted" style={{ margin: 0 }}>
                Choose seniority, role, and budget band.
              </p>
            </button>
          </div>

          <h2 style={{ marginTop: "1rem", fontSize: "1.15rem" }}>2) Configure hire</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end", marginTop: "0.5rem" }}>
            <label className="field" style={{ minWidth: "250px", margin: 0 }}>
              <span>Seniority</span>
              <select
                disabled={mode === "intern"}
                value={tier}
                onChange={(e) => {
                  const nextTier = e.target.value as Exclude<HiringTier, "intern">;
                  setTier(nextTier);
                  setSalary(getSalaryBands(nextTier)[0].anchor * 1000);
                }}
              >
                <option value="junior">Junior (15k-39k)</option>
                <option value="mid">Mid (40k-64k)</option>
                <option value="senior">Senior (65k-89k)</option>
              </select>
            </label>

            <label className="field" style={{ minWidth: "250px", margin: 0 }}>
              <span>Role</span>
              <select
                disabled={mode === "intern"}
                value={role ?? ""}
                onChange={(e) => setRole((e.target.value as HiringRole) || null)}
              >
                <option value="">Select a role</option>
                <option value="data_analyst">Data Analyst (competence focus)</option>
                <option value="sales_representative">Sales Representative (visibility focus)</option>
                <option value="campaign_manager">Campaign Manager (balanced focus)</option>
              </select>
            </label>

            <label className="field" style={{ minWidth: "220px", margin: 0 }}>
              <span>Budget (salary)</span>
              <select
                disabled={mode === "intern"}
                value={salary}
                onChange={(e) => setSalary(Number.parseInt(e.target.value, 10))}
              >
                {salaryOptions.map((value) => (
                  <option key={value} value={value}>
                    EUR {value.toLocaleString("en-GB")}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-primary"
              disabled={
                capReached ||
                !canAffordSelected ||
                (mode === "full_time" && (!role || salaryOptions.length === 0))
              }
              onClick={findEmployees}
            >
              Find employees
            </button>
          </div>
          {mode === "intern" ? <p className="muted">Role and budget are fixed for interns.</p> : null}
          {mode === "full_time" && salaryOptions.length === 0 ? (
            <p className="muted">No salary bands are currently affordable.</p>
          ) : null}
        </section>
      ) : (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Choose one of 3 candidates</h2>
          <div className="card-grid cols-3" style={{ marginTop: "0.75rem" }}>
            {candidates.map((c) => (
              <div key={c.id} className="choice-card" style={{ textAlign: "left" }}>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>{c.name}</h3>
                <p className="muted" style={{ margin: "0 0 0.4rem" }}>
                  {mode === "intern" ? "Intern" : `${roleLabel(c.role)} · ${tier}`} · EUR {c.salary.toLocaleString("en-GB")}
                </p>
                <p style={{ margin: 0 }}>{c.description}</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => hireCandidate(c)}>
                  Hire
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
    {hireReport ? (
      <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Hiring result">
        <div className="game-modal">
          <p className="game-modal-kicker">Hiring report</p>
          <h2 style={{ marginTop: 0 }}>{hireReport.title}</h2>
          <p style={{ marginBottom: "0.4rem" }}>{hireReport.productivityLine}</p>
          <p style={{ marginTop: 0 }}>{hireReport.skillLine}</p>
          <div className="game-modal-stats">
            <span>Productivity: {hireReport.productivity}%</span>
            <span>Skill: +{hireReport.skill}</span>
            <span>Capacity: +{hireReport.capGain}</span>
            <span>Competence: +{hireReport.competenceGain}</span>
            <span>Visibility: +{hireReport.visibilityGain}</span>
          </div>
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-primary" onClick={() => setHireReport(null)}>
              OK
            </button>
          </div>
        </div>
      </div>
    ) : null}
  );
}

