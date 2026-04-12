"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { computeAgencyProfitFlashcardEndOfSeason2 } from "@/lib/seasonFinancials";
import { loadSave } from "@/lib/saveGameStorage";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

export function EndSeasonAgencyProfitScreen({ season }: { season: number }) {
  const save = useMemo(() => loadSave(), []);
  const metrics = useMemo(() => (save ? computeAgencyProfitFlashcardEndOfSeason2(save) : null), [save]);

  if (season !== 2) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted">This view is only available after Season 2.</p>
        <Link href={`/game/postseason/${season}/summary`} className="end-season-profit-btn end-season-profit-btn--secondary">
          Back to summary
        </Link>
      </div>
    );
  }

  if (!save || !metrics) {
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

  const pctLabel =
    metrics.profitMarginPct == null ? "—" : `${metrics.profitMarginPct.toFixed(2)}%`;
  const pctClass =
    metrics.profitMarginPct == null
      ? "end-season-profit-headline-pct"
      : metrics.profit < 0
        ? "end-season-profit-headline-pct end-season-profit-headline-pct--neg"
        : "end-season-profit-headline-pct";

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href={`/game/postseason/${season}/summary`}>Season {season} summary</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Operating result · Seasons 1–2</p>
        <h1 className="end-season-profit-headline">
          Your agency made <span className={pctClass}>{pctLabel}</span> profit
        </h1>
        <p className="end-season-profit-sub">
          Margin is profit divided by revenue, based on cash collected from client work through the end of Season 2.
        </p>

        <dl className="end-season-profit-lines">
          <div className="end-season-profit-line">
            <dt>Revenue</dt>
            <dd>{fmtEur(metrics.revenue)}</dd>
          </div>
          <div className="end-season-profit-line">
            <dt>Campaign spending</dt>
            <dd className="end-season-profit-line--cost">{fmtEur(metrics.campaignSpending)}</dd>
          </div>
          <div className="end-season-profit-line">
            <dt>Wages</dt>
            <dd className="end-season-profit-line--cost">{fmtEur(metrics.wages)}</dd>
          </div>
        </dl>

        <div className="end-season-profit-total">
          <span>Profit</span>
          <span className={metrics.profit >= 0 ? "end-season-profit-total-pos" : "end-season-profit-total-neg"}>
            {fmtEur(metrics.profit)}
          </span>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link href="/game/shopping-center" className="end-season-profit-btn end-season-profit-btn--primary">
          Shopping Center
        </Link>
      </div>
    </div>
  );
}
