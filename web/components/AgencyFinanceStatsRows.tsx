"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { ResourceSymbol } from "@/components/resourceSymbols";
import { getPendingReceivablesEur, totalPayables } from "@/lib/payablesReceivables";

/** Payables + Receivables rows with icons, full labels, colored amounts, and breakdown buttons. */
export function AgencyFinanceStatsRows({
  save,
  onPayables,
  onReceivables,
}: {
  save: NewGamePayload;
  onPayables: () => void;
  onReceivables: () => void;
}) {
  const p = totalPayables(save);
  const r = getPendingReceivablesEur(save);
  return (
    <>
      <p
        className="muted"
        style={{
          marginTop: "0.65rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.35rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ResourceSymbol id="payables" size={17} />
          <strong>Payables</strong>
          <span style={{ color: "#f87171", fontWeight: 600 }}>EUR {p.toLocaleString("en-GB")}</span>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
          onClick={onPayables}
        >
          Breakdown
        </button>
      </p>
      <p
        className="muted"
        style={{
          marginTop: "0.35rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.35rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ResourceSymbol id="receivables" size={17} />
          <strong>Receivables</strong>
          <span style={{ color: "#4ade80", fontWeight: 600 }}>EUR {r.toLocaleString("en-GB")}</span>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}
          onClick={onReceivables}
        >
          Breakdown
        </button>
      </p>
    </>
  );
}
