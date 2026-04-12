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
  computeSeasonCashFlow,
  computeFutureReceivablesForLoop,
  computeSeasonPostSeasonStatGains,
  computeSeasonScenarioAverages,
} from "@/lib/seasonFinancials";
import {
  getPendingReceivablesEur,
  hasLayoffPressure,
  liquidityEur,
  totalPayables,
} from "@/lib/payablesReceivables";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { isPostSeasonResolutionComplete } from "@/lib/seasonCarryover";
import { ResourceSymbol } from "@/components/resourceSymbols";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

function accountingColor(kind: "neutral" | "danger" | "success"): string {
  if (kind === "danger") return "#dc2626";
  if (kind === "success") return "#16a34a";
  return "var(--text)";
}

/** 0% dark red → 50% yellow → 100% dark green (for reach / effectiveness display). */
function metricPercentGradientColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const darkRed = { r: 127, g: 29, b: 29 };
  const yellow = { r: 234, g: 179, b: 8 };
  const darkGreen = { r: 22, g: 101, b: 52 };
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = darkRed.r + (yellow.r - darkRed.r) * t;
    g = darkRed.g + (yellow.g - darkRed.g) * t;
    b = darkRed.b + (yellow.b - darkRed.b) * t;
  } else {
    const t = (p - 0.5) * 2;
    r = yellow.r + (darkGreen.r - yellow.r) * t;
    g = yellow.g + (darkGreen.g - yellow.g) * t;
    b = yellow.b + (darkGreen.b - yellow.b) * t;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function ScenarioMetricBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span className="scenario-summary-metric-bar" role="img" aria-label={`${w} percent`}>
      <span className="scenario-summary-metric-bar-fill" style={{ width: `${w}%`, display: "block" }} />
    </span>
  );
}

function AccountingRow({
  prefix,
  operator,
  symbol,
  label,
  amount,
  amountColor,
}: {
  prefix?: string;
  operator?: "+" | "−";
  symbol?: "payables" | "receivables";
  label?: string;
  amount: number;
  amountColor: "neutral" | "danger" | "success";
}) {
  const color = accountingColor(amountColor);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
        {prefix ? <span>{prefix}</span> : null}
        {operator ? <span style={{ color, fontWeight: 700 }}>{operator}</span> : null}
        {symbol ? (
          <span style={{ display: "inline-flex", color }} aria-hidden>
            <ResourceSymbol id={symbol} size={15} />
          </span>
        ) : null}
        {label ? <span style={{ color, fontWeight: 600 }}>{label}</span> : null}
      </div>
      <span style={{ color, fontWeight: 600 }}>{fmtEur(amount)}</span>
    </div>
  );
}

