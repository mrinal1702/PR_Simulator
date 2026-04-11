"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { getPostSeasonResolutionEntries } from "@/lib/seasonCarryover";
import { loadSave } from "@/lib/saveGameStorage";

export function ScenarioHistoryListScreen({ season }: { season: number }) {
  const save = useMemo<NewGamePayload | null>(() => loadSave(), []);
  const entries = useMemo(() => (save ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);

  if (!save) {
    return (
      <div className="shell">
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link></p>
        <h1>No save found</h1>
      </div>
    );
  }

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Scenario history</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Resolved scenarios from this season. Click any to see the full arc.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="muted">No resolved scenarios to show yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {entries.map(({ client }) => (
            <Link
              key={client.id}
              href={`/game/postseason/${season}/history/${client.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="agency-stats-panel"
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{client.scenarioTitle}</p>
                  <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.88rem" }}>
                    {client.displayName} · {client.clientKind.replace("_", " ")}
                  </p>
                </div>
                <span className="muted" style={{ fontSize: "0.9rem" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: "1.25rem" }}>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          Back to post-season
        </Link>
      </div>
    </div>
  );
}
