"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import {
  archetypeIdFromSolutionId,
  buildCarryoverSolutionOptionsForClient,
  buildSolutionOptionsForClientWithScenario,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SolutionOption,
} from "@/lib/seasonClientLoop";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceBreakdownHost } from "@/components/AgencyFinanceBreakdownHost";
import { AgencyFinanceSnapshot } from "@/components/AgencyFinanceSnapshot";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { BreakdownMetric } from "@/lib/metricBreakdown";
import {
  applySeason2CarryoverChoice,
  applyBuildOutcomeShift,
  getSeasonCarryoverEntries,
  getSeasonCarryoverProgress,
  highLowLabelsFromThreshold,
} from "@/lib/seasonCarryover";

export function SeasonClientCaseScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [blockedByPayroll, setBlockedByPayroll] = useState(false);
  const [pendingSolution, setPendingSolution] = useState<SolutionOption | null>(null);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [showCarryoverDetails, setShowCarryoverDetails] = useState(false);
  const [pendingCarryoverSolution, setPendingCarryoverSolution] = useState<SolutionOption | null>(null);

  const seasonKey = String(season);
  const payrollPaidForSeason = save?.payrollPaidBySeason?.[seasonKey] === true;
  useEffect(() => {
    if (!save || season < 2) return;
    if (payrollPaidForSeason) return;
    setBlockedByPayroll(true);
    router.replace(`/game/preseason/${season}`);
  }, [save, season, payrollPaidForSeason, router]);

  if (blockedByPayroll) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Redirecting…</h1>
        <p className="muted">Pre-season must be completed before entering season.</p>
      </div>
    );
  }

  const loop = save?.seasonLoopBySeason?.[seasonKey];
  const currentClient = loop?.clientsQueue[loop.currentClientIndex] ?? null;
  const runForCurrentClient = currentClient
    ? loop?.runs.find((r) => r.clientId === currentClient.id)
    : undefined;
  const awaitingChoice = Boolean(currentClient && !runForCurrentClient);

  const solutionOptions = useMemo(() => {
    if (!currentClient) return [];
    const opts = buildSolutionOptionsForClientWithScenario(currentClient);
    if (season === 1) {
      return opts.map((o) =>
        o.isRejectOption
          ? {
              ...o,
              title: "Reject client",
              description: "Pass on this client. No campaign runs and no client fees apply.",
            }
          : o
      );
    }
    return opts;
  }, [currentClient, season]);

  const carryoverSolutionOptions = useMemo(() => {
    if (!save || season < 2) return [];
    const entries = getSeasonCarryoverEntries(save, season);
    const progress = getSeasonCarryoverProgress(save, season);
    const cc = entries[progress];
    if (!cc) return [];
    return buildCarryoverSolutionOptionsForClient(cc.client);
  }, [save, season]);

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

  const rolloverEntries = season >= 2 ? getSeasonCarryoverEntries(save, season) : [];
  const rolloverProgress = season >= 2 ? getSeasonCarryoverProgress(save, season) : 0;
  const currentCarryover = rolloverEntries[rolloverProgress] ?? null;

  if (season >= 2 && currentCarryover) {
    const shifted = applyBuildOutcomeShift(
      save.buildId,
      currentCarryover.run.outcome.messageSpread,
      currentCarryover.run.outcome.messageEffectiveness
    );
    const labels = highLowLabelsFromThreshold(shifted.reach, shifted.effectiveness);
    const arcKey = `${labels.reach}_visibility_${labels.effectiveness}_effectiveness` as const;
    const arcText = currentCarryover.client.postSeasonArcOutcomes?.[arcKey]
      ?? "No scenario arc text found for this branch.";

    const liquidForCarryover = save.resources.eur;

    const applyCarryoverChoice = (solution: typeof pendingCarryoverSolution) => {
      if (!solution) return;
      const seed = `${save.createdAt}-s${season}-carryover-${currentCarryover.client.id}-${solution.id}`;
      const next = applySeason2CarryoverChoice(save, season, currentCarryover.client.id, solution, seed);
      if (!next) {
        setNotice("Could not apply that choice (check EUR and capacity).");
        return;
      }
      setSave(next);
      persistSave(next);
      setPendingCarryoverSolution(null);
      setShowCarryoverDetails(false);
      setNotice("Carry-over applied.");
    };

    const confirmCarryoverChoice = () => applyCarryoverChoice(pendingCarryoverSolution);

    return (
      <>
      <div className="shell shell-wide client-case-theater">
        <header style={{ marginBottom: "1.5rem" }}>
          <p className="muted" style={{ margin: "0 0 0.25rem" }}>
            <Link href={`/game/season/${season}`}>← Season {season} hub</Link>
          </p>
          <h1 style={{ margin: 0 }}>Season 1 client follow-up</h1>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Scenario {rolloverProgress + 1} of {rolloverEntries.length} (original Season 1 order).
          </p>
        </header>

        <AgencyResourceStrip save={save} />
        <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />

        <div
          key={`carryover-${season}-${rolloverProgress}-${currentCarryover.client.id}`}
          className="client-case-theater__window"
        >
          <div className="client-case-theater__window-casing" aria-hidden />
          <div className="client-case-theater__window-inner">
        <section className="agency-stats-panel client-case-theater__dossier">
          <h2 style={{ margin: "0 0 0.45rem" }}>
            {currentCarryover.client.scenarioTitle}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            <strong>{currentCarryover.client.displayName}</strong>
          </p>

          <SimpleBwPercentBar label="Solution effectiveness" value={shifted.effectiveness} />
          <SimpleBwPercentBar label="Solution reach" value={shifted.reach} />

          <BuildShiftIndicator buildId={save.buildId} />

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.4rem" }}
            onClick={() => setShowCarryoverDetails((v) => !v)}
          >
            {showCarryoverDetails ? "Hide details" : "See more"}
          </button>

          {showCarryoverDetails ? (
            <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.85rem" }}>
              <div>
                <h4 style={{ margin: "0 0 0.3rem" }}>Season 1 scenario description</h4>
                <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{currentCarryover.client.problem}</p>
              </div>
              <div>
                <h4 style={{ margin: "0 0 0.3rem" }}>Action taken in Season 1</h4>
                <p className="muted" style={{ margin: 0 }}>
                  {currentCarryover.run.solutionTitle ?? "No recorded solution title."}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="agency-stats-panel client-case-theater__panel" style={{ marginTop: "1rem" }}>
          <h3 className="client-case-theater__section-title" style={{ marginTop: 0, marginBottom: "0.35rem" }}>
            So what happened?
          </h3>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{arcText}</p>
        </section>

        <section className="agency-stats-panel client-case-theater__panel" style={{ marginTop: "1rem" }}>
          <h3 className="client-case-theater__section-title" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            What should you do?
          </h3>
          <div style={{ display: "grid", gap: "0.55rem" }}>
            {carryoverSolutionOptions.map((opt) => {
              const affordable = canAffordSolution(opt, liquidForCarryover, save.resources.firmCapacity);
              const forceDoNothingOnly =
                !opt.isRejectOption &&
                carryoverSolutionOptions
                  .filter((s) => !s.isRejectOption)
                  .every((s) => !canAffordSolution(s, liquidForCarryover, save.resources.firmCapacity));
              const displayTitle = opt.isRejectOption ? "Take no action" : opt.title;
              const displayDesc = opt.isRejectOption
                ? "Take no action. Reach and effectiveness might drop slightly."
                : opt.description;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="choice-card"
                  onClick={() => setPendingCarryoverSolution(opt)}
                  disabled={!opt.isRejectOption && (forceDoNothingOnly || !affordable)}
                  style={{ textAlign: "left" }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {displayTitle}
                  </p>
                  <p className="muted" style={{ margin: "0.25rem 0 0" }}>{displayDesc}</p>
                  <p className="muted" style={{ margin: "0.35rem 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      <ResourceSymbol id="eur" size={16} />
                      EUR {opt.costBudget.toLocaleString("en-GB")}
                    </span>
                    <span aria-hidden>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                      <ResourceSymbol id="capacity" size={16} />
                      {opt.costCapacity} capacity
                    </span>
                    {!opt.isRejectOption && !affordable ? (
                      <span style={{ color: "var(--danger)", fontStyle: "italic" }}>Not enough resources</span>
                    ) : null}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

          </div>
        </div>

        {notice ? <p className="client-case-theater__notice">{notice}</p> : null}
      </div>
      {pendingCarryoverSolution ? (
        <div
          className="game-modal-overlay client-case-theater-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="carryover-confirm-title"
        >
          <div className="game-modal client-case-theater-modal">
            <p className="game-modal-kicker">Confirm carry-over</p>
            <h2 id="carryover-confirm-title" style={{ marginTop: 0 }}>
              {pendingCarryoverSolution.title}
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {pendingCarryoverSolution.isRejectOption
                ? "Take no action. Reach and effectiveness might drop slightly."
                : "Apply further effort to this client. Spend the listed EUR and capacity to continue the campaign."}
            </p>
            {!pendingCarryoverSolution.isRejectOption ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", marginTop: "0.5rem" }}>
                <span className="preseason-resource-strip__pair" title="Wealth (EUR)">
                  <ResourceSymbol id="eur" size={18} />
                  <span className="preseason-resource-strip__val">
                    {pendingCarryoverSolution.costBudget.toLocaleString("en-GB")}
                  </span>
                </span>
                <span className="preseason-resource-strip__pair" title="Firm capacity">
                  <ResourceSymbol id="capacity" size={18} />
                  <span className="preseason-resource-strip__val">{pendingCarryoverSolution.costCapacity}</span>
                </span>
              </div>
            ) : null}
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingCarryoverSolution(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmCarryoverChoice}>
                Confirm
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

  const advanceToNextClient = (nextRuns: NonNullable<typeof loop>["runs"], nextSave?: NewGamePayload) => {
    if (!save || !loop) return;
    const nextIndex = Math.min(loop.currentClientIndex + 1, loop.plannedClientCount);
    const base = nextSave ?? save;
    const sourceLoop = base.seasonLoopBySeason?.[seasonKey] ?? loop;
    const updated: NewGamePayload = {
      ...base,
      seasonLoopBySeason: {
        ...(base.seasonLoopBySeason ?? {}),
        [seasonKey]: {
          ...sourceLoop,
          currentClientIndex: nextIndex,
          runs: nextRuns,
        },
      },
    };
    setSave(updated);
    persistSave(updated);
  };

  const commitSolution = (solution: SolutionOption) => {
    if (!save || !loop || !currentClient || runForCurrentClient) return;

    if (solution.isRejectOption) {
      const nextRuns = [
        ...loop.runs,
        { clientId: currentClient.id, accepted: false as const, solutionId: "reject" as const },
      ];
      advanceToNextClient(nextRuns);
      setNotice("Client rejected.");
      return;
    }

    const liquidForCheck = save.resources.eur + currentClient.budgetSeason1;
    if (!canAffordSolution(solution, liquidForCheck, save.resources.firmCapacity)) return;

    const outcome = resolveClientOutcome({
      seed: `${save.createdAt}-${seasonKey}-${currentClient.id}-${solution.id}`,
      solution,
      visibility: save.resources.visibility,
      competence: save.resources.competence,
      discipline: currentClient.hiddenDiscipline,
      satisfactionReachWeight: getSatisfactionReachWeight(currentClient),
      outcomeScoreSeason: season >= 2 ? 2 : 1,
    });

    const eurAfter = save.resources.eur + currentClient.budgetSeason1 - solution.costBudget;
    const updated: NewGamePayload = {
      ...save,
      resources: {
        ...save.resources,
        eur: Math.max(0, eurAfter),
        firmCapacity: Math.max(0, save.resources.firmCapacity - solution.costCapacity),
      },
      seasonLoopBySeason: {
        ...(save.seasonLoopBySeason ?? {}),
        [seasonKey]: {
          ...loop,
          lastOutcome: outcome,
          runs: [
            ...loop.runs,
            {
              clientId: currentClient.id,
              accepted: true as const,
              solutionId: solution.id,
              outcome,
              costBudget: solution.costBudget,
              costCapacity: solution.costCapacity,
              solutionTitle: solution.title,
            },
          ],
        },
      },
    };
    const nextRuns = updated.seasonLoopBySeason?.[seasonKey]?.runs ?? loop.runs;
    advanceToNextClient(nextRuns, updated);
    setNotice("Campaign executed.");
  };

  if (!loop) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href={`/game/season/${season}`}>← Season {season} hub</Link>
        </p>
        <h1>Client case</h1>
        <p>Roll your client queue from the season hub first.</p>
        <Link className="btn btn-primary" href={`/game/season/${season}`} style={{ textDecoration: "none", width: "fit-content" }}>
          Go to season hub
        </Link>
      </div>
    );
  }

  if (loop.currentClientIndex >= loop.plannedClientCount) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href={`/game/season/${season}`}>← Season {season} hub</Link>
        </p>
        <h1>Client case</h1>
        <p className="muted">This season&apos;s client queue is finished.</p>
        <Link className="btn btn-primary" href={`/game/season/${season}`} style={{ textDecoration: "none", width: "fit-content" }}>
          Back to hub
        </Link>
      </div>
    );
  }

  if (!currentClient) {
    return null;
  }

  const liquidForAfford = save.resources.eur + currentClient.budgetSeason1;

  return (
    <>
    <div className="shell shell-wide client-case-theater">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href={`/game/season/${season}`}>← Season {season} hub</Link>
        </p>
        <h1 style={{ margin: 0 }}>Client case</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Client {Math.min(loop.currentClientIndex + 1, loop.plannedClientCount)} of {loop.plannedClientCount} this season.
        </p>
      </header>

      <AgencyResourceStrip save={save} />
      <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />

      <section>
        <div
          key={`queue-${season}-${loop.currentClientIndex}-${currentClient.id}`}
          className="client-case-theater__window"
        >
          <div className="client-case-theater__window-casing" aria-hidden />
          <div className="client-case-theater__window-inner">
        <div className="agency-stats-panel client-case-theater__dossier">
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "clamp(1.05rem, 2.5vw, 1.2rem)",
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            {currentClient.scenarioTitle}
          </h2>
          <p style={{ margin: "0 0 0.75rem" }}>
            <strong>{currentClient.displayName}</strong>
            {" - "}
            {currentClient.clientKind === "corporate"
              ? "Corporate"
              : currentClient.clientKind === "small_business"
                ? "Small business"
                : "Individual"}
          </p>
          <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
            {currentClient.problem}
          </p>
          <div className="client-case-budget-block">
            <p className="client-case-budget-line">
              <span className="client-case-budget-label client-case-budget-label--this-season">Client fees this season</span>
              <span className="client-case-budget-amount">
                EUR {currentClient.budgetSeason1.toLocaleString("en-GB")}
              </span>
            </p>
            <p className="client-case-budget-line">
              <span className="client-case-budget-label client-case-budget-label--next-season">Client fees next season</span>
              <span className="client-case-budget-amount">
                EUR {currentClient.budgetSeason2.toLocaleString("en-GB")}
              </span>
            </p>
            <p className="client-case-budget-line">
              <span className="client-case-budget-label client-case-budget-label--total">Total client fees</span>
              <span className="client-case-budget-amount">EUR {currentClient.budgetTotal.toLocaleString("en-GB")}</span>
            </p>
          </div>

          {awaitingChoice ? (
            <div style={{ marginTop: "0.9rem" }}>
              <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Choose a solution</h4>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {solutionOptions.map((option) => {
                  const affordable = canAffordSolution(option, liquidForAfford, save.resources.firmCapacity);
                  const forceRejectOnly =
                    !option.isRejectOption &&
                    solutionOptions.filter((s) => !s.isRejectOption).every(
                      (s) => !canAffordSolution(s, liquidForAfford, save.resources.firmCapacity)
                    );
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="choice-card"
                      onClick={() => setPendingSolution(option)}
                      disabled={!option.isRejectOption && (forceRejectOnly || !affordable)}
                      style={{ textAlign: "left" }}
                    >
                      <h5 style={{ margin: "0 0 0.2rem", fontSize: "0.95rem" }}>{option.title}</h5>
                      <p className="muted" style={{ margin: 0 }}>
                        {option.description}
                      </p>
                      {!option.isRejectOption ? (
                        <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                          {`Spend: EUR ${option.costBudget.toLocaleString("en-GB")} · Capacity ${option.costCapacity}`}
                          {!affordable ? (
                            <span style={{ color: "var(--danger)", fontStyle: "italic" }}> · Not enough resources</span>
                          ) : null}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

          </div>
        </div>

        {notice ? <p className="client-case-theater__notice">{notice}</p> : null}
      </section>

      {pendingSolution ? (
        <div
          className="game-modal-overlay client-case-theater-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="solution-confirm-title"
        >
          <div className="game-modal client-case-theater-modal">
            {pendingSolution.isRejectOption ? (
              <>
                <p className="game-modal-kicker">Reject client</p>
                <h2 id="solution-confirm-title" style={{ marginTop: 0 }}>
                  Pass on this client?
                </h2>
                <p style={{ marginTop: 0 }}>Are you sure?</p>
              </>
            ) : (
              <>
                <p className="game-modal-kicker">Confirm campaign</p>
                <h2 id="solution-confirm-title" style={{ marginTop: 0 }}>
                  {pendingSolution.title}
                </h2>
                <p className="muted" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                  Cost for this choice:
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem 1.25rem",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span className="preseason-resource-strip__pair" title="Wealth (EUR)">
                    <ResourceSymbol id="eur" size={18} />
                    <span className="preseason-resource-strip__val">
                      {pendingSolution.costBudget.toLocaleString("en-GB")}
                    </span>
                  </span>
                  <span className="preseason-resource-strip__pair" title="Firm capacity">
                    <ResourceSymbol id="capacity" size={18} />
                    <span className="preseason-resource-strip__val">{pendingSolution.costCapacity}</span>
                  </span>
                </div>
                <p style={{ marginTop: 0 }}>Are you sure?</p>
              </>
            )}
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingSolution(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  commitSolution(pendingSolution);
                  setPendingSolution(null);
                }}
              >
                {pendingSolution.isRejectOption ? "Yes, reject" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    {breakdownMetric ? (
      <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
    ) : null}
    </>
  );
}

function StatShiftTag({ label, delta }: { label: string; delta: number }) {
  if (delta === 0) return null;
  const isBoost = delta > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
      <span className="muted">{label}</span>
      <span style={{ color: isBoost ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
        {isBoost ? `+${delta}%` : `${delta}%`} {isBoost ? "boost" : "decay"}
      </span>
    </span>
  );
}

function BuildShiftIndicator({ buildId }: { buildId: NewGamePayload["buildId"] }) {
  let reachDelta = 0;
  let effectivenessDelta = 0;
  if (buildId === "summa_cum_basement") {
    reachDelta = -5;
    effectivenessDelta = 5;
  } else if (buildId === "velvet_rolodex") {
    reachDelta = 5;
    effectivenessDelta = -5;
  }
  if (reachDelta === 0 && effectivenessDelta === 0) return null;
  return (
    <p className="muted" style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
      <StatShiftTag label="Reach" delta={reachDelta} />
      <StatShiftTag label="Effectiveness" delta={effectivenessDelta} />
    </p>
  );
}

function SimpleBwPercentBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="simple-bw-percent-bar">
      <p className="simple-bw-percent-bar__label">
        <strong>{label}:</strong> {value}%
      </p>
      <div className="simple-bw-percent-bar__track">
        <div className="simple-bw-percent-bar__fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
