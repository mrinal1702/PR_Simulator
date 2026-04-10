"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  banTalentBazaarName,
  capacityGainFromProductivity,
  generateCandidates,
  getHireCapForSeason,
  getSalaryBands,
  getTalentBazaarExcludedNames,
  mergeTalentBazaarJuniorConsumed,
  roleLabel,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "@/lib/hiring";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { liquidityEur, wageLineId } from "@/lib/payablesReceivables";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceBreakdownHost } from "@/components/AgencyFinanceBreakdownHost";
import { AgencyFinanceSnapshot } from "@/components/AgencyFinanceSnapshot";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { BreakdownMetric } from "@/lib/metricBreakdown";

const HIRING_ROLE_OPTIONS: {
  id: HiringRole;
  title: string;
  focusLabel: string;
  symbols: Array<"competence" | "visibility">;
}[] = [
  { id: "data_analyst", title: "Data Analyst", focusLabel: "Competence Focus", symbols: ["competence"] },
  {
    id: "sales_representative",
    title: "Sales Representative",
    focusLabel: "Visibility Focus",
    symbols: ["visibility"],
  },
  {
    id: "campaign_manager",
    title: "Campaign Manager",
    focusLabel: "Balanced Focus",
    symbols: ["competence", "visibility"],
  },
];

/** 0–25% productivity (name-interpolated): tier flavor — intern vs junior vs mid vs senior. */
function hiringReportLowProductivityIntern(name: string): string {
  return `${name} has optimized the reaction-emoji pipeline and filed the real work under "Phase 2 (TBD)."`;
}

function hiringReportLowProductivityJunior(name: string): string {
  return `${name} is still in the "how to look busy without a body double" bootcamp—capacity exists, output is in beta.`;
}

function hiringReportLowProductivityMid(name: string): string {
  return `${name} has enough years on the badge to calendar-block "deep work" and still spend it in a meeting about meetings.`;
}

function hiringReportLowProductivitySenior(name: string): string {
  return `${name} has ascended to strategic presence: the deck is mostly implied, like a pension you can feel.`;
}

type FTNonInternTier = Exclude<HiringTier, "intern">;

function hiringReportLowProductivityForTier(tier: FTNonInternTier, name: string): string {
  switch (tier) {
    case "junior":
      return hiringReportLowProductivityJunior(name);
    case "mid":
      return hiringReportLowProductivityMid(name);
    case "senior":
      return hiringReportLowProductivitySenior(name);
  }
}

/** Lowest skill tier (≤25% of band), full-time — by role and by seniority tier. */
const HIRING_LOW_SKILL_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} thinks a heat map is weather and "clean the data" means alphabetizing the tab names.`,
  sales_representative: (name) =>
    `${name} could circle back to a circle back—closing is mostly a season-finale cliffhanger.`,
  campaign_manager: (name) =>
    `${name} thinks the brief is a vibe check and the RACI chart is modern art.`,
};

const HIRING_LOW_SKILL_MID: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} hides columns instead of fixing them—mid-level Excel, junior-level courage, veteran-level denial.`,
  sales_representative: (name) =>
    `${name} calls it "relationship farming" when the pipeline is last year's leads wearing a new LinkedIn banner.`,
  campaign_manager: (name) =>
    `${name} says "alignment" on slide 47 and still hasn't admitted what the product is called.`,
};

