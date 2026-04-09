"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import {
  buildSolutionOptionsForClientWithScenario,
  canAffordSolution,
  getSatisfactionReachWeight,
  resolveClientOutcome,
  type SolutionOption,
} from "@/lib/seasonClientLoop";
import { computePayrollHeadsUp } from "@/lib/seasonFinancials";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { ResourceSymbol } from "@/components/resourceSymbols";

export function SeasonClientCaseScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [blockedByPayroll, setBlockedByPayroll] = useState(false);
  const [pendingSolution, setPendingSolution] = useState<SolutionOption | null>(null);

  const seasonKey = String(season);
  const payrollPaidForSeason = save?.payrollPaidBySeason?.[seasonKey] === true;
  useEffect(() => {
    if (!save || season < 2) return;
    if (payrollPaidForSeason) return;
    const payroll = computePayrollHeadsUp(save);
    setBlockedByPayroll(true);
    if (payroll.shortfall > 0) {
      router.replace(`/game/preseason/${season}/payroll`);
      return;
    }
    router.replace(`/game/preseason/${season}`);
  }, [save, season, payrollPaidForSeason, router]);

  if (blockedByPayroll) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Redirecting…</h1>
        <p className="muted">Payroll must be resolved before entering season.</p>
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
              description: "Pass on this client. No campaign runs and no budget is added.",
            }
          : o
      );
    }
    return opts;
  }, [currentClient, season]);

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
    <div className="shell shell-wide">
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

      <section>
        <div className="agency-stats-panel">
          <p
            style={{
              margin: "0 0 0.55rem",
              color: "var(--accent)",
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            Budget: EUR {currentClient.budgetTotal.toLocaleString("en-GB")}
          </p>
          <p className="muted" style={{ margin: "0 0 0.35rem" }}>
            <strong>{currentClient.scenarioTitle}</strong>
          </p>
          <p style={{ margin: "0 0 0.35rem" }}>
            <strong>{currentClient.displayName}</strong> ·{" "}
            {currentClient.clientKind === "corporate"
              ? "Corporate"
              : currentClient.clientKind === "small_business"
                ? "Small business"
                : "Individual"}
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            {currentClient.problem}
          </p>
          <p className="muted" style={{ marginTop: 0 }}>
            This phase budget: EUR{" "}
            {currentClient.budgetSeason1.toLocaleString("en-GB")} · Season 2 (follow-up): EUR{" "}
            {currentClient.budgetSeason2.toLocaleString("en-GB")}
          </p>

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
                          {!affordable ? " · Not enough resources" : ""}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}
      </section>

      {pendingSolution ? (
        <div
          className="game-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="solution-confirm-title"
        >
          <div className="game-modal">
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
  );
}