export function SeasonSummaryScreen({ season }: { season: number }) {
  const router = useRouter();
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [expandedScenario, setExpandedScenario] = useState<Record<string, boolean>>({});
  const [showFinancials, setShowFinancials] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [confirmAdvanceOpen, setConfirmAdvanceOpen] = useState(false);

  const seasonKey = String(season);
  const loop = save?.seasonLoopBySeason?.[seasonKey];

  const cash = useMemo(
    () => (save ? computeSeasonCashBridge(save, seasonKey) : null),
    [save, seasonKey]
  );
  const cashFlow = useMemo(
    () => (save ? computeSeasonCashFlow(save, seasonKey) : null),
    [save, seasonKey]
  );
  const statGains = useMemo(
    () => (save ? computeSeasonPostSeasonStatGains(save, seasonKey) : { reputation: 0, visibility: 0 }),
    [save, seasonKey]
  );
  const futureReceivables = useMemo(() => (loop ? computeFutureReceivablesForLoop(loop) : 0), [loop]);
  const acceptedForResults = useMemo(() => (loop ? acceptedRunsWithOutcomes(loop) : []), [loop]);
  const resultsDone = acceptedForResults.length === 0 || postSeasonNextRunIndex(acceptedForResults) >= acceptedForResults.length;
  const resolutionsDone = useMemo(
    () => (save && season >= 2 ? isPostSeasonResolutionComplete(save, season) : true),
    [save, season]
  );
  const summaryUnlocked = season >= 2 ? resultsDone && resolutionsDone : resultsDone;

  /** Scenario overview tab: only clients the player accepted (not rejected). */
  const scenarioOverviewRows = useMemo(() => {
    if (!loop) return [];
    return loop.clientsQueue.flatMap((client) => {
      const run = loop.runs.find((r) => r.clientId === client.id);
      if (!run || !run.accepted || run.solutionId === "reject") return [];
      return [{ client, run }];
    });
  }, [loop]);

  const averages = useMemo(() => computeSeasonScenarioAverages(loop), [loop]);
  const nextPreseasonNum = Math.min(season + 1, 7);

  const enterNextSeason = () => {
    if (!save) return;
    if (!summaryUnlocked) return;
    const next = enterNextPreseason(save, season);
    persistSave(next);
    setSave(next);
    router.push(`/game/preseason/${nextPreseasonNum}`);
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

  if (!summaryUnlocked) {
    return (
      <div className="shell shell-wide">
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1>Season {season} summary locked</h1>
        <p className="muted" style={{ lineHeight: 1.55 }}>
          Complete all required post-season reviews before opening the summary.
        </p>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          Back to post-season
        </Link>
      </div>
    );
  }

  const payables = totalPayables(save);
  const receivables = getPendingReceivablesEur(save);
  const liquidity = liquidityEur(save);
  const layoffPressure = hasLayoffPressure(save);
  const liquidityColor = !layoffPressure && liquidity >= 0 ? "#16a34a" : layoffPressure && liquidity < 0 ? "#dc2626" : "var(--text)";

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
          High-level outcomes for this year.
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Agency outcomes</h2>
        <p style={{ margin: "0.35rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <ResourceSymbol id="reputation" size={16} />
          <strong>{statGains.reputation < 0 ? "Reputation Loss" : "Reputation Gain"}:</strong>
          {" "}{statGains.reputation >= 0 ? "+" : ""}{statGains.reputation}
        </p>
        <p style={{ margin: "0.35rem 0", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <ResourceSymbol id="visibility" size={16} />
          <strong>Visibility Gain:</strong> +{statGains.visibility}
        </p>

        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Liquidity (before next pre-season)</h3>
          <p
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: "0.92rem",
              color: hasLayoffPressure(save) ? "#dc2626" : "#16a34a",
            }}
          >
            {layoffPressure ? "Layoff pressure" : "No layoff pressure"}
          </p>
          <div
            style={{
              marginTop: "0.6rem",
              display: "grid",
              gap: "0.45rem",
              fontSize: "0.92rem",
            }}
          >
            <AccountingRow
              prefix="Cash"
              amount={save.resources.eur}
              amountColor="neutral"
            />
            <AccountingRow
              operator="−"
              symbol="payables"
              label="Payables"
              amount={payables}
              amountColor="danger"
            />
            <AccountingRow
              operator="+"
              symbol="receivables"
              label="Receivables"
              amount={receivables}
              amountColor="success"
            />
            <div
              style={{
                marginTop: "0.1rem",
                paddingTop: "0.6rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "0.6rem",
                alignItems: "center",
              }}
            >
              <strong style={{ color: liquidityColor }}>Liquidity</strong>
              <strong style={{ color: liquidityColor }}>{fmtEur(liquidity)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Scenario overview</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
          Here's how your campaigns performed this season.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setShowScenarios((v) => !v)} style={{ marginTop: "0.5rem" }}>
          {showScenarios ? "Hide scenario list" : "Scenario overview"}
        </button>
        {showScenarios ? (
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            {scenarioOverviewRows.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
                No accepted campaigns this season — rejected clients are not shown here.
              </p>
            ) : null}
            {scenarioOverviewRows.map(({ client, run }) => {
                const expanded = expandedScenario[client.id] ?? false;
                const toggle = () => setExpandedScenario((m) => ({ ...m, [client.id]: !expanded }));
                const outcome = run.outcome;
                const repDelta = run.postSeason?.reputationDelta ?? 0;
                const visGain = run.postSeason?.visibilityGain ?? 0;
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
                      {expanded ? "Show less" : "Show more"}
                    </button>

                    <p style={{ margin: "0.65rem 0 0.25rem", fontSize: "0.92rem" }}>
                      <strong>Decision:</strong> {run.solutionTitle ?? run.solutionId}
                    </p>

                    <p className="scenario-campaign-results-kicker">Campaign Results</p>

                    {outcome ? (
                      <>
                        <div className="scenario-summary-metric-row">
                          <span style={{ color: metricPercentGradientColor(outcome.messageSpread) }}>
                            Reach — {outcome.messageSpread}%
                          </span>
                          <ScenarioMetricBar pct={outcome.messageSpread} />
                        </div>
                        <div className="scenario-summary-metric-row">
                          <span style={{ color: metricPercentGradientColor(outcome.messageEffectiveness) }}>
                            Effectiveness — {outcome.messageEffectiveness}%
                          </span>
                          <ScenarioMetricBar pct={outcome.messageEffectiveness} />
                        </div>
                      </>
                    ) : (
                      <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
                        No campaign outcome recorded for this run.
                      </p>
                    )}

                    {run.postSeason ? (
                      <>
                        <p
                          style={{
                            margin: "0.45rem 0 0",
                            fontSize: "0.92rem",
                            fontWeight: 600,
                            color:
                              repDelta < 0 ? "#dc2626" : repDelta === 0 ? "#fbbf24" : "#22c55e",
                          }}
                        >
                          {repDelta < 0
                            ? `Reputation Loss: ${repDelta}`
                            : `Reputation Gain: ${repDelta > 0 ? "+" : ""}${repDelta}`}
                        </p>
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
                          Visibility Gain: {visGain >= 0 ? "+" : ""}
                          {visGain}
                        </p>
                      </>
                    ) : (
                      <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.85rem" }}>
                        Post-season review not completed for this campaign.
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
          Season financial view: operating summary and cash flow.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setShowFinancials((v) => !v)} style={{ marginTop: "0.5rem" }}>
          {showFinancials ? "Hide financials" : "Company financials"}
        </button>
        {showFinancials && cash && cashFlow ? (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ fontSize: "1rem", margin: "0 0 0.5rem", color: "#fbbf24" }}>Net Operating Summary (Cash)</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Revenue</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>{fmtEur(cash.revenue)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.35rem 0", color: "#dc2626" }}>Campaign cost</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                    {cash.campaignCost > 0 ? `−${fmtEur(cash.campaignCost)}` : fmtEur(0)}
                  </td>
                </tr>
                {cash.extraCampaignCost > 0 ? (
                  <tr>
                    <td style={{ padding: "0.35rem 0", color: "#dc2626" }}>Extra campaign cost</td>
                    <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                      −{fmtEur(cash.extraCampaignCost)}
                    </td>
                  </tr>
                ) : null}
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0 0.35rem" }}>
                    <strong style={{ color: "#16a34a" }}>Net operating cash</strong>
                  </td>
                  <td style={{ padding: "0.5rem 0 0.35rem", textAlign: "right" }}>
                    <strong style={{ color: "#16a34a" }}>{fmtEur(cash.netOperatingCash)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: "1rem", margin: "1.25rem 0 0.5rem", color: "#fbbf24" }}>Cash Flow</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Opening value</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>{fmtEur(cashFlow.openingCash)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.35rem 0", color: "#dc2626" }}>Wages</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                    {cashFlow.wagesPaid > 0 ? `−${fmtEur(cashFlow.wagesPaid)}` : fmtEur(0)}
                  </td>
                </tr>
                {cashFlow.severancePaid > 0 ? (
                  <tr>
                    <td style={{ padding: "0.35rem 0" }}>Severance</td>
                    <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>
                      −{fmtEur(cashFlow.severancePaid)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ padding: "0.35rem 0" }}>Cash flow from operations</td>
                  <td style={{ padding: "0.35rem 0", textAlign: "right", fontWeight: 600 }}>
                    {fmtEur(cashFlow.cashFlowFromOperations)}
                  </td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0 0.35rem" }}>
                    <strong>Closing</strong>
                  </td>
                  <td style={{ padding: "0.5rem 0 0.35rem", textAlign: "right" }}>
                    <strong>{fmtEur(cashFlow.closingCash)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {Math.abs(cashFlow.reconciliationGap) > 1 ? (
              <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", lineHeight: 1.45 }}>
                Cash movements not shown here (for example future season tools) may explain a small gap of {fmtEur(Math.round(cashFlow.reconciliationGap))} vs this roll-up.
              </p>
            ) : null}

            <p className="muted" style={{ margin: "1rem 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
              <strong>Future receivables:</strong> {fmtEur(futureReceivables)}
            </p>
            <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
              <strong>Payables (wages &amp; other):</strong> {fmtEur(totalPayables(save))}
            </p>
          </div>
        ) : null}
      </section>

      <div style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          Back to post-season
        </Link>
        {season === 2 ? (
          <Link
            href={summaryUnlocked ? `/game/postseason/${season}/end-season` : "#"}
            className={summaryUnlocked ? "btn btn-next-hint" : "btn btn-secondary"}
            aria-disabled={!summaryUnlocked}
            style={{
              textDecoration: "none",
              opacity: summaryUnlocked ? 1 : 0.55,
              pointerEvents: summaryUnlocked ? "auto" : "none",
            }}
            onClick={(e) => {
              if (!summaryUnlocked) e.preventDefault();
            }}
          >
            End Season
          </Link>
        ) : (
          <button
            type="button"
            className={summaryUnlocked ? "btn btn-next-hint" : "btn btn-secondary"}
            onClick={() => summaryUnlocked && setConfirmAdvanceOpen(true)}
            disabled={!summaryUnlocked}
            style={{ opacity: summaryUnlocked ? 1 : 0.55 }}
          >
            Enter pre-season {nextPreseasonNum}
          </button>
        )}
        {!summaryUnlocked ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
            Complete post-season results first, then continue.
          </p>
        ) : null}
      </div>

      {confirmAdvanceOpen && season !== 2 ? (
        <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="advance-season-title">
          <div className="game-modal">
            <h2 id="advance-season-title" style={{ marginTop: 0 }}>
              Are you sure?
            </h2>
            <p style={{ margin: "0.5rem 0 0", lineHeight: 1.55 }}>
              You will leave this summary and continue to <strong>pre-season {nextPreseasonNum}</strong>. This season will be marked complete.
            </p>
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmAdvanceOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-next-hint"
                onClick={() => {
                  setConfirmAdvanceOpen(false);
                  enterNextSeason();
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
