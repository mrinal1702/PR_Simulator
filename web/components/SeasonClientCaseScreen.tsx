"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import {
  buildSolutionOptionsForClientWithScenario,
  canAffordSolution,
  resolveClientOutcome,
  type SolutionOption,
} from "@/lib/seasonClientLoop";

/**
 * Client case: opening the screen starts the engagement (Season 1 tranche credited).
 * Player picks a priced solution or “do nothing” to refund the tranche and move on.
 */
export function SeasonClientCaseScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];
  const currentClient = loop?.clientsQueue[loop.currentClientIndex] ?? null;
  const acceptedRun = currentClient
    ? loop?.runs.find((r) => r.clientId === currentClient.id && r.accepted)
    : undefined;
  const isAwaitingSolution = Boolean(
    currentClient && acceptedRun && acceptedRun.solutionId === "pending"
  );

  const solutionOptions = useMemo(
    () => (currentClient ? buildSolutionOptionsForClientWithScenario(currentClient) : []),
    [currentClient]
  );

  /** Mandatory engagement: credit Season 1 tranche when this case is opened (no separate accept/decline step). */
  useEffect(() => {
    if (!currentClient) return;
    const prev = loadSave();
    if (!prev) return;
    const loopNow = prev.seasonLoopBySeason?.[seasonKey];
    if (!loopNow) return;
    if (loopNow.runs.some((r) => r.clientId === currentClient.id)) return;

    const updated: NewGamePayload = {
      ...prev,
      seasonNumber: season,
      phase: "season",
      resources: {
        ...prev.resources,
        eur: prev.resources.eur + currentClient.budgetSeason1,
      },
      seasonLoopBySeason: {
        ...(prev.seasonLoopBySeason ?? {}),
        [seasonKey]: {
          ...loopNow,
          runs: [
            ...loopNow.runs,
            { clientId: currentClient.id, accepted: true, solutionId: "pending" as const },
          ],
        },
      },
    };
    persistSave(updated);
    setSave(updated);
  }, [season, seasonKey, currentClient?.id]);

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

  const updateLoop = (nextLoop: NonNullable<NewGamePayload["seasonLoopBySeason"]>[string]) => {
    const updated: NewGamePayload = {
      ...save,
      seasonNumber: season,
      phase: "season",
      seasonLoopBySeason: {
        ...(save.seasonLoopBySeason ?? {}),
        [seasonKey]: nextLoop,
      },
    };
    setSave(updated);
    persistSave(updated);
  };

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

  const chooseSolution = (solution: SolutionOption) => {
    if (!save || !loop || !currentClient || !acceptedRun || acceptedRun.solutionId !== "pending") return;
    if (solution.isRejectOption) {
      const updated: NewGamePayload = {
        ...save,
        resources: {
          ...save.resources,
          eur: Math.max(0, save.resources.eur - currentClient.budgetSeason1),
        },
        seasonLoopBySeason: {
          ...(save.seasonLoopBySeason ?? {}),
          [seasonKey]: {
            ...loop,
            runs: loop.runs.map((r) =>
              r.clientId === currentClient.id ? { ...r, solutionId: solution.id } : r
            ),
          },
        },
      };
      const nextRuns = updated.seasonLoopBySeason?.[seasonKey]?.runs ?? loop.runs;
      advanceToNextClient(nextRuns, updated);
      setNotice("Declined — Season 1 tranche refunded (no net change to cash). Next client.");
      return;
    }
    if (!canAffordSolution(solution, save.resources.eur, save.resources.firmCapacity)) return;
    const outcome = resolveClientOutcome({
      seed: `${save.createdAt}-${seasonKey}-${currentClient.id}-${solution.id}`,
      solution,
      visibility: save.resources.visibility,
      competence: save.resources.competence,
      discipline: currentClient.hiddenDiscipline,
      motive: currentClient.hiddenPreferenceMotive,
    });
    const updated: NewGamePayload = {
      ...save,
      resources: {
        ...save.resources,
        eur: Math.max(0, save.resources.eur - solution.costBudget),
        firmCapacity: Math.max(0, save.resources.firmCapacity - solution.costCapacity),
      },
      seasonLoopBySeason: {
        ...(save.seasonLoopBySeason ?? {}),
        [seasonKey]: {
          ...loop,
          lastOutcome: outcome,
          runs: loop.runs.map((r) =>
            r.clientId === currentClient.id ? { ...r, solutionId: solution.id, outcome } : r
          ),
        },
      },
    };
    const nextRuns = updated.seasonLoopBySeason?.[seasonKey]?.runs ?? loop.runs;
    advanceToNextClient(nextRuns, updated);
    setNotice("Solution executed.");
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

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href={`/game/season/${season}`}>← Season {season} hub</Link>
        </p>
        <h1 style={{ margin: 0 }}>Client case</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Client {Math.min(loop.currentClientIndex + 1, loop.plannedClientCount)} of {loop.plannedClientCount} this season — work in order.
        </p>
      </header>

      <section>
        <div className="agency-stats-panel">
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
            Budget total: EUR {currentClient.budgetTotal.toLocaleString("en-GB")} · Season 1 (this round): EUR{" "}
            {currentClient.budgetSeason1.toLocaleString("en-GB")} · Season 2 (follow-up): EUR{" "}
            {currentClient.budgetSeason2.toLocaleString("en-GB")}
          </p>
          {isAwaitingSolution ? (
            <p className="muted" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
              Season 1 tranche is credited to agency cash for this engagement. Execute a campaign below, or choose &quot;Do
              nothing&quot; to refund it and decline — net agency cash unchanged.
            </p>
          ) : !acceptedRun ? (
            <p className="muted" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
              Starting engagement…
            </p>
          ) : null}

          {isAwaitingSolution ? (
            <div style={{ marginTop: "0.9rem" }}>
              <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Choose a solution</h4>
              <div style={{ display: "grid", gap: "0.55rem" }}>
                {solutionOptions.map((option) => {
                  const affordable = canAffordSolution(option, save.resources.eur, save.resources.firmCapacity);
                  const forceRejectOnly =
                    !option.isRejectOption &&
                    solutionOptions.filter((s) => !s.isRejectOption).every(
                      (s) => !canAffordSolution(s, save.resources.eur, save.resources.firmCapacity)
                    );
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="choice-card"
                      onClick={() => chooseSolution(option)}
                      disabled={!option.isRejectOption && (forceRejectOnly || !affordable)}
                      style={{ textAlign: "left" }}
                    >
                      <h5 style={{ margin: "0 0 0.2rem", fontSize: "0.95rem" }}>{option.title}</h5>
                      <p className="muted" style={{ margin: 0 }}>
                        {option.description}
                      </p>
                      <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                        {option.isRejectOption
                          ? "Refunds the Season 1 tranche — net cash same as before this client."
                          : `Requires: EUR ${option.costBudget.toLocaleString("en-GB")} · Capacity ${option.costCapacity}`}
                        {!option.isRejectOption && !affordable ? " · Not enough resources" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}

        <p className="muted" style={{ marginTop: "1.25rem" }}>
          Cash: EUR {save.resources.eur.toLocaleString("en-GB")} · Capacity: {save.resources.firmCapacity}
        </p>
      </section>
    </div>
  );
}
