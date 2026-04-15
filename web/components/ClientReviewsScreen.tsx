"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { formatClientSatisfactionMood } from "@/lib/clientSatisfactionMood";
import { getEndOfPostSeasonClientReviewRows } from "@/lib/endOfSeasonClientReviews";
import { enterNextPreseason } from "@/lib/preseasonTransition";
import { loadSave, persistSave } from "@/lib/saveGameStorage";

function ReviewCard({
  scenarioTitle,
  clientDisplayName,
  reach,
  effectiveness,
  satisfaction,
}: {
  scenarioTitle: string;
  clientDisplayName: string;
  reach: number;
  effectiveness: number;
  satisfaction: number;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "0.85rem 1rem",
        textAlign: "left",
      }}
    >
      <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>{scenarioTitle}</p>
      <p className="muted" style={{ margin: "0 0 0.45rem", fontSize: "0.88rem" }}>
        {clientDisplayName}
      </p>
      <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
        Reach {reach}% · Effectiveness {effectiveness}%
      </p>
      <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
        {formatClientSatisfactionMood(clientDisplayName, satisfaction)}
      </p>
    </div>
  );
}

export function ClientReviewsScreen({ season }: { season: number }) {
  const router = useRouter();
  const save = useMemo(() => loadSave(), []);

  const rows = useMemo(() => {
    if (!save || season < 3) return [];
    return getEndOfPostSeasonClientReviewRows(save, season);
  }, [save, season]);

  const rollover = rows.filter((r) => r.source === "rollover");
  const campaigns = rows.filter((r) => r.source === "season_campaign");
  const nextPreseasonPath = `/game/preseason/${season + 1}`;

  if (!save) {
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

  if (season < 3) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted" style={{ marginBottom: "1rem" }}>
          Client reviews are shown from Season 3 post-season onward.
        </p>
        <Link href={`/game/postseason/${season}`} className="end-season-profit-btn end-season-profit-btn--secondary">
          Post-season hub
        </Link>
      </div>
    );
  }

  if (save.phase !== "postseason" || save.seasonNumber !== season) {
    return (
      <div className="end-season-profit-shell">
        <p className="end-season-profit-muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <p className="end-season-profit-muted">
          Open this screen from the Season {season} summary while you are still in post-season {season}.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={`/game/postseason/${season}`} className="end-season-profit-btn end-season-profit-btn--secondary">
            Post-season hub
          </Link>
          {save.seasonNumber >= season + 1 ? (
            <Link href={nextPreseasonPath} className="end-season-profit-btn end-season-profit-btn--primary">
              Go to Pre-season {season + 1}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const canContinue = save.phase === "postseason" && save.seasonNumber === season;

  return (
    <div className="end-season-profit-shell">
      <p className="end-season-profit-muted" style={{ marginBottom: "1.25rem" }}>
        <Link href="/">← {GAME_TITLE}</Link>
        {" · "}
        <Link href={`/game/postseason/${season}/agency-profit`}>Agency result</Link>
        {" · "}
        <Link href={`/game/postseason/${season}/summary`}>Season {season} summary</Link>
      </p>

      <div className="end-season-profit-card">
        <p className="end-season-profit-kicker">Post-season {season}</p>
        <h1 className="end-season-profit-headline" style={{ fontSize: "1.45rem" }}>
          Client reviews
        </h1>
        <p className="end-season-profit-sub">
          How clients felt after fully resolved work this season — before you head into pre-season {season + 1}.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="end-season-profit-muted" style={{ marginTop: "1.25rem" }}>
          No completed client scenarios to review for this season.
        </p>
      ) : (
        <div style={{ marginTop: "1.25rem", display: "grid", gap: "1.1rem" }}>
          {rollover.length > 0 ? (
            <section>
              <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Completed rollover scenarios
              </p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {rollover.map((r) => (
                  <ReviewCard key={`rollover-${r.clientId}`} {...r} />
                ))}
              </div>
            </section>
          ) : null}
          {campaigns.length > 0 ? (
            <section>
              <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                This season's campaigns
              </p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {campaigns.map((r) => (
                  <ReviewCard key={`campaign-${r.clientId}`} {...r} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        {canContinue ? (
          <button
            type="button"
            className="end-season-profit-btn end-season-profit-btn--primary"
            onClick={() => {
              const latest = loadSave();
              if (!latest || latest.phase !== "postseason" || latest.seasonNumber !== season) return;
              const next = enterNextPreseason(latest, season);
              persistSave(next);
              router.push(nextPreseasonPath);
            }}
          >
            Continue to Pre-season {season + 1}
          </button>
        ) : (
          <Link href={nextPreseasonPath} className="end-season-profit-btn end-season-profit-btn--primary">
            Go to Pre-season {season + 1}
          </Link>
        )}
      </div>
    </div>
  );
}
