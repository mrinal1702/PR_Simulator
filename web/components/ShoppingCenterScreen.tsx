"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type ShoppingSection = "menu" | "personal" | "hiring" | "agency";

type ShoppingItemDef = {
  id: ShoppingItemId;
  title: string;
  blurb: string;
  cost: number;
  available: boolean;
};

function ShoppingItemCard(props: {
  item: ShoppingItemDef;
  save: NonNullable<ReturnType<typeof loadSave>>;
  shoppingOpen: boolean;
  budget: number;
  onBuy: (id: ShoppingItemId) => void;
}) {
  const { item, save, shoppingOpen, budget, onBuy } = props;
  const bought = isShoppingItemPurchased(save, item.id);
  const affordable = budget >= item.cost && save.resources.eur >= item.cost;
  const canBuy = shoppingOpen && !bought && affordable;
  return (
    <div
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
          onClick={() => onBuy(item.id)}
        >
          {bought ? "Purchased" : shoppingOpen ? "Buy" : "Locked"}
        </button>
      </div>
    </div>
  );
}

function parseReturnSeason(raw: string | null): number {
  if (raw == null || raw === "") return 2;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

function ShoppingCenterScreenInner() {
  const searchParams = useSearchParams();
  const returnSeason = parseReturnSeason(searchParams.get("returnSeason"));
  const [save, setSave] = useState(() => loadSave());
  const [notice, setNotice] = useState("");
  const [pendingPurchase, setPendingPurchase] = useState<ShoppingItemId | null>(null);
  const [section, setSection] = useState<ShoppingSection>("menu");
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
  /** During post-season `returnSeason` or the following pre-season (same window as legacy Season 2 when returnSeason is 2). */
  const shoppingOpen =
    (save.phase === "postseason" && save.seasonNumber === returnSeason) ||
    (save.phase === "preseason" && save.seasonNumber === returnSeason + 1);

  const personalItems: ShoppingItemDef[] = [
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
  ];

  const hiringItems: ShoppingItemDef[] = [
    {
      id: "hr_skills_test",
      title: "HR - Skills Test",
      blurb: "Future hires are likely to be more skilled.",
      cost: SHOPPING_ITEM_COST_EUR.hr_skills_test,
      available: true,
    },
    {
      id: "hr_reference_checks",
      title: "HR - Reference Checks",
      blurb: "Future hires are likely to be more productive.",
      cost: SHOPPING_ITEM_COST_EUR.hr_reference_checks,
      available: true,
    },
  ];

  const agencyItems: ShoppingItemDef[] = [
    {
      id: "rent_office",
      title: "Rent Office",
      blurb: `${agencyName} gets a real address: permanently +10 firm reputation and your agency roster cap rises from 5 to 7.`,
      cost: SHOPPING_ITEM_COST_EUR.rent_office,
      available: true,
    },
    {
      id: "tech_overhaul",
      title: "Tech Overhaul",
      blurb: "New systems, fewer excuses. Your team starts looking suspiciously competent.",
      cost: SHOPPING_ITEM_COST_EUR.tech_overhaul,
      available: true,
    },
    {
      id: "soft_launch_buzz",
      title: "Soft Launch Buzz",
      blurb: "A quiet push through the right corners of the internet. It starts picking up.",
      cost: SHOPPING_ITEM_COST_EUR.soft_launch_buzz,
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

  const sectionTitle =
    section === "personal"
      ? "Personal"
      : section === "hiring"
        ? "Hiring"
        : section === "agency"
          ? "Agency"
          : null;

  const currentItems =
    section === "personal"
      ? personalItems
      : section === "hiring"
        ? hiringItems
        : section === "agency"
          ? agencyItems
          : [];

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href={`/game/postseason/${returnSeason}/agency-profit`}>Agency result</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Shopping Center</p>
        <h1 className="end-season-profit-headline" style={{ fontSize: "1.35rem" }}>
          Your budget
        </h1>
        <p className="shopping-center-budget-hero">{fmtEur(numbers.budget)}</p>
        <p className="end-season-profit-sub">
          This is the lower of your Season {returnSeason} ending cash ({fmtEur(numbers.cash)}) and Season {returnSeason}{" "}
          ending liquidity ({fmtEur(numbers.liquidity)}). Liquidity counts guaranteed receivables ({fmtEur(receivables)}) and
          subtracts payables ({fmtEur(payables)}).
        </p>

        {notice ? (
          <p className="end-season-profit-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            {notice}
          </p>
        ) : null}
        {!shoppingOpen ? (
          <p className="end-season-profit-sub" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Shopping Center purchases open during Season {returnSeason} post-season and stay available through Pre-season{" "}
            {returnSeason + 1}.
          </p>
        ) : null}
      </div>

      {section === "menu" ? (
        <div className="end-season-profit-card" style={{ marginTop: "0.9rem" }}>
          <p className="end-season-profit-kicker">Choose a category</p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <button
              type="button"
              className="end-season-profit-btn end-season-profit-btn--secondary"
              style={{ justifyContent: "flex-start", textAlign: "left", flexDirection: "column", alignItems: "stretch", height: "auto", padding: "0.85rem 0.95rem" }}
              onClick={() => setSection("personal")}
            >
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Personal</span>
              <span className="end-season-profit-sub" style={{ marginTop: "0.35rem", display: "block" }}>
                Time away — vacation options for you (and your spouse if you have one).
              </span>
            </button>
            <button
              type="button"
              className="end-season-profit-btn end-season-profit-btn--secondary"
              style={{ justifyContent: "flex-start", textAlign: "left", flexDirection: "column", alignItems: "stretch", height: "auto", padding: "0.85rem 0.95rem" }}
              onClick={() => setSection("hiring")}
            >
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Hiring</span>
              <span className="end-season-profit-sub" style={{ marginTop: "0.35rem", display: "block" }}>
                Invest in how future hires are screened and trained.
              </span>
            </button>
            <button
              type="button"
              className="end-season-profit-btn end-season-profit-btn--secondary"
              style={{ justifyContent: "flex-start", textAlign: "left", flexDirection: "column", alignItems: "stretch", height: "auto", padding: "0.85rem 0.95rem" }}
              onClick={() => setSection("agency")}
            >
              <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Agency</span>
              <span className="end-season-profit-sub" style={{ marginTop: "0.35rem", display: "block" }}>
                Office, systems, and visibility — upgrades for the business.
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="end-season-profit-card" style={{ marginTop: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="end-season-profit-btn end-season-profit-btn--secondary"
              onClick={() => setSection("menu")}
            >
              ← Back
            </button>
            <p className="end-season-profit-kicker" style={{ margin: 0 }}>
              {sectionTitle}
            </p>
          </div>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {currentItems
              .filter((item) => item.available)
              .map((item) => (
                <ShoppingItemCard
                  key={item.id}
                  item={item}
                  save={save}
                  shoppingOpen={shoppingOpen}
                  budget={numbers.budget}
                  onBuy={setPendingPurchase}
                />
              ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <Link
          href={`/game/postseason/${returnSeason}/agency-profit`}
          className="end-season-profit-btn end-season-profit-btn--secondary"
        >
          Back to agency result
        </Link>
        <Link
          href={`/game/postseason/${returnSeason}/summary`}
          className="end-season-profit-btn end-season-profit-btn--secondary"
        >
          Season {returnSeason} summary
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

function ShoppingCenterFallback() {
  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted">
        <Link href="/">← {GAME_TITLE}</Link>
      </p>
      <p className="end-season-profit-muted">Loading…</p>
    </div>
  );
}

export function ShoppingCenterScreen() {
  return (
    <Suspense fallback={<ShoppingCenterFallback />}>
      <ShoppingCenterScreenInner />
    </Suspense>
  );
}