const HIRING_LOW_SKILL_SENIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} cites "industry benchmarks" while the model is mostly gut feel in a tie.`,
  sales_representative: (name) =>
    `${name} could filibuster a forecast—closing moved to "when the stars align (FY27)."`,
  campaign_manager: (name) =>
    `${name} holds the wheel on the brand wagon; the roadmap is a mood board and the GPS is prayer.`,
};

function hiringReportLowSkillLineForTier(
  tier: FTNonInternTier,
  role: HiringRole,
  name: string
): string {
  const table =
    tier === "junior"
      ? HIRING_LOW_SKILL_JUNIOR
      : tier === "mid"
        ? HIRING_LOW_SKILL_MID
        : HIRING_LOW_SKILL_SENIOR;
  return table[role](name);
}

/**
 * Productivity 26–50%: same line for interns and junior full-time (humor + mitigating);
 * mid/senior keep the shorter generic line below.
 */
function hiringReportProductivity26to50InternJunior(name: string): string {
  return `${name} still treats "tomorrow" like a renewable resource, but work actually ships—late, loud, and eventually labeled final_final.`;
}

/** Skill 26–50% of band: junior full-time only — role callout, joke + silver lining. */
const HIRING_SKILL_26_50_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} is not winning a forecasting Nobel yet, but the joins line up, totals reconcile, and obvious junk gets flagged before it reaches a slide deck.`,
  sales_representative: (name) =>
    `${name} still says "circling back" like a catchphrase, but people answer, notes exist, and the pipeline has more reality than vibes.`,
  campaign_manager: (name) =>
    `${name} color-codes chaos first and the plan second, but stakeholders get answers, creatives get a brief, and launch day shows up on the calendar.`,
};

type EmploymentMode = "intern" | "full_time";

