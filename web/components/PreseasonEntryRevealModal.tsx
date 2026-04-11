"use client";

import type { PreseasonEntryRevealPending } from "@/lib/preseasonEntryReveal";
import { ResourceSymbol } from "@/components/resourceSymbols";

export function PreseasonEntryRevealModal({
  preseasonSeasonNumber,
  reveal,
  onDismiss,
}: {
  preseasonSeasonNumber: number;
  reveal: PreseasonEntryRevealPending;
  onDismiss: () => void;
}) {
  const g = reveal.spouseGrantStats;

  return (
    <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="preseason-reveal-title">
      <div className="game-modal" style={{ maxWidth: "32rem" }}>
        <p className="game-modal-kicker">Season rollover</p>
        <h2 id="preseason-reveal-title" style={{ marginTop: 0 }}>
          Welcome to pre-season {preseasonSeasonNumber}
        </h2>
        <p className="muted" style={{ margin: "0.5rem 0 0", lineHeight: 1.55 }}>
          Here is what changed as you left the post-season desk and opened the next chapter.
        </p>

        {reveal.spouseFlavorLine && g && (g.eur > 0 || g.competence > 0 || g.visibility > 0) ? (
          <div style={{ marginTop: "1.1rem" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "0.95rem", color: "#fbbf24" }}>Spouse support</h3>
            <p style={{ margin: 0, lineHeight: 1.55 }}>{reveal.spouseFlavorLine}</p>
            <p
              style={{
                margin: "0.55rem 0 0",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.45rem",
                fontWeight: 600,
              }}
            >
              {g.visibility > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  +{g.visibility}
                  <ResourceSymbol id="visibility" size={18} />
                  <span className="muted" style={{ fontWeight: 500 }}>
                    visibility
                  </span>
                </span>
              ) : null}
              {g.competence > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  +{g.competence}
                  <ResourceSymbol id="competence" size={18} />
                  <span className="muted" style={{ fontWeight: 500 }}>
                    competence
                  </span>
                </span>
              ) : null}
              {g.eur > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  +{g.eur.toLocaleString("en-GB")}
                  <ResourceSymbol id="eur" size={16} />
                  <span className="muted" style={{ fontWeight: 500 }}>
                    EUR
                  </span>
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {reveal.employeeCapacityChanges.length > 0 ? (
          <div style={{ marginTop: "1.1rem" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "0.95rem", color: "#fbbf24" }}>Team capacity (tenure)</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.55 }}>
              {reveal.employeeCapacityChanges.map((row) => (
                <li key={row.employeeId} style={{ marginBottom: "0.35rem" }}>
                  <strong>{row.name}</strong> increased capacity from{" "}
                  <strong>{row.before}</strong> to <strong>{row.after}</strong>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.25rem" }}>
                    <ResourceSymbol id="capacity" size={16} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onDismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
