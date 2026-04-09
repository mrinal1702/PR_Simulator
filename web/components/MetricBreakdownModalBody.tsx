"use client";

import {
  buildMetricBreakdown,
  formatSigned,
  metricBreakdownModalTitle,
  type BreakdownLine,
  type BreakdownMetric,
} from "@/lib/metricBreakdown";
import type { NewGamePayload } from "@/components/NewGameWizard";

export function MetricBreakdownModalBody({
  metric,
  save,
}: {
  metric: BreakdownMetric;
  save: NewGamePayload;
}) {
  const lines = buildMetricBreakdown(metric, save);
  return (
    <>
      <p className="game-modal-kicker">Agency ledger</p>
      <h2 style={{ marginTop: 0 }}>{metricBreakdownModalTitle(metric)}</h2>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {lines.map((line, i) => (
          <BreakdownLineRow key={`${line.label}-${i}`} metric={metric} line={line} />
        ))}
      </div>
    </>
  );
}

function BreakdownLineRow({ metric, line }: { metric: BreakdownMetric; line: BreakdownLine }) {
  if (line.kind === "heading") {
    return (
      <p
        style={{
          margin: "0.65rem 0 0.15rem",
          fontWeight: 700,
          fontSize: "0.95rem",
          letterSpacing: "0.03em",
          color: "var(--text-muted)",
        }}
      >
        {line.label}
      </p>
    );
  }
  const color =
    line.kind === "payablesTotal"
      ? "#f87171"
      : line.kind === "receivablesTotal"
        ? "#4ade80"
        : line.kind === "liquidity"
          ? "var(--accent)"
          : undefined;
  const weight = line.kind === "liquidity" ? 600 : undefined;
  return (
    <p style={{ margin: 0, color, fontWeight: weight }}>
      {line.label}: {formatSigned(metric, line.value)}
    </p>
  );
}