/** Interns: productivity narrative only (fixed +3/+3 competence and visibility; no skill copy). */
type HireReport =
  | {
      hireKind: "intern";
      title: string;
      productivityLine: string;
      productivity: number;
      capGain: number;
      competenceGain: number;
      visibilityGain: number;
    }
  | {
      hireKind: "full_time";
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
  const [pendingCandidate, setPendingCandidate] = useState<Candidate | null>(null);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);

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
      .filter((value) => liquidityEur(save) >= value);
  }, [mode, tier, save]);
  const canAffordIntern = liquidityEur(save) >= 10_000;
  const canAffordSelected =
    mode === "intern" ? canAffordIntern : liquidityEur(save) >= salary;

  useEffect(() => {
    if (mode !== "full_time") return;
    if (salaryOptions.length === 0) return;
    if (!salaryOptions.includes(salary)) {
      setSalary(salaryOptions[0]);
    }
  }, [mode, salaryOptions, salary]);

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
    const excluded = getTalentBazaarExcludedNames(save, selectionTier);
    const next = generateCandidates({
      seedBase: `${save.createdAt}|${save.playerName}`,
      season,
      role: selectionRole,
      tier: selectionTier,
      salary: selectedSalary,
      reputation: save.reputation ?? 5,
      visibility: save.resources.visibility,
      excludedNames: excluded,
    });
    let saveAfterPool = save;
    if (selectionTier === "junior" && next.length > 0) {
      saveAfterPool = mergeTalentBazaarJuniorConsumed(
        save,
        next.map((c) => c.name)
      );
    }
    if (saveAfterPool !== save) {
      setSave(saveAfterPool);
      persistSave(saveAfterPool);
    }
    setCandidates(next);
    setStage("results");
    if (next.length === 0) {
      setNotice("No candidates left in the Talent Bazaar for this role and seniority.");
    } else {
      setNotice("");
    }
  };

  const finalizeHireCandidate = (candidate: Candidate) => {
    if (capReached) return;
    if (liquidityEur(save) < candidate.salary) {
      setNotice("Cannot hire: cash and receivables would not cover payables plus this wage.");
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
      const split = splitBalancedSkill(skill, `${candidate.id}|${seasonKey}`);
      competenceGain = split.competence;
      visibilityGain = split.visibility;
    }

    const newEmployeeId = `${candidate.id}-${season}-${hiredThisSeason + 1}`;
    let baseSave: NewGamePayload = {
      ...save,
      resources: {
        ...save.resources,
        competence: save.resources.competence + competenceGain,
        visibility: save.resources.visibility + visibilityGain,
        firmCapacity: save.resources.firmCapacity + capGain,
      },
      payablesLines: [
        ...(save.payablesLines ?? []),
        {
          id: wageLineId(newEmployeeId),
          label: `${candidate.name} wage`,
          amount: candidate.salary,
        },
      ],
      hiresBySeason: {
        ...(save.hiresBySeason ?? {}),
        [seasonKey]: hiredThisSeason + 1,
      },
      employees: [
        ...(save.employees ?? []),
        {
          id: newEmployeeId,
          name: candidate.name,
          role: mode === "intern" ? "Intern" : roleLabel(candidate.role),
          salary: candidate.salary,
          seasonHired: season,
          competenceGain,
          visibilityGain,
          capacityGain: capGain,
          ...(mode === "full_time" ? { productivityPct: productivity, tenureCapacityBonus: 0 } : {}),
        },
      ],
    };
    if (mode === "intern") {
      baseSave = banTalentBazaarName(baseSave, candidate.name);
    }
    const updated = baseSave;
    setSave(updated);
    persistSave(updated);
    setNotice(`Hired ${candidate.name}. Autosaved.`);

    const prodLine =
      productivity <= 25
        ? mode === "intern"
          ? hiringReportLowProductivityIntern(candidate.name)
          : hiringReportLowProductivityForTier(tier, candidate.name)
        : productivity <= 50
        ? mode === "intern" || tier === "junior"
          ? hiringReportProductivity26to50InternJunior(candidate.name)
          : "Some sparks of effort, but still warming up to agency speed."
        : productivity <= 75
        ? "Solid contributor: dependable output with room to sharpen."
        : "Absolute engine this cycle, quietly carrying real workload.";

    if (mode === "intern") {
      setHireReport({
        hireKind: "intern",
        title: `${candidate.name} joined the agency`,
        productivityLine: prodLine,
        productivity,
        capGain,
        competenceGain,
        visibilityGain,
      });
    } else {
      const skillPct = Math.round(
        (skill / (tier === "junior" ? 20 : tier === "mid" ? 40 : 80)) * 100
      );
      const skillLine =
        skillPct <= 25
          ? hiringReportLowSkillLineForTier(tier, candidate.role, candidate.name)
          : skillPct <= 50
          ? tier === "junior"
            ? HIRING_SKILL_26_50_JUNIOR[candidate.role](candidate.name)
            : "Serviceable hire: not a steal, not a disaster, just workable."
          : skillPct <= 75
          ? "Strong value pickup for this band, strategy team approves."
          : "Elite value hit: this salary band just overdelivered hard.";

      setHireReport({
        hireKind: "full_time",
        title: `${candidate.name} joined the agency`,
        productivityLine: prodLine,
        skillLine,
        productivity,
        skill,
        capGain,
        competenceGain,
        visibilityGain,
      });
    }

    setStage("home");
    setMode("intern");
    setTier("junior");
    setRole(null);
    setSalary(15_000);
    setCandidates([]);
  };

  const openHireWarning = (candidate: Candidate) => {
    setPendingCandidate(candidate);
  };

  const confirmHire = () => {
    if (!pendingCandidate) return;
    finalizeHireCandidate(pendingCandidate);
    setPendingCandidate(null);
  };

  return (
    <>
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.2rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Talent Bazaar</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Max hires this pre-season: {cap} · Hired: {hiredThisSeason}
        </p>
      </header>

      <AgencyResourceStrip save={save} />
      <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />

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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            {mode === "full_time" ? (
              <div className="field" style={{ margin: 0, maxWidth: "32rem" }}>
                <span>Role</span>
                <div className="hiring-role-picker" role="radiogroup" aria-label="Employee role">
                  {HIRING_ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`hiring-role-option${role === opt.id ? " selected" : ""}`}
                      onClick={() => setRole(opt.id)}
                      aria-pressed={role === opt.id}
                    >
                      <span className="hiring-role-option__icons">
                        {opt.symbols.map((sym) => (
                          <ResourceSymbol key={sym} id={sym} size={18} />
                        ))}
                      </span>
                      <span className="hiring-role-option__body">
                        <span className="hiring-role-option__title">{opt.title}</span>
                        <span className="hiring-role-option__focus">{opt.focusLabel}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
              <label className="field" style={{ minWidth: "250px", margin: 0 }}>
                <span>Seniority</span>
                <select
                  disabled={mode === "intern"}
                  value={tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as Exclude<HiringTier, "intern">;
                    setTier(nextTier);
                    const anchors = getSalaryBands(nextTier).map((b) => b.anchor * 1000);
                    const filtered = anchors.filter((value) => liquidityEur(save) >= value);
                    setSalary(filtered[0] ?? anchors[0]);
                  }}
                >
                  <option value="junior">Junior (15k-39k)</option>
                  <option value="mid">Mid (40k-64k)</option>
                  <option value="senior">Senior (65k-89k)</option>
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
          </div>
          {mode === "intern" ? <p className="muted">Role and budget are fixed for interns.</p> : null}
          {mode === "full_time" && salaryOptions.length === 0 ? (
            <p className="muted">No salary bands are currently affordable.</p>
          ) : null}
        </section>
      ) : (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>
            {candidates.length === 0
              ? "No candidates available"
              : candidates.length === 1
                ? "Choose your candidate"
                : `Choose one of ${candidates.length} candidates`}
          </h2>
          {candidates.length === 0 ? (
            <p className="muted">Everyone matching this search is already on your team, excluded, or the roster is exhausted.</p>
          ) : (
          <div
            className={`card-grid${candidates.length >= 3 ? " cols-3" : candidates.length === 2 ? " cols-2" : ""}`}
            style={{ marginTop: "0.75rem" }}
          >
            {candidates.map((c) => (
              <div key={c.id} className="choice-card" style={{ textAlign: "left" }}>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>{c.name}</h3>
                <p className="muted" style={{ margin: "0 0 0.4rem" }}>
                  {mode === "intern" ? "Intern" : `${roleLabel(c.role)} · ${tier}`} · EUR {c.salary.toLocaleString("en-GB")}
                </p>
                <p style={{ margin: 0 }}>{c.description}</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => openHireWarning(c)}>
                  Hire
                </button>
              </div>
            ))}
          </div>
          )}
        </section>
      )}
    </div>
    {hireReport ? (
      <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Hiring result">
        <div className="game-modal">
          <p className="game-modal-kicker">Hiring report</p>
          <h2 style={{ marginTop: 0 }}>{hireReport.title}</h2>
          <p style={{ marginBottom: "0.4rem" }}>{hireReport.productivityLine}</p>
          {hireReport.hireKind === "full_time" ? (
            <p style={{ marginTop: 0 }}>{hireReport.skillLine}</p>
          ) : null}
          <div className="game-modal-stats">
            <span>Productivity: {hireReport.productivity}%</span>
            {hireReport.hireKind === "full_time" ? <span>Skill: +{hireReport.skill}</span> : null}
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="capacity" size={15} />
              </span>
              <span>
                Capacity: +{hireReport.capGain}
              </span>
            </span>
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="competence" size={15} />
              </span>
              <span>
                Competence: +{hireReport.competenceGain}
              </span>
            </span>
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="visibility" size={15} />
              </span>
              <span>
                Visibility: +{hireReport.visibilityGain}
              </span>
            </span>
          </div>
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-primary" onClick={() => setHireReport(null)}>
              OK
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {pendingCandidate ? (
      <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm hire warning">
        <div className="game-modal">
          <p className="game-modal-kicker">Before you hire</p>
          <h2 style={{ marginTop: 0 }}>Are you sure you want to hire {pendingCandidate.name}?</h2>
          {mode === "intern" ? (
            <p style={{ marginTop: 0 }}>
              Intern reminder: they will leave your agency and will not count toward next season&apos;s payroll.
            </p>
          ) : (
            <p style={{ marginTop: 0 }}>
              Are you sure? If you can&apos;t afford this employee&apos;s salary after the season ends, you will need to lay them off.
            </p>
          )}
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingCandidate(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmHire}>
              Confirm hire
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {breakdownMetric ? (
      <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
    ) : null}
    </>
  );
}

