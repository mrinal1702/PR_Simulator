"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { getMetricBand, metricPercent } from "@/lib/metricScales";
import { persistSave, loadSave } from "@/lib/saveGameStorage";
import { type BreakdownMetric } from "@/lib/metricBreakdown";
import { fireEmployeeForPayrollShortfall, fireEmployeeVoluntary } from "@/lib/employeeActions";
import { type EmployeeRecord } from "@/lib/tenureCapacity";
import {
  getPreseasonFocusCardCopy,
  getPreseasonFocusDeltaForSeason,
  type PreseasonFocusId,
} from "@/lib/preseasonFocus";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceStatsRows } from "@/components/AgencyFinanceStatsRows";
import { EmployeeRosterList } from "@/components/EmployeeRosterList";
import { MetricBreakdownModalBody } from "@/components/MetricBreakdownModalBody";
import { ResourceSymbol } from "@/components/resourceSymbols";
import {
  getPendingReceivablesEur,
  hasLayoffPressure,
  liquidityEur,
  settlePreseasonAndEnterSeason,
  totalPayables,
} from "@/lib/payablesReceivables";
import { PreseasonEntryRevealModal } from "@/components/PreseasonEntryRevealModal";

export function PreSeasonScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [confirmStartSeason, setConfirmStartSeason] = useState(false);
  const [fireTargetId, setFireTargetId] = useState<string | null>(null);

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
  const payrollBlocked = save != null && hasLayoffPressure(save);
  const liquidity = save ? liquidityEur(save) : 0;
  const payablesTotal = save ? totalPayables(save) : 0;
  const receivablesTotal = save ? getPendingReceivablesEur(save) : 0;

  const applyFocus = (focus: PreseasonFocusId) => {
    if (!save || alreadyUsedThisPreseason || payrollBlocked) return;
    const normalizedCounts = {
      strategy_workshop: save.preseasonFocusCounts?.strategy_workshop ?? 0,
      network: save.preseasonFocusCounts?.network ?? 0,
    };
    const normalizedActions = save.preseasonActionBySeason ?? {};
    const delta = getPreseasonFocusDeltaForSeason(season, focus, save);
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
          ? { ...save.resources, competence: save.resources.competence + delta }
          : { ...save.resources, visibility: save.resources.visibility + delta },
    };
    setSave(updated);
    persistSave(updated);
    const card = getPreseasonFocusCardCopy(season, focus, save);
    setNotice(`${card.title} complete: ${card.subtitle}.`);
  };

  const confirmFire = () => {
    if (!save || fireTargetId == null) return;
    const result = payrollBlocked
      ? fireEmployeeForPayrollShortfall(save, fireTargetId)
      : fireEmployeeVoluntary(save, fireTargetId, season);
    setFireTargetId(null);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setSave(result.save);
    persistSave(result.save);
    setNotice(
      payrollBlocked
        ? "Mandatory layoff applied (no severance). Payroll shortfall reduced."
        : "Employee let go. Severance paid; reputation took a hit."
    );
  };

  const showFireControls = season >= 2;

  const saveNow = () => {
    if (!save) return;
    const ok = persistSave(save);
    setNotice(ok ? "Progress saved." : "Could not save right now.");
  };

  const startSeason = () => {
    if (!save) return;
    if (hasLayoffPressure(save)) {
      setNotice("Liquidity is negative (cash + receivables < payables). Resolve layoffs before starting the season.");
      return;
    }
    const updated = settlePreseasonAndEnterSeason(save, seasonKey);
    setSave(updated);
    persistSave(updated);
    router.push(`/game/season/${season}`);
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

  const workshopCard = getPreseasonFocusCardCopy(season, "strategy_workshop", save);
  const networkCard = getPreseasonFocusCardCopy(season, "network", save);

  const entryReveal = save.preseasonEntryRevealPending;
  const showEntryRevealModal = entryReveal != null && entryReveal.preseasonSeasonKey === seasonKey;

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Choose one activity focus for this pre-season.
          {season >= 2
            ? " You can also manage your team from here before the season starts."
            : ""}
        </p>
      </header>

      <AgencyResourceStrip save={save} />

      <section>
        {payrollBlocked ? (
          <div className="agency-stats-panel" style={{ borderColor: "#dc2626", marginBottom: "0.85rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.45rem", color: "#dc2626" }}>
              Layoff pressure (mandatory)
            </h3>
            <p style={{ margin: 0 }}>
              Liquidity is negative — you cannot use activities, hire, or start the season until cash plus receivables covers payables.
              Remove employees with mandatory layoffs (no severance) or raise liquidity.
            </p>
            <p className="muted" style={{ margin: "0.45rem 0 0" }}>
              Cash: EUR {save.resources.eur.toLocaleString("en-GB")} · Payables: EUR {payablesTotal.toLocaleString("en-GB")} ·
              Receivables: EUR {receivablesTotal.toLocaleString("en-GB")} · Liquidity: EUR {liquidity.toLocaleString("en-GB")}
            </p>
          </div>
        ) : null}
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
            <p className="muted" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <ResourceSymbol id="eur" size={17} />
                <strong>Cash</strong>: EUR {save.resources.eur.toLocaleString("en-GB")}
              </span>
              {" · "}
              <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }} onClick={() => setBreakdownMetric("eur")}>
                Breakdown
              </button>
            </p>
            <AgencyFinanceStatsRows
              save={save}
              onPayables={() => setBreakdownMetric("payables")}
              onReceivables={() => setBreakdownMetric("receivables")}
            />

            <MetricRow
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
              onBreakdown={() => setBreakdownMetric("reputation")}
            />
            <MetricRow
              label="Visibility"
              value={save.resources.visibility}
              bandLabel={getMetricBand("visibility", save.resources.visibility).label}
              color={getMetricBand("visibility", save.resources.visibility).color}
              percent={metricPercent("visibility", save.resources.visibility)}
              onBreakdown={() => setBreakdownMetric("visibility")}
            />
            <MetricRow
              label="Competence"
              value={save.resources.competence}
              bandLabel={getMetricBand("competence", save.resources.competence).label}
              color={getMetricBand("competence", save.resources.competence).color}
              percent={metricPercent("competence", save.resources.competence)}
              onBreakdown={() => setBreakdownMetric("competence")}
            />
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              Capacity: {save.resources.firmCapacity}
              {" · "}
              <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }} onClick={() => setBreakdownMetric("firmCapacity")}>
                Breakdown
              </button>
            </p>
          </div>
        ) : null}

        {showEmployees ? (
          <div className="agency-stats-panel">
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.05rem" }}>Employees</h3>
            {!payrollBlocked && showFireControls && (save.voluntaryLayoffsBySeason?.[seasonKey] ?? 0) >= 1 ? (
              <p className="muted" style={{ margin: "0 0 0.6rem", fontSize: "0.88rem" }}>
                Voluntary layoff already used this pre-season.
              </p>
            ) : null}
            <EmployeeRosterList
              employees={save.employees ?? []}
              renderActions={(employee) => (
                <PreSeasonEmployeeActionButton
                  employee={employee}
                  season={season}
                  payrollBlocked={payrollBlocked}
                  showFireControls={showFireControls}
                  voluntaryLayoffsUsed={save.voluntaryLayoffsBySeason?.[seasonKey] ?? 0}
                  onFire={(id) => setFireTargetId(id)}
                />
              )}
              renderFooter={(employee) =>
                !payrollBlocked && showFireControls && employee.seasonHired === season ? (
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                    Cannot lay off in the same pre-season they were hired.
                  </p>
                ) : null
              }
            />
          </div>
        ) : null}

        {!alreadyUsedThisPreseason && !payrollBlocked ? (
          <div className="card-grid cols-2" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="choice-card"
              onClick={() => applyFocus("strategy_workshop")}
            >
              <h3
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "1.05rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", color: "var(--accent)" }}>
                  <ResourceSymbol id="competence" size={20} />
                </span>
                <span>{workshopCard.title}</span>
              </h3>
              <p className="muted" style={{ margin: 0 }}>{workshopCard.subtitle}</p>
            </button>
            <button
              type="button"
              className="choice-card"
              onClick={() => applyFocus("network")}
            >
              <h3
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "1.05rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", color: "var(--accent)" }}>
                  <ResourceSymbol id="visibility" size={20} />
                </span>
                <span>{networkCard.title}</span>
              </h3>
              <p className="muted" style={{ margin: 0 }}>{networkCard.subtitle}</p>
            </button>
          </div>
        ) : null}
        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setConfirmStartSeason(true)}
            disabled={payrollBlocked}
          >
            Start season
          </button>
          {payrollBlocked ? (
            <span className="btn btn-primary" style={{ opacity: 0.55 }}>
              Talent Bazaar (Hire employees)
            </span>
          ) : (
            <Link
              href={`/game/preseason/${season}/hiring`}
              className="btn btn-primary"
              style={{ textDecoration: "none" }}
            >
              Talent Bazaar (Hire employees)
            </Link>
          )}
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}
        {!notice && alreadyUsedThisPreseason ? (
          <p style={{ marginTop: "1rem" }} className="muted">
            Focus already used this pre-season:{" "}
            {existingSeasonAction === "strategy_workshop" ? "Strategy workshop" : "Network"}.
          </p>
        ) : null}
      </section>
      {breakdownMetric ? (
        <BreakdownModal
          metric={breakdownMetric}
          save={save}
          onClose={() => setBreakdownMetric(null)}
        />
      ) : null}
      {confirmStartSeason ? (
        <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Start season confirmation">
          <div className="game-modal">
            <p className="game-modal-kicker">Season transition</p>
            <h2 style={{ marginTop: 0 }}>Are you sure you want to start Season {season}?</h2>
            <p style={{ marginTop: 0 }}>You will not be able to come back to this pre-season screen.</p>
            <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              When you start, guaranteed receivables credit to cash and payables (wages, severance) settle from cash.
            </p>
            {!alreadyUsedThisPreseason ? (
              <p style={{ marginTop: 0, fontWeight: 700 }}>
                WARNING: YOU HAVE NOT PICKED A PRE-SEASON ACTIVITY.
              </p>
            ) : null}
            <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmStartSeason(false)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={startSeason}>
                Start season
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fireTargetId && save ? (
        <FireConfirmModal
          employee={save.employees?.find((e) => e.id === fireTargetId) ?? null}
          payrollBlocked={payrollBlocked}
          onCancel={() => setFireTargetId(null)}
          onConfirm={confirmFire}
        />
      ) : null}
      {showEntryRevealModal && entryReveal ? (
        <PreseasonEntryRevealModal
          preseasonSeasonNumber={season}
          reveal={entryReveal}
          onDismiss={() => {
            const { preseasonEntryRevealPending: _, ...rest } = save;
            const updated = { ...rest };
            setSave(updated);
            persistSave(updated);
          }}
        />
      ) : null}
    </div>
  );
}

