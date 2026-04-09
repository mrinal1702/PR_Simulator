"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { AgencyFinanceStatsRows } from "@/components/AgencyFinanceStatsRows";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { BreakdownMetric } from "@/lib/metricBreakdown";

/** Cash + Payables + Receivables block with breakdown buttons (matches pre-season / post-season hub). */
export function AgencyFinanceSnapshot({
  save,
  onBreakdown,
  title = "Agency finances",
  /** When true, no outer panel or section title (use inside an existing “Agency snapshot” card). */
  compact = false,
}: {
  save: NewGamePayload;
  onBreakdown: (metric: BreakdownMetric) => void;
  title?: string;
  compact?: boolean;
}) {
  const inner = (
    <>
      {!compact ? (
        <h3 style={{ marginTop: 0, marginBottom: "0.65rem", fontSize: "1.05rem" }}>{title}</h3>
      ) : null}
      <p className="muted" style={{ marginTop: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ResourceSymbol id="eur" size={17} />
          <strong>Cash</strong>: EUR {save.resources.eur.toLocaleString("en-GB")}
        </span>
        {" · "}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
          onClick={() => onBreakdown("eur")}
        >
          Breakdown
        </button>
      </p>
      <AgencyFinanceStatsRows
        save={save}
        onPayables={() => onBreakdown("payables")}
        onReceivables={() => onBreakdown("receivables")}
      />
    </>
  );
  if (compact) {
    return <div style={{ marginBottom: "0.5rem" }}>{inner}</div>;
  }
  return (
    <div className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
      {inner}
    </div>
  );
}
