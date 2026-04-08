"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  BUILDS,
  GAME_TITLE,
  GENDER_OPTIONS,
  SPOUSE_OPTIONS,
  type BuildId,
  type GenderValue,
} from "@/lib/onboardingContent";
import {
  STARTING_REPUTATION,
  STARTING_BUILD_STATS,
  applySpouseAtStart,
  type BuildStats,
  type SpouseType,
} from "@/lib/gameEconomy";
import { persistSave } from "@/lib/saveGameStorage";

export type NewGamePayload = {
  playerName: string;
  agencyName: string;
  gender: GenderValue;
  buildId: BuildId;
  spouseType: SpouseType;
  /** Set when spouseType is not `none`; otherwise null. */
  spouseGender: GenderValue | null;
  /** Set when spouseType is not `none`; otherwise null. */
  spouseName: string | null;
  seasonNumber: number;
  phase: "preseason" | "season" | "postseason";
  activityFocusUsedInPreseason: boolean;
  /** Season -> selected pre-season focus id (e.g. "1" -> "strategy_workshop"). */
  preseasonActionBySeason: Partial<Record<string, "strategy_workshop" | "network">>;
  /** Cumulative focus picks across all pre-seasons (for future scaling logic). */
  preseasonFocusCounts: {
    strategy_workshop: number;
    network: number;
  };
  /** Derived metric; not directly tied to spouse or spend at start. */
  reputation: number;
  resources: BuildStats;
  initialResources?: BuildStats;
  initialReputation?: number;
  hiresBySeason?: Partial<Record<string, number>>;
  employees?: Array<{
    id: string;
    name: string;
    role: string;
    salary: number;
    seasonHired: number;
    competenceGain: number;
    visibilityGain: number;
    capacityGain: number;
  }>;
  createdAt: string;
};

function isGenderValue(v: string): v is GenderValue {
  return GENDER_OPTIONS.some((g) => g.value === v);
}

