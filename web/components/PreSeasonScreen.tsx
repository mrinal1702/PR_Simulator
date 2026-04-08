"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_TITLE } from "@/lib/onboardingContent";
import type { NewGamePayload } from "@/components/NewGameWizard";

const SAVE_KEY = "dma-save-slot";

type Focus = "strategy_workshop" | "network";

export function PreSeasonScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => {
    try {
      const raw = sessionStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as NewGamePayload;
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState<string>("");

  const title = useMemo(() => `Pre-season ${season}`, [season]);

  const applyFocus = (focus: Focus) => {
    if (!save || save.activityFocusUsedInPreseason) return;
    const updated: NewGamePayload = {
      ...save,
      phase: "preseason",
      seasonNumber: season,
      activityFocusUsedInPreseason: true,
      resources:
        focus === "strategy_workshop"
          ? { ...save.resources, competence: save.resources.competence + 10 }
          : { ...save.resources, visibility: save.resources.visibility + 10 },
    };
    setSave(updated);
    try {
      sessionStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    } catch {
      // ignore local storage failures
    }
    setNotice(
      focus === "strategy_workshop"
        ? "Strategy workshop complete: +10 competence."
        : "Network complete: +10 visibility."
    );
  };

  if (!save) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>No active save found</h1>
        <p className="muted">Start a new game first to enter pre-season.</p>
        <Link href="/game/new" className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          New game
        </Link>
      </div>
    );
  }

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.5rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Choose one activity focus for this pre-season.
        </p>
      </header>

      <section>
        <div className="card-grid cols-2" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="choice-card"
            onClick={() => applyFocus("strategy_workshop")}
            disabled={save.activityFocusUsedInPreseason}
          >
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Strategy workshop</h3>
            <p className="muted" style={{ margin: 0 }}>Improve competence by 10</p>
          </button>
          <button
            type="button"
            className="choice-card"
            onClick={() => applyFocus("network")}
            disabled={save.activityFocusUsedInPreseason}
          >
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Network</h3>
            <p className="muted" style={{ margin: 0 }}>Improve visibility by 10</p>
          </button>
        </div>

        {notice ? <p style={{ marginTop: "1rem" }}>{notice}</p> : null}

        <div style={{ marginTop: "1.25rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            Current resources: EUR {save.resources.eur.toLocaleString("en-GB")} · Competence{" "}
            {save.resources.competence} · Visibility {save.resources.visibility} · Capacity{" "}
            {save.resources.firmCapacity} · Reputation {save.reputation ?? 5}
          </p>
        </div>
      </section>
    </div>
  );
}

