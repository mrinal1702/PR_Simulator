"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
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
import { AgencySnapshotCapacityRow, AgencySnapshotMetricRow } from "@/components/AgencySnapshotMetricRow";
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
import { PreseasonSalaryNegotiationModal } from "@/components/PreseasonSalaryNegotiationModal";
import {
  canAffordPayRaise,
  hasUnresolvedSalaryNegotiationV3,
  reconcileSalaryNegotiationWithRoster,
  resolveSalaryAskLeft,
  resolveSalaryAskPaid,
} from "@/lib/preseasonSalaryNegotiation";

export function PreSeasonScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [confirmStartSeason, setConfirmStartSeason] = useState(false);
  const [fireTargetId, setFireTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!save) return;
    const next = reconcileSalaryNegotiationWithRoster(save);
    if (next === save) return;
    setSave(next);
    persistSave(next);
  }, [save]);

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
    if (season === 3 && hasUnresolvedSalaryNegotiationV3(save)) {
      setNotice("Resolve pre-season 3 salary requests before starting the season.");
      return;
    }
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

  const visibilityForBands = getEffectiveVisibilityForAgency(save);
  const competenceForBands = getEffectiveCompetenceForAgency(save);

  const entryReveal = save.preseasonEntryRevealPending;
  const showEntryRevealModal = entryReveal != null && entryReveal.preseasonSeasonKey === seasonKey;

  const salaryNegotiationBlocked = season === 3 && hasUnresolvedSalaryNegotiationV3(save);
  const v3 = save.preseasonSalaryNegotiationV3;
  const firstUnresolvedAsk =
    v3 && v3.seasonKey === "3"
      ? v3.asks.find((a) => !v3.resolved[a.employeeId])
      : undefined;
  const salaryNegotiationEmployee = firstUnresolvedAsk
    ? save.employees?.find((e) => e.id === firstUnresolvedAsk.employeeId)
    : undefined;
  const showSalaryNegotiationModal =
    season === 3 &&
    salaryNegotiationBlocked &&
    firstUnresolvedAsk != null &&
    salaryNegotiationEmployee != null &&
    !showEntryRevealModal;

  const handleSalaryPay = () => {
    if (!save || !firstUnresolvedAsk || !salaryNegotiationEmployee) return;
    if (!canAffordPayRaise(save, firstUnresolvedAsk.raiseEur)) return;
    const name = salaryNegotiationEmployee.name;
    const updated = resolveSalaryAskPaid(save, firstUnresolvedAsk.employeeId, firstUnresolvedAsk.raiseEur);
    setSave(updated);
    persistSave(updated);
    setNotice(`${name} accepts the raise and stays. Loyalty, it turns out, has a price.`);
  };

  const handleSalaryLeave = () => {
    if (!save || !firstUnresolvedAsk || !salaryNegotiationEmployee) return;
    const name = salaryNegotiationEmployee.name;
    const result = fireEmployeeForPayrollShortfall(save, firstUnresolvedAsk.employeeId);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const updated = resolveSalaryAskLeft(result.save, firstUnresolvedAsk.employeeId);
    setSave(updated);
    persistSave(updated);
    setNotice(`${name} accepts the other offer and moves on. You make a note to update the hiring budget.`);
  };

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
        {salaryNegotiationBlocked && !payrollBlocked ? (
          <div className="agency-stats-panel" style={{ borderColor: "#ca8a04", marginBottom: "0.85rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.45rem", color: "#ca8a04" }}>Salary negotiations (pre-season 3)</h3>
            <p style={{ margin: 0 }}>
              Resolve each raise request before you can start the season. You can accept (if liquidity allows) or let the employee go with no severance or reputation loss.
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

            <AgencySnapshotMetricRow
              symbolId="reputation"
              label="Reputation"
              value={save.reputation ?? 5}
              bandLabel={getMetricBand("reputation", save.reputation ?? 5).label}
              color={getMetricBand("reputation", save.reputation ?? 5).color}
              percent={metricPercent("reputation", save.reputation ?? 5)}
              onBreakdown={() => setBreakdownMetric("reputation")}
            />
            <AgencySnapshotMetricRow
              symbolId="visibility"
              label="Visibility"
              value={visibilityForBands}
              bandLabel={getMetricBand("visibility", visibilityForBands).label}
              color={getMetricBand("visibility", visibilityForBands).color}
              percent={metricPercent("visibility", visibilityForBands)}
              onBreakdown={() => setBreakdownMetric("visibility")}
            />
            <AgencySnapshotMetricRow
              symbolId="competence"
              label="Competence"
              value={competenceForBands}
              bandLabel={getMetricBand("competence", competenceForBands).label}
              color={getMetricBand("competence", competenceForBands).color}
              percent={metricPercent("competence", competenceForBands)}
              onBreakdown={() => setBreakdownMetric("competence")}
            />
            <AgencySnapshotCapacityRow
              firmCapacity={save.resources.firmCapacity}
              onBreakdown={() => setBreakdownMetric("firmCapacity")}
            />
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
            disabled={payrollBlocked || salaryNegotiationBlocked}
          >
            Start season
          </button>
          {payrollBlocked || salaryNegotiationBlocked ? (
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
      {showSalaryNegotiationModal &&
      firstUnresolvedAsk &&
      salaryNegotiationEmployee ? (
        <PreseasonSalaryNegotiationModal
          employeeName={salaryNegotiationEmployee.name}
          raiseEur={firstUnresolvedAsk.raiseEur}
          currentSalary={salaryNegotiationEmployee.salary}
          liquidityEur={liquidityEur(save)}
          canAffordPay={canAffordPayRaise(save, firstUnresolvedAsk.raiseEur)}
          onPay={handleSalaryPay}
          onLeave={handleSalaryLeave}
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