function PreSeasonEmployeeActionButton({
  employee,
  season,
  payrollBlocked,
  showFireControls,
  voluntaryLayoffsUsed,
  onFire,
}: {
  employee: EmployeeRecord;
  season: number;
  payrollBlocked: boolean;
  showFireControls: boolean;
  voluntaryLayoffsUsed: number;
  onFire: (employeeId: string) => void;
}) {
  if (!showFireControls) return null;
  const canFire = payrollBlocked || (employee.seasonHired !== season && voluntaryLayoffsUsed < 1);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ fontSize: "0.82rem" }}
      disabled={!canFire}
      onClick={() => canFire && onFire(employee.id)}
    >
      {payrollBlocked ? "Mandatory layoff" : "Fire"}
    </button>
  );
}

function FireConfirmModal({
  employee,
  payrollBlocked,
  onCancel,
  onConfirm,
}: {
  employee: NonNullable<NewGamePayload["employees"]>[number] | null;
  payrollBlocked: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!employee) return null;
  const severance = Math.floor(employee.salary * 0.2);
  return (
    <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm voluntary layoff">
      <div className="game-modal">
        <p className="game-modal-kicker">{payrollBlocked ? "Mandatory payroll layoff" : "Voluntary layoff"}</p>
        <h2 style={{ marginTop: 0 }}>Let {employee.name} go?</h2>
        {payrollBlocked ? (
          <p style={{ marginTop: 0 }}>
            Payroll is not affordable. This mandatory layoff has <strong>no severance</strong> and <strong>no reputation penalty</strong>.
            Agency stats still drop by this employee&apos;s competence, visibility, and capacity contributions.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              This is a voluntary layoff: <strong>−10 reputation</strong>, and{" "}
              <strong>EUR {severance.toLocaleString("en-GB")}</strong> severance (20% of salary) moves to <strong>payables</strong> (settled when you go to season). Agency stats drop by this employee&apos;s competence, visibility, and capacity contributions.
            </p>
            <p className="muted" style={{ marginTop: 0 }}>
              You can only use one voluntary layoff per season. You cannot fire someone hired in this same pre-season.
              Their wage payable is replaced by the severance payable.
            </p>
          </>
        )}
        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Keep employee
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirm fire
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  bandLabel,
  color,
  percent,
  onBreakdown,
}: {
  label: string;
  value: number;
  bandLabel: string;
  color: string;
  percent: number;
  onBreakdown: () => void;
}) {
  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <strong>{label}</strong>
        <span className="muted" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {value} · {bandLabel}
          <button type="button" className="btn btn-secondary" style={{ padding: "0.15rem 0.45rem", fontSize: "0.78rem" }} onClick={onBreakdown}>
            Breakdown
          </button>
        </span>
      </div>
      <div className="metric-track" role="presentation">
        <div className="metric-fill" style={{ width: `${percent}%`, background: color }} />
        <div className="metric-marker" style={{ left: `${percent}%` }} aria-hidden />
      </div>
    </div>
  );
}

function BreakdownModal({
  metric,
  save,
  onClose,
}: {
  metric: BreakdownMetric;
  save: NewGamePayload;
  onClose: () => void;
}) {
  return (
    <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Metric breakdown">
      <div className="game-modal">
        <MetricBreakdownModalBody metric={metric} save={save} />
        <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

