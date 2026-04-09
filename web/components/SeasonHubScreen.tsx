"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { plannedClientCountForSeason } from "@/lib/clientEconomyMath";
import { SCENARIO_POOL_EXHAUSTED_MESSAGE } from "@/lib/scenarios";
import { buildSeasonClients } from "@/lib/seasonClientLoop";
import { computePayrollHeadsUp } from "@/lib/seasonFinancials";

/** Season hub: roll queue, stats, link into the dedicated client-case screen. */
export function SeasonHubScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [notice, setNotice] = useState("");
  const [blockedByPayroll, setBlockedByPayroll] = useState(false);

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

  const loop = save.seasonLoopBySeason?.[seasonKey];
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

  const continueToPostSeason = () => {
    if (!save || !seasonQueueComplete) return;
    const updated: NewGamePayload = {
      ...save,
      seasonNumber: season,
      phase: "postseason",
    };
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
    const count = plannedClientCountForSeason(season, save.resources.visibility, `${save.createdAt}|${save.playerName}`);
    let clients;
    let usedScenarioIds: string[];
    try {
      const built = buildSeasonClients(
        `${save.createdAt}-${save.playerName}`,
        season,
        count,
        {
          reputation: save.reputation ?? 5,
          visibility: save.resources.visibility,
        },
        save.usedScenarioIds ?? []
      );
      clients = built.clients;
      usedScenarioIds = built.usedScenarioIds;
    } catch (e) {
      setNotice(
        e instanceof Error && e.message === SCENARIO_POOL_EXHAUSTED_MESSAGE
          ? "Cannot roll: you've already seen every scenario this playthrough. Finish the run or add more scenarios in a future update."
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
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Season {season}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Hub: roll your client queue, then open each case in order.
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
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              Capacity: {save.resources.firmCapacity}
            </p>
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

        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={startSeasonClientRoll}>
            Roll season clients
          </button>
        </div>

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
