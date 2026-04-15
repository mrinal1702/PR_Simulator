"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { computeAgencyProfitFlashcardCumulativeThroughSeason } from "@/lib/seasonFinancials";
import { enterNextPreseason } from "@/lib/preseasonTransition";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

function fmtEur(n: number): string {
  return `EUR ${n.toLocaleString("en-GB")}`;
}

export function AgencyProfitFlashcardScreen({ throughSeason }: { throughSeason: number }) {
  const router = useRouter();
  const save = useMemo(() => loadSave(), []);
  const metrics = useMemo(
    () => (save ? computeAgencyProfitFlashcardCumulativeThroughSeason(save, throughSeason) : null),
    [save, throughSeason]
  );

  const rangeLabel = throughSeason <= 1 ? "Season 1" : `Seasons 1–${throughSeason}`;
  const seasonEndPhrase =
    throughSeason <= 1 ? "the end of Season 1" : `the end of Season ${throughSeason}`;

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

  if (throughSeason < 2) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted">
          Agency profit percentage is available after Season 2 onward.
        </p>
        <Link href={`/game/postseason/${throughSeason}/summary`} className="end-season-profit-btn end-season-profit-btn--secondary">
          Back to summary
        </Link>
      </div>
    );
  }

  if (save.phase !== "postseason" || save.seasonNumber !== throughSeason) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted">
          Open this screen from the Season {throughSeason} summary while you are still in post-season {throughSeason}.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={`/game/postseason/${throughSeason}`} className="end-season-profit-btn end-season-profit-btn--secondary">
            Post-season hub
          </Link>
          <Link href={`/game/postseason/${throughSeason}/summary`} className="end-season-profit-btn end-season-profit-btn--secondary">
            Season {throughSeason} summary
          </Link>
        </div>
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
    metrics.profitMarginPct == null ? null : `${Math.abs(metrics.profitMarginPct).toFixed(2)}%`;

  const headlineClass = isLoss ? "end-season-profit-headline end-season-profit-headline--loss" : "end-season-profit-headline";

  const canContinueFromHere = save.phase === "postseason" && save.seasonNumber === throughSeason;
  const nextPreseasonPath = `/game/preseason/${throughSeason + 1}`;

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href={`/game/postseason/${throughSeason}/summary`}>Season {throughSeason} summary</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Operating result · {rangeLabel}</p>
        {isProfit ? (
          <p className="end-season-profit-cheer end-season-profit-cheer--pos">Congratulations {playerName}!</p>
        ) : isLoss ? (
          <p className="end-season-profit-cheer end-season-profit-cheer--neg">Buck up {playerName}!</p>
        ) : (
          <p className="end-season-profit-cheer end-season-profit-cheer--neu">
            {throughSeason <= 1 ? `Season 1 is in the books, ${playerName}.` : `${rangeLabel} are in the books, ${playerName}.`}
          </p>
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
          Margin is profit divided by revenue, based on cash collected from client work through {seasonEndPhrase}.
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
        <Link
          href={`/game/shopping-center?returnSeason=${throughSeason}`}
          className="end-season-profit-btn end-season-profit-btn--secondary"
        >
          Shopping Center
        </Link>
        {canContinueFromHere ? (
          <button
            type="button"
            className="end-season-profit-btn end-season-profit-btn--primary"
            onClick={() => {
              const latest = loadSave();
              if (!latest || latest.phase !== "postseason" || latest.seasonNumber !== throughSeason) return;
              if (throughSeason >= 3) {
                router.push(`/game/postseason/${throughSeason}/client-reviews`);
                return;
              }
              const next = enterNextPreseason(latest, throughSeason);
              persistSave(next);
              router.push(nextPreseasonPath);
            }}
          >
            Continue
          </button>
        ) : save.seasonNumber >= throughSeason + 1 ? (
          <Link href={nextPreseasonPath} className="end-season-profit-btn end-season-profit-btn--primary">
            Go to Pre-season {throughSeason + 1}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
