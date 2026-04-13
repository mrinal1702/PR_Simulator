"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { plannedClientCountForSeason } from "@/lib/clientEconomyMath";
import { SCENARIO_POOL_EXHAUSTED_MESSAGE } from "@/lib/scenarios";
import { buildSeasonClients } from "@/lib/seasonClientLoop";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencySnapshotCapacityRow, AgencySnapshotMetricRow } from "@/components/AgencySnapshotMetricRow";
import { AgencyFinanceBreakdownHost } from "@/components/AgencyFinanceBreakdownHost";
import { AgencyFinanceSnapshot } from "@/components/AgencyFinanceSnapshot";
import { EmployeeRosterList } from "@/components/EmployeeRosterList";
import type { BreakdownMetric } from "@/lib/metricBreakdown";
import {
  applySeasonCloseCarryoverStatGains,
  getSeasonCarryoverEntries,
  getSeasonCarryoverProgress,
  isSeasonCarryoverComplete,
} from "@/lib/seasonCarryover";
import { wageLineId } from "@/lib/payablesReceivables";

/** Season hub: roll queue, stats, link into the dedicated client-case screen. */
export function SeasonHubScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [notice, setNotice] = useState("");
  const [blockedByPayroll, setBlockedByPayroll] = useState(false);
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

  const saveNow = () => {
    if (!save) return;
    const ok = persistSave(save);
    setNotice(ok ? "Progress saved." : "Could not save right now.");
  };

  const seasonKey = String(season);
  const payrollPaidForSeason = save.payrollPaidBySeason?.[seasonKey] === true;
  useEffect(() => {
    if (season < 2) return;
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

  const loop = save.seasonLoopBySeason?.[seasonKey];
  const rolloverEntries = season >= 2 ? getSeasonCarryoverEntries(save, season) : [];
  const rolloverProgress = season >= 2 ? getSeasonCarryoverProgress(save, season) : 0;
  const rolloverComplete = season < 2 || isSeasonCarryoverComplete(save, season);
  const showRolloverGate = season >= 2 && rolloverEntries.length > 0 && !rolloverComplete;
  const currentClient = loop?.clientsQueue[loop.currentClientIndex] ?? null;
  const showClientCaseLink = Boolean(
    loop && loop.currentClientIndex < loop.plannedClientCount && currentClient
  );
  /** Every queued client has a run; queue index has advanced past the last slot. */
  const seasonQueueComplete = Boolean(
    loop &&
      loop.plannedClientCount > 0 &&
      loop.currentClientIndex >= loop.plannedClientCount &&
      loop.runs.length === loop.plannedClientCount
  );

  const visibilityForBands = getEffectiveVisibilityForAgency(save);
  const competenceForBands = getEffectiveCompetenceForAgency(save);

  const continueToPostSeason = () => {
    if (!save || !seasonQueueComplete) return;
    // Rebuild wage payables for surviving full-time employees so the post-season hub,
    // results, and summary screens show the correct liquidityEur / hasLayoffPressure.
    // Interns expire at pre-season entry, so they are excluded here too.
    const rolloverWageLines = (save.employees ?? [])
      .filter((e) => e.role !== "Intern")
      .map((e) => ({ id: wageLineId(e.id), label: `${e.name} wage`, amount: e.salary }));
    const nextPostSeasonSave: NewGamePayload = {
      ...save,
      seasonNumber: season,
      phase: "postseason",
      payablesLines: rolloverWageLines,
    };
    const updated = applySeasonCloseCarryoverStatGains(nextPostSeasonSave, season);
    setSave(updated);
    persistSave(updated);
    router.push(`/game/postseason/${season}`);
  };

  const updateLoop = (nextLoop: NonNullable<NewGamePayload["seasonLoopBySeason"]>[string]) => {
    if (!save) return;
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

  const startSeasonClientRoll = () => {
    if (!save) return;
    if (loop) {
      setNotice("Client arrivals are already rolled for this season.");
      return;
    }
    const count = plannedClientCountForSeason(
      season,
      getEffectiveVisibilityForAgency(save),
      `${save.createdAt}|${save.playerName}`,
      save.seasonEntryScoresBySeason?.[seasonKey]?.vScore
    );
    let clients;
    let usedScenarioIds: string[];
    try {
      const built = buildSeasonClients(
        `${save.createdAt}-${save.playerName}`,
        season,
        count,
        {
          reputation: save.reputation ?? 5,
          visibility: getEffectiveVisibilityForAgency(save),
          competence: getEffectiveCompetenceForAgency(save),
        },
        save.usedScenarioIds ?? [],
        save.seasonEntryScoresBySeason?.[seasonKey]
      );
      clients = built.clients;
      usedScenarioIds = built.usedScenarioIds;
    } catch (e) {
      setNotice(
        e instanceof Error && e.message === SCENARIO_POOL_EXHAUSTED_MESSAGE
          ? "You have already seen every available scenario in this run."
          : "Could not roll clients right now."
      );
      return;
    }
    const updated: NewGamePayload = {
      ...save,
      seasonNumber: season,
      phase: "season",
      usedScenarioIds,
      seasonLoopBySeason: {
        ...(save.seasonLoopBySeason ?? {}),
        [seasonKey]: {
          plannedClientCount: count,
          currentClientIndex: 0,
          clientsQueue: clients,
          runs: [],
        },
      },
    };
    setSave(updated);
    persistSave(updated);
    setNotice(`Season ${season} rolled: ${count} client(s) will arrive one by one.`);
  };

  return (
    <>
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Season {season}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Roll your client list, then open each case in order.
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
          <button type="button" className="btn btn-secondary" onClick={saveNow}>
            Save
          </button>
        </div>

        {showStats ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Agency snapshot</h3>
            <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} compact />

            <AgencySnapshotMetricRow
              symbolId="reputation"
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
            />
            <AgencySnapshotMetricRow
              symbolId="visibility"
              label="Visibility"
              value={visibilityForBands}
              bandLabel={getMetricBand("visibility", visibilityForBands).label}
              color={getMetricBand("visibility", visibilityForBands).color}
              percent={metricPercent("visibility", visibilityForBands)}
            />
            <AgencySnapshotMetricRow
              symbolId="competence"
              label="Competence"
              value={competenceForBands}
              bandLabel={getMetricBand("competence", competenceForBands).label}
              color={getMetricBand("competence", competenceForBands).color}
              percent={metricPercent("competence", competenceForBands)}
            />
            <AgencySnapshotCapacityRow firmCapacity={save.resources.firmCapacity} />
          </div>
        ) : null}

        {showEmployees ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Employees</h3>
            <EmployeeRosterList employees={save.employees ?? []} />
          </div>
        ) : null}

        {showRolloverGate ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "1.05rem" }}>
              Season {season - 1} client follow-ups
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              Complete these first before rolling new Season {season} clients.
            </p>
            <p className="muted" style={{ margin: "0.4rem 0 0" }}>
              Progress: {Math.min(rolloverProgress + 1, rolloverEntries.length)} / {rolloverEntries.length}
            </p>
            <div style={{ marginTop: "0.85rem" }}>
              <Link href={`/game/season/${season}/client`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                Tackle Season {season - 1} clients
              </Link>
            </div>
          </div>
        ) : null}

        {!loop ? (
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startSeasonClientRoll}
              disabled={!rolloverComplete}
              title={!rolloverComplete ? `Finish Season ${season - 1} client follow-ups first.` : undefined}
            >
              Roll season clients
            </button>
          </div>
        ) : null}

        {loop ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "1.05rem" }}>Season client flow</h3>
            <p className="muted" style={{ margin: 0 }}>
              Clients this season: {loop.plannedClientCount} · Current:{" "}
              {Math.min(loop.currentClientIndex + 1, loop.plannedClientCount)} / {loop.plannedClientCount}
            </p>
            {showClientCaseLink ? (
              <div style={{ marginTop: "0.85rem" }}>
                <Link href={`/game/season/${season}/client`} className="btn btn-primary" style={{ textDecoration: "none" }}>
                  Open current client case
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {loop && loop.currentClientIndex >= loop.plannedClientCount && loop.plannedClientCount > 0 ? (
          <div className="agency-stats-panel" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>Season work complete</h3>
            <p className="muted" style={{ margin: 0 }}>
              {seasonQueueComplete
                ? "Every client scenario for this season is resolved. You can continue to post-season when you are ready."
                : "Finish any remaining client cases — progress may still be in progress."}
            </p>
            {seasonQueueComplete ? (
              <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-primary" onClick={continueToPostSeason}>
                  Continue to post-season
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}
      </section>
    </div>
    {breakdownMetric ? (
      <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
    ) : null}
    </>
  );
}

