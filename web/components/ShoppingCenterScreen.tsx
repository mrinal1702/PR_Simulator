"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getPendingReceivablesEur, liquidityEur, totalPayables } from "@/lib/payablesReceivables";
import { loadSave } from "@/lib/saveGameStorage";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

/** Shopping budget after Season 2: tighter of cash on hand vs accounting liquidity. */
export function computeShoppingBudgetEur(save: NewGamePayload): {
  cash: number;
  liquidity: number;
  budget: number;
} {
  const cash = save.resources.eur;
  const liquidity = liquidityEur(save);
  return { cash, liquidity, budget: Math.min(cash, liquidity) };
}

export function ShoppingCenterScreen() {
  const save = useMemo(() => loadSave(), []);
  const numbers = useMemo(() => (save ? computeShoppingBudgetEur(save) : null), [save]);

  if (!save || !numbers) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted">No save found.</p>
        <Link href="/game/new" className="end-season-profit-btn end-season-profit-btn--primary">
          New game
        </Link>
      </div>
    );
  }

  const receivables = getPendingReceivablesEur(save);
  const payables = totalPayables(save);

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href="/game/postseason/2/end-season">End Season</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Shopping Center</p>
        <h1 className="end-season-profit-headline" style={{ fontSize: "1.35rem" }}>
          Your budget
        </h1>
        <p className="shopping-center-budget-hero">{fmtEur(numbers.budget)}</p>
        <p className="end-season-profit-sub">
          This is the lower of your Season 2 ending cash ({fmtEur(numbers.cash)}) and Season 2 ending liquidity (
          {fmtEur(numbers.liquidity)}). Liquidity counts guaranteed receivables ({fmtEur(receivables)}) and subtracts
          payables ({fmtEur(payables)}).
        </p>
      </div>
    </div>
  );
}
