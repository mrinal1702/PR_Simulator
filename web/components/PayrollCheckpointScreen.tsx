"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { fireEmployeeForPayrollShortfall } from "@/lib/employeeActions";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { computePayrollHeadsUp } from "@/lib/seasonFinancials";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

function fmtEur(value: number): string {
  return `EUR ${value.toLocaleString("en-GB")}`;
}

export function PayrollCheckpointScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");

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

  const payroll = computePayrollHeadsUp(save);
  const payrollBalance = save.resources.eur - payroll.upcomingSeasonPayroll;
  const canContinue = season >= 2 && payrollBalance >= 0;

  const fireMandatory = (employeeId: string) => {
    const res = fireEmployeeForPayrollShortfall(save, employeeId);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setSave(res.save);
    persistSave(res.save);
    setNotice("Employee laid off to resolve payroll shortfall. No severance charged.");
  };

  const sortedEmployees = useMemo(
    () => [...(save.employees ?? [])].sort((a, b) => b.salary - a.salary),
    [save.employees]
  );

  const continueToPreseason = () => {
    if (!canContinue) return;
    router.push(`/game/preseason/${season}`);
  };

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.2rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Payroll checkpoint</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          You cannot enter pre-season {season} until upcoming-season payroll is covered.
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Shortfall status</h2>
        <p style={{ margin: "0.4rem 0" }}>
          <strong>Current cash:</strong> {fmtEur(save.resources.eur)}
        </p>
        <p style={{ margin: "0.4rem 0" }}>
          <strong>Upcoming payroll:</strong> {fmtEur(payroll.upcomingSeasonPayroll)}
        </p>
        <p style={{ margin: "0.4rem 0" }}>
          <strong>Payroll balance (cash − payroll):</strong>{" "}
          <span style={{ color: payrollBalance < 0 ? "#dc2626" : "var(--text)" }}>{fmtEur(payrollBalance)}</span>
        </p>
        <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.9rem" }}>
          Mandatory layoffs here do <strong>not</strong> charge severance and do <strong>not</strong> reduce reputation.
          They still remove employee stat contributions from your agency.
        </p>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Employees</h2>
        {sortedEmployees.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No employees left on payroll.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {sortedEmployees.map((e) => (
              <div key={e.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.7rem 0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {e.name} · {e.role}
                    </p>
                    <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                      Salary: {fmtEur(e.salary)}
                      {e.visibilityGain > 0 ? ` · Visibility +${e.visibilityGain}` : ""}
                      {e.competenceGain > 0 ? ` · Competence +${e.competenceGain}` : ""}
                      {e.capacityGain > 0 ? ` · Capacity +${e.capacityGain}` : ""}
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => fireMandatory(e.id)}>
                    Mandatory layoff
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {notice ? <p style={{ marginTop: "0.8rem" }}>{notice}</p> : null}

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary" onClick={continueToPreseason} disabled={!canContinue} style={{ opacity: canContinue ? 1 : 0.55 }}>
          Continue to pre-season {season}
        </button>
      </div>
    </div>
  );
}

