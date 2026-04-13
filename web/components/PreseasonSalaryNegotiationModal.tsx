"use client";

type Props = {
  employeeName: string;
  /** Possessive for "… remembers {pronoun} market value" (e.g. his, her, their). */
  pronounPossessive?: string;
  raiseEur: number;
  currentSalary: number;
  liquidityEur: number;
  canAffordPay: boolean;
  onPay: () => void;
  onLeave: () => void;
};

function fmtRaise(raiseEur: number): string {
  return `EUR ${raiseEur.toLocaleString("en-GB")}`;
}

export function PreseasonSalaryNegotiationModal({
  employeeName,
  pronounPossessive = "their",
  raiseEur,
  currentSalary,
  liquidityEur,
  canAffordPay,
  onPay,
  onLeave,
}: Props) {
  const newSalary = currentSalary + raiseEur;
  const raiseLabel = fmtRaise(raiseEur);
  return (
    <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="salary-negotiation-title">
      <div className="game-modal" style={{ maxWidth: "28rem" }}>
        <p className="game-modal-kicker">Pre-season 3 · Salary</p>
        <h2 id="salary-negotiation-title" style={{ marginTop: 0 }}>
          Offer elsewhere
        </h2>
        <p style={{ margin: "0.5rem 0 0", lineHeight: 1.55 }}>
          <strong>{employeeName}</strong> has received an offer elsewhere and suddenly remembers {pronounPossessive} market value.
          They&apos;d like an extra <strong>{raiseLabel}</strong> to stay.
        </p>
        <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
          New salary would be <strong>EUR {newSalary.toLocaleString("en-GB")}</strong> (wage payable up by {raiseLabel}). Current
          liquidity: EUR {liquidityEur.toLocaleString("en-GB")}. After accepting: EUR{" "}
          {Math.max(0, liquidityEur - raiseEur).toLocaleString("en-GB")}. Letting them go has no severance or reputation penalty.
        </p>
        {!canAffordPay ? (
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.88rem", color: "#b91c1c" }}>
            You cannot afford this raise with current liquidity — use &quot;Goodbye&quot; or raise liquidity (e.g. shopping, receivables).
          </p>
        ) : null}
        <div style={{ marginTop: "1.1rem", display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onLeave}>
            Goodbye, {employeeName}
          </button>
          <button type="button" className="btn btn-primary" onClick={onPay} disabled={!canAffordPay}>
            Okay, you win
          </button>
        </div>
      </div>
    </div>
  );
}
