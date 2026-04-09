"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  acceptedRunsWithOutcomes,
  postSeasonNextRunIndex,
} from "@/lib/postSeasonResults";
import { enterNextPreseason } from "@/lib/preseasonTransition";
import {
  computeSeasonCashBridge,
  computeFutureReceivablesForLoop,
  computeSeasonPostSeasonStatGains,
  computeSeasonScenarioAverages,
  computePayrollHeadsUp,
  totalCumulativeSalaries,
} from "@/lib/seasonFinancials";
import { POST_SEASON_REACH_BOOST_COST_EUR } from "@/lib/postSeasonResults";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

export function SeasonSummaryScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [expandedScenario, setExpandedScenario] = useState<Record<string, boolean>>({});
  const [showFinancials, setShowFinancials] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];

  const cash = useMemo(
    () => (save ? computeSeasonCashBridge(save, seasonKey) : null),
    [save, seasonKey]
  );
  const statGains = useMemo(
    () => (save ? computeSeasonPostSeasonStatGains(save, seasonKey) : { reputation: 0, visibility: 0 }),
    [save, seasonKey]
  );
  const averages = useMemo(() => computeSeasonScenarioAverages(loop), [loop]);
  const futureReceivables = useMemo(() => (loop ? computeFutureReceivablesForLoop(loop) : 0), [loop]);
  const cumulativeSalaries = useMemo(() => (save ? totalCumulativeSalaries(save) : 0), [save]);
  const payrollHeadsUp = useMemo(() => (save ? computePayrollHeadsUp(save) : null), [save]);
  const acceptedForResults = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const resultsDone = acceptedForResults.length === 0 || postSeasonNextRunIndex(acceptedForResults) >= acceptedForResults.length;

  const enterNextSeason = () => {
    if (!save) return;
    if (!resultsDone) return;
    const nextSeason = Math.min(season + 1, 7);
    const next = enterNextPreseason(save, season);
    persistSave(next);
    setSave(next);
    router.push(`/game/preseason/${nextSeason}`);
  };

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

  if (!loop) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Season {season} summary</h1>
        <p className="muted">No season data for this year yet.</p>
        <Link href={`/game/postseason/${season}`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Back to post-season
        </Link>
      </div>
    );
  }

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Season {season} summary</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          High-level outcomes for this year. Financials use operating cash only (client tranches and post-season reach boosts); founder and spouse starting capital are not client revenue.
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Agency outcomes</h2>
        <p style={{ margin: "0.35rem 0" }}>
          <strong>Reputation from post-season resolutions:</strong> {statGains.reputation >= 0 ? "+" : ""}
          {statGains.reputation}
        </p>
        <p style={{ margin: "0.35rem 0" }}>
          <strong>Visibility from post-season resolutions:</strong> +{statGains.visibility}
        </p>
        {averages.count > 0 ? (
          <>
            <p className="muted" style={{ margin: "0.75rem 0 0.35rem", fontSize: "0.88rem" }}>
              Averages across accepted campaigns with outcomes ({averages.count}):
            </p>
            <p style={{ margin: "0.25rem 0" }}>
              <strong>Avg message reach:</strong> {averages.avgReach}% · <strong>Avg effectiveness:</strong> {averages.avgEffectiveness}% ·{" "}
              <strong>Avg satisfaction:</strong> {averages.avgSatisfaction}
            </p>
          </>
        ) : (
          <p className="muted" style={{ margin: "0.75rem 0 0" }}>
            No completed campaign outcomes to average (all rejected or pending).
          </p>
        )}

        {payrollHeadsUp ? (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Roster &amp; payroll (before next season)</h3>
            {payrollHeadsUp.employeeCount === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.55 }}>
                No employees on the roster — no payroll to cover for the upcoming season.
              </p>
            ) : payrollHeadsUp.canCoverPayroll ? (
              <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.55 }}>
                <strong>No layoff pressure from cash vs payroll right now:</strong> current cash ({fmtEur(payrollHeadsUp.cash)}) is at or above total payroll for the{" "}
                <strong>upcoming season</strong> ({fmtEur(payrollHeadsUp.upcomingSeasonPayroll)} for {payrollHeadsUp.employeeCount} employee
                {payrollHeadsUp.employeeCount === 1 ? "" : "s"}). Spouse or other inflows before the payroll checkpoint are not included here — if those apply, you may be safer than this line suggests.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.55 }}>
                <strong>You may need to reduce headcount (or raise cash) before next season:</strong> per payroll rules, everyone on payroll must be affordable for the{" "}
                <strong>upcoming season</strong>. Your cash ({fmtEur(payrollHeadsUp.cash)}) is{" "}
                <strong>below</strong> total payroll ({fmtEur(payrollHeadsUp.upcomingSeasonPayroll)}) — shortfall about {fmtEur(payrollHeadsUp.shortfall)}. At the payroll resolution checkpoint, the firm{" "}
                <strong>cannot retain the full roster</strong> unless cash improves or inflows (e.g. spouse grants) arrive in time. Voluntary layoffs are a separate path with severance and reputation costs when that UI exists.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Scenario overview</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          Each client in arrival order. Expand to read the full scenario brief.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setShowScenarios((v) => !v)} style={{ marginTop: "0.5rem" }}>
          {showScenarios ? "Hide scenario list" : "Scenario overview"}
        </button>
        {showScenarios ? (
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            {loop.clientsQueue.map((client) => {
              const run = loop.runs.find((r) => r.clientId === client.id);
              const expanded = expandedScenario[client.id] ?? false;
              const toggle = () => setExpandedScenario((m) => ({ ...m, [client.id]: !expanded }));
              if (!run) return null;
              const rejected = !run.accepted || run.solutionId === "reject";
              const outcome = run.outcome;
              return (
                <div
                  key={client.id}
                  style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.85rem 1rem", textAlign: "left" }}
                >
                  <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>{client.scenarioTitle}</p>
                  <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                    {client.displayName}
                  </p>
                  {!expanded ? (
                    <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
                      {client.problem.length > 160 ? `${client.problem.slice(0, 160)}…` : client.problem}
                    </p>
                  ) : (
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", lineHeight: 1.5 }}>{client.problem}</p>
                  )}
                  <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem" }} onClick={toggle}>
                    {expanded ? "Show less" : "Full scenario description"}
                  </button>
                  <p style={{ margin: "0.65rem 0 0.25rem", fontSize: "0.92rem" }}>
                    <strong>Decision:</strong>{" "}
                    {rejected ? "Rejected client" : (run.solutionTitle ?? run.solutionId)}
                  </p>
                  {!rejected && outcome ? (
                    <p className="muted" style={{ margin: "0.35rem 0", fontSize: "0.88rem" }}>
                      Reach {outcome.messageSpread}% · Effectiveness {outcome.messageEffectiveness}% · Satisfaction {outcome.satisfaction}
                    </p>
                  ) : null}
                  {run.postSeason ? (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
                      Post-season: reputation {(run.postSeason.reputationDelta ?? 0) >= 0 ? "+" : ""}
                      {run.postSeason.reputationDelta ?? 0}, visibility +{run.postSeason.visibilityGain ?? 0}
                      {run.postSeason.choice === "reach" ? ` · Reach boost (${fmtEur(POST_SEASON_REACH_BOOST_COST_EUR)} spent)` : ""}
                      {run.postSeason.choice === "effectiveness" ? " · Effectiveness boost (5 capacity)" : ""}
                      {run.postSeason.choice === "none" ? " · No boost" : ""}
                    </p>
                  ) : (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                      Post-season not yet resolved for this campaign.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Company financials</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          Operating P&amp;L style (this season) and a cash bridge. Starting capital and spouse grants are not shown here — use the agency wealth breakdown for founder and partner funding.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setShowFinancials((v) => !v)} style={{ marginTop: "0.5rem" }}>
          {showFinancials ? "Hide financials" : "Company financials"}
        </button>
        {showFinancials && cash ? (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>Operating summary (cash)</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Net receipts from client engagements</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>{fmtEur(cash.netClientReceipts)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Post-season reach boosts (cash)</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>
                    {cash.postSeasonReachSpend > 0 ? `−${fmtEur(cash.postSeasonReachSpend)}` : fmtEur(0)}
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0 0.35rem" }}>
                    <strong>Net operating cash (this season)</strong>
                  </td>
                  <td style={{ padding: "0.5rem 0 0.35rem", textAlign: "right" }}>
                    <strong>{fmtEur(cash.netOperatingCash)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: "1rem", margin: "1.25rem 0 0.5rem" }}>Cash bridge</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Opening cash (derived from this season’s flows)</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>{fmtEur(cash.openingCash)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>+ Net receipts from client engagements</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right" }}>{fmtEur(cash.netClientReceipts)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>− Post-season reach boosts</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right" }}>{fmtEur(cash.postSeasonReachSpend)}</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0 0.35rem" }}>
                    <strong>Closing cash</strong>
                  </td>
                  <td style={{ padding: "0.5rem 0 0.35rem", textAlign: "right" }}>
                    <strong>{fmtEur(cash.closingCash)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="muted" style={{ margin: "1rem 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
              <strong>Future receivables (not in P&amp;L):</strong> {fmtEur(futureReceivables)} total Season 2 tranche budget still expected from this season’s signed clients (recognized when you work it in a future season).
            </p>
            <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
              <strong>Payroll (informational):</strong> cumulative salaries paid when staff joined — {fmtEur(cumulativeSalaries)} total. See wealth breakdown for how this sits with founder and partner capital.
            </p>
          </div>
        ) : null}
      </section>

      <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          Back to post-season
        </Link>
        <button type="button" className="btn btn-secondary" onClick={enterNextSeason} disabled={!resultsDone} style={{ opacity: resultsDone ? 1 : 0.55 }}>
          Enter pre-season {Math.min(season + 1, 7)}
        </button>
        {!resultsDone ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
            Complete post-season results first, then continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}
