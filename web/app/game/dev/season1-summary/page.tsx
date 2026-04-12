"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { persistSave } from "@/lib/saveGameStorage";
import { buildSeason1SummarySampleSave } from "@/lib/devSampleSaves";

const SAVE_KEY = "dma-save-slot";
const BACKUP_KEY = "dma-save-slot-debug-backup";

export default function DevSeason1SummaryLoaderPage() {
  const router = useRouter();
  const [hasBackup, setHasBackup] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasBackup(Boolean(window.localStorage.getItem(BACKUP_KEY)));
  }, []);

  const loadSample = () => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(SAVE_KEY);
    if (existing && !window.localStorage.getItem(BACKUP_KEY)) {
      window.localStorage.setItem(BACKUP_KEY, existing);
      setHasBackup(true);
    }
    const ok = persistSave(buildSeason1SummarySampleSave());
    if (!ok) {
      setStatus("Could not write the sample save.");
      return;
    }
    setStatus("Sample save loaded. Redirecting to the Season 1 summary...");
    router.push("/game/postseason/1/summary");
  };

  const restoreBackup = () => {
    if (typeof window === "undefined") return;
    const backup = window.localStorage.getItem(BACKUP_KEY);
    if (!backup) {
      setStatus("No backup save found.");
      return;
    }
    window.localStorage.setItem(SAVE_KEY, backup);
    window.sessionStorage.setItem(SAVE_KEY, backup);
    window.localStorage.removeItem(BACKUP_KEY);
    setHasBackup(false);
    setStatus("Previous save restored.");
  };

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Debug: Season 1 Summary Sample</h1>
        <p className="muted" style={{ marginTop: "0.5rem", lineHeight: 1.55 }}>
          Load a ready-made local save that opens directly on the Season 1 summary screen. This is for local QA only.
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>What this sample contains</h2>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.55 }}>
          A finished Season 1 post-season with two reviewed client campaigns, one rejected client, stored post-season boosts,
          and enough data to inspect the summary, financials, and scenario overview without replaying the season.
        </p>
      </section>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={loadSample}>
          Load sample and open summary
        </button>
        {hasBackup ? (
          <button type="button" className="btn btn-secondary" onClick={restoreBackup}>
            Restore previous save
          </button>
        ) : null}
        <Link href="/game/postseason/1/summary" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open summary directly
        </Link>
      </div>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </div>
  );
}
