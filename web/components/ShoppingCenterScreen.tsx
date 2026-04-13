"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getPendingReceivablesEur, totalPayables } from "@/lib/payablesReceivables";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import {
  applyShoppingPurchase,
  getShoppingBudgetEur,
  isShoppingItemPurchased,
  SHOPPING_ITEM_COST_EUR,
  type ShoppingItemId,
} from "@/lib/shoppingCenter";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

export function ShoppingCenterScreen() {
  const [save, setSave] = useState(() => loadSave());
  const [notice, setNotice] = useState("");
  const [pendingPurchase, setPendingPurchase] = useState<ShoppingItemId | null>(null);
  const numbers = useMemo(() => (save ? getShoppingBudgetEur(save) : null), [save]);

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
  const spousePronoun =
    save.spouseGender === "male" ? "he" : save.spouseGender === "female" ? "she" : "they";
  const agencyName = save.agencyName.trim() || "Your agency";
  const spouseName = save.spouseName?.trim() || "Your spouse";
  const shoppingOpen = save.phase === "preseason" && save.seasonNumber === 3;

  const items: Array<{
    id: ShoppingItemId;
    title: string;
    blurb: string;
    cost: number;
    available: boolean;
  }> = [
    save.spouseType === "none"
      ? {
          id: "vacation_solo",
          title: "Go on vacation",
          blurb: "You unplug. The world survives. You come back sharper.",
          cost: SHOPPING_ITEM_COST_EUR.vacation_solo,
          available: true,
        }
      : {
          id: "vacation_with_spouse",
          title: "Go on vacation with spouse",
          blurb: `You log off. ${spouseName} remembers why ${spousePronoun} married you.`,
          cost: SHOPPING_ITEM_COST_EUR.vacation_with_spouse,
          available: true,
        },
    {
      id: "rent_office",
      title: "Rent Office",
      blurb: `${agencyName} gets a door, a desk, and a little more credibility.`,
      cost: SHOPPING_ITEM_COST_EUR.rent_office,
      available: true,
    },
    {
      id: "hr_skills_test",
      title: "HR - Skills Test",
      blurb: "Future hires get +15% skill, and hiring labels reflect the improved score.",
      cost: SHOPPING_ITEM_COST_EUR.hr_skills_test,
      available: true,
    },
    {
      id: "hr_reference_checks",
      title: "HR - Reference Checks",
      blurb: "Future hires get +15% productivity, and hiring labels reflect the improved score.",
      cost: SHOPPING_ITEM_COST_EUR.hr_reference_checks,
      available: true,
    },
  ];

  const confirmPurchase = () => {
    if (!pendingPurchase) return;
    const res = applyShoppingPurchase(save, pendingPurchase);
    if (!res.ok) {
      setNotice(res.error);
      setPendingPurchase(null);
      return;
    }
    setSave(res.save);
    persistSave(res.save);
    setNotice(res.message ?? "Purchase completed.");
    setPendingPurchase(null);
  };

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

        {notice ? (
          <p className="end-season-profit-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            {notice}
          </p>
        ) : null}
        {!shoppingOpen ? (
          <p className="end-season-profit-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Shopping Center purchases unlock in Pre-season 3.
          </p>
        ) : null}
      </div>

      <div className="end-season-profit-card" style={{ marginTop: "0.9rem" }}>
        <p className="end-season-profit-kicker">Options</p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {items
            .filter((item) => item.available)
            .map((item) => {
              const bought = isShoppingItemPurchased(save, item.id);
              const affordable = numbers.budget >= item.cost && save.resources.eur >= item.cost;
              const canBuy = shoppingOpen && !bought && affordable;
              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "0.85rem 0.95rem",
                    background: "#fff",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700 }}>{item.title}</p>
                  <p className="end-season-profit-sub" style={{ margin: "0.35rem 0 0.5rem" }}>
                    {item.blurb}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.65rem" }}>
                    <span style={{ fontWeight: 700 }}>Cost: {fmtEur(item.cost)}</span>
                    <button
                      type="button"
                      className="end-season-profit-btn end-season-profit-btn--primary"
                      disabled={!canBuy}
                      style={{ opacity: canBuy ? 1 : 0.55 }}
                      onClick={() => setPendingPurchase(item.id)}
                    >
                      {bought ? "Purchased" : shoppingOpen ? "Buy" : "Locked"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <Link href="/game/postseason/2/end-season" className="end-season-profit-btn end-season-profit-btn--secondary">
          Back
        </Link>
      </div>

      {pendingPurchase ? (
        <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm purchase">
          <div className="game-modal">
            <p className="game-modal-kicker">Are you sure?</p>
            <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>
              Confirm purchase for {fmtEur(SHOPPING_ITEM_COST_EUR[pendingPurchase])}?
            </h2>
            <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingPurchase(null)}>
                No
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmPurchase}>
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
