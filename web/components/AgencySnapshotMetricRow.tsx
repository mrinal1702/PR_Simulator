"use client";

import { ResourceSymbol, type ResourceSymbolId } from "@/components/resourceSymbols";

/** Metric bar row for expanded “Agency stats” panels: symbol beside name (matches resource strip). */
export function AgencySnapshotMetricRow({
  symbolId,
  label,
  value,
  bandLabel,
  color,
  percent,
  onBreakdown,
}: {
  symbolId: ResourceSymbolId;
  label: string;
  value: number;
  bandLabel: string;
  color: string;
  percent: number;
  onBreakdown?: () => void;
}) {
  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="agency-snapshot-stat-symbol" aria-hidden>
            <ResourceSymbol id={symbolId} size={17} />
          </span>
          <strong>{label}</strong>
        </span>
        <span
          className="muted"
          style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}
        >
          {value} · {bandLabel}
          {onBreakdown ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "0.15rem 0.45rem", fontSize: "0.78rem" }}
              onClick={onBreakdown}
            >
              Breakdown
            </button>
          ) : null}
        </span>
      </div>
      <div className="metric-track" role="presentation">
        <div className="metric-fill" style={{ width: `${percent}%`, background: color }} />
        <div className="metric-marker" style={{ left: `${percent}%` }} aria-hidden />
      </div>
    </div>
  );
}

/** Firm capacity line with symbol (optional breakdown). */
export function AgencySnapshotCapacityRow({
  firmCapacity,
  onBreakdown,
}: {
  firmCapacity: number;
  onBreakdown?: () => void;
}) {
  return (
    <p
      className="muted"
      style={{
        margin: "0.25rem 0 0",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
        <span className="agency-snapshot-stat-symbol" aria-hidden>
          <ResourceSymbol id="capacity" size={17} />
        </span>
        <strong>Capacity</strong>: {firmCapacity}
      </span>
      {onBreakdown ? (
        <>
          {" · "}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
            onClick={onBreakdown}
          >
            Breakdown
          </button>
        </>
      ) : null}
    </p>
  );
}