export function NewGameWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [playerName, setPlayerName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [gender, setGender] = useState<GenderValue | "">("");

  const [buildId, setBuildId] = useState<BuildId | null>(null);
  const [spouseType, setSpouseType] = useState<SpouseType | null>(null);
  const [spouseName, setSpouseName] = useState("");
  const [spouseGender, setSpouseGender] = useState<GenderValue | "">("");

  const step1Valid = useMemo(
    () =>
      playerName.trim().length > 0 &&
      agencyName.trim().length > 0 &&
      gender !== "",
    [playerName, agencyName, gender]
  );

  const step3Valid = useMemo(() => {
    if (spouseType === null) return false;
    if (spouseType === "none") return true;
    return spouseName.trim().length > 0 && spouseGender !== "";
  }, [spouseType, spouseName, spouseGender]);

  const persistAndFinish = useCallback(() => {
    if (!buildId || spouseType === null) return;
    if (spouseType !== "none" && (spouseName.trim() === "" || spouseGender === "")) return;
    const base = STARTING_BUILD_STATS[buildId];
    const resources = applySpouseAtStart(base, spouseType);
    const payload: NewGamePayload = {
      playerName: playerName.trim(),
      agencyName: agencyName.trim(),
      gender: gender as GenderValue,
      buildId,
      spouseType,
      spouseGender: spouseType === "none" ? null : (spouseGender as GenderValue),
      spouseName: spouseType === "none" ? null : spouseName.trim(),
      seasonNumber: 1,
      phase: "preseason",
      activityFocusUsedInPreseason: false,
      preseasonActionBySeason: {},
      preseasonFocusCounts: {
        strategy_workshop: 0,
        network: 0,
      },
      reputation: STARTING_REPUTATION,
      resources,
      initialResources: resources,
      initialReputation: STARTING_REPUTATION,
      hiresBySeason: {},
      employees: [],
      createdAt: new Date().toISOString(),
    };
    persistSave(payload);
    setStep(4);
  }, [playerName, agencyName, gender, buildId, spouseType, spouseGender, spouseName]);

  const selectSpouseType = (t: SpouseType) => {
    setSpouseType(t);
    if (t === "none") {
      setSpouseGender("");
      setSpouseName("");
    }
  };

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.75rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0, fontSize: "clamp(1.35rem, 3.5vw, 1.75rem)" }}>
          New game
        </h1>
        <p className="muted" style={{ margin: "0.5rem 0 0", maxWidth: "36rem" }}>
          One save slot—your choices will overwrite any previous run when we hook up Continue.
        </p>
        <div className="step-dots" aria-hidden>
          <span className={step >= 1 ? "active" : ""} />
          <span className={step >= 2 ? "active" : ""} />
          <span className={step >= 3 ? "active" : ""} />
        </div>
      </header>

      {step === 1 && (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Founder &amp; agency</h2>
          <div className="field">
            <label htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              type="text"
              autoComplete="name"
              placeholder="Jordan Lee"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="agency-name">Agency name</label>
            <input
              id="agency-name"
              type="text"
              autoComplete="organization"
              placeholder="Spin Cycle Media"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
          </div>
          <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Gender
            </legend>
            <div className="gender-row">
              {GENDER_OPTIONS.map((g) => (
                <label key={g.value}>
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={() => setGender(g.value)}
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <Link href="/" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Origin story</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick how your agency began—each path has the same overall starting power, different flavors.
          </p>
          <div className="card-grid cols-3 build-cards" style={{ marginTop: "1.25rem" }}>
            {BUILDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`choice-card${buildId === b.id ? " selected" : ""}`}
                onClick={() => setBuildId(b.id)}
              >
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>{b.name}</h3>
                <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontStyle: "italic" }}>
                  {b.tagline}
                </p>
                <p
                  style={{
                    margin: "0 0 0.65rem",
                    fontSize: "0.875rem",
                    lineHeight: 1.58,
                    textAlign: "left",
                  }}
                >
                  {b.bio}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  {b.statsSummary}
                </p>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!buildId}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Partner in crime (or not)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick a partner archetype—or go it alone. Details stay between you and the spreadsheet we haven’t built yet.
          </p>
          <div className="card-grid cols-2" style={{ marginTop: "1.25rem" }}>
            {SPOUSE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`choice-card${spouseType === s.id ? " selected" : ""}`}
                onClick={() => selectSpouseType(s.id)}
              >
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>{s.title}</h3>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>{s.blurb}</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600 }}>
                  {s.boost}
                </p>
              </button>
            ))}
          </div>

          {spouseType !== null && spouseType !== "none" && (
            <>
              <div className="field" style={{ marginTop: "1.5rem" }}>
                <label htmlFor="spouse-name">Spouse name</label>
                <input
                  id="spouse-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                />
              </div>
              <fieldset
                className="field"
                style={{ border: "none", padding: 0, margin: 0 }}
              >
                <legend
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Spouse gender
                </legend>
              <div className="gender-row">
                {GENDER_OPTIONS.map((g) => (
                  <label key={`spouse-${g.value}`}>
                    <input
                      type="radio"
                      name="spouse-gender"
                      value={g.value}
                      checked={spouseGender === g.value}
                      onChange={() => setSpouseGender(g.value)}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
              </fieldset>
            </>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!step3Valid}
              onClick={persistAndFinish}
            >
              Start agency
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>You&apos;re on the clock</h2>
          <p style={{ marginTop: 0 }}>
            Your run is stored locally for now (one slot). Next up: pre-season activities.
          </p>
          <ul className="muted" style={{ paddingLeft: "1.2rem" }}>
            <li>
              <strong style={{ color: "var(--text)" }}>{playerName.trim()}</strong> · {gender && isGenderValue(gender) ? GENDER_OPTIONS.find((g) => g.value === gender)?.label : gender}
            </li>
            <li>
              <strong style={{ color: "var(--text)" }}>{agencyName.trim()}</strong>
            </li>
            <li>Origin: {BUILDS.find((b) => b.id === buildId)?.name}</li>
            <li>
              Spouse: {SPOUSE_OPTIONS.find((s) => s.id === spouseType)?.title ?? "—"}
              {spouseType !== null &&
                spouseType !== "none" &&
                spouseName.trim() &&
                spouseGender &&
                isGenderValue(spouseGender) && (
                  <>
                    {" "}
                    — {spouseName.trim()} · {GENDER_OPTIONS.find((g) => g.value === spouseGender)?.label}
                  </>
                )}
            </li>
            <li>Firm reputation: {STARTING_REPUTATION}</li>
          </ul>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <Link href="/game/preseason/1" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Start pre-season 1
            </Link>
            <Link href="/" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Back to menu
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
