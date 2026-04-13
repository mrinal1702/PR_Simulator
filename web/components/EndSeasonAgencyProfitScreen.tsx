"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { computeAgencyProfitFlashcardEndOfSeason2 } from "@/lib/seasonFinancials";
import { enterNextPreseason } from "@/lib/preseasonTransition";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

export function EndSeasonAgencyProfitScreen({ season }: { season: number }) {
  const router = useRouter();
  const save = useMemo(() => loadSave(), []);
  const metrics = useMemo(() => (save ? computeAgencyProfitFlashcardEndOfSeason2(save) : null), [save]);
  const canContinueToPreseason3 =
    save != null && save.phase === "postseason" && save.seasonNumber === 2;

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

  const agencyName = save.agencyName.trim() || "Your agency";
  const playerName = save.playerName.trim() || "there";

  const isLoss = metrics.profit < 0;
  const isProfit = metrics.profit > 0;

  const profitPctLabel =
    metrics.profitMarginPct == null ? "—" : `${metrics.profitMarginPct.toFixed(2)}%`;
  const lossPctLabel =
    metrics.profitMarginPct == null
      ? null
      : `${Math.abs(metrics.profitMarginPct).toFixed(2)}%`;

  const headlineClass = isLoss ? "end-season-profit-headline end-season-profit-headline--loss" : "end-season-profit-headline";

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href={`/game/postseason/${season}/summary`}>Season {season} summary</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Operating result · Seasons 1–2</p>
        {isProfit ? (
          <p className="end-season-profit-cheer end-season-profit-cheer--pos">Congratulations {playerName}!</p>
        ) : isLoss ? (
          <p className="end-season-profit-cheer end-season-profit-cheer--neg">Buck up {playerName}!</p>
        ) : (
          <p className="end-season-profit-cheer end-season-profit-cheer--neu">Seasons 1–2 are in the books, {playerName}.</p>
        )}
        <h1 className={headlineClass}>
          {isLoss ? (
            lossPctLabel != null ? (
              <>
                {agencyName} took a{" "}
                <span className="end-season-profit-headline-pct end-season-profit-headline-pct--neg">{lossPctLabel}</span>{" "}
                loss
              </>
            ) : (
              <>{agencyName} took an operating loss</>
            )
          ) : (
            <>
              {agencyName} made <span className="end-season-profit-headline-pct">{profitPctLabel}</span> profit
            </>
          )}
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

      <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <Link href="/game/shopping-center" className="end-season-profit-btn end-season-profit-btn--secondary">
          Shopping Center
        </Link>
        {canContinueToPreseason3 ? (
          <button
            type="button"
            className="end-season-profit-btn end-season-profit-btn--primary"
            onClick={() => {
              const latest = loadSave();
              if (!latest || latest.phase !== "postseason" || latest.seasonNumber !== 2) return;
              const next = enterNextPreseason(latest, 2);
              persistSave(next);
              router.push("/game/preseason/3");
            }}
          >
            Continue
          </button>
        ) : save && save.seasonNumber >= 3 ? (
          <Link href="/game/preseason/3" className="end-season-profit-btn end-season-profit-btn--primary">
            Go to Pre-season 3
          </Link>
        ) : null}
      </div>
    </div>
  );
}
