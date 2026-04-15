"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { persistSave } from "@/lib/saveGameStorage";
import { buildSeason3PostseasonSummarySampleSave } from "@/lib/devSampleSaves";

const SAVE_KEY = "dma-save-slot";
const BACKUP_KEY = "dma-save-slot-debug-backup-postseason3-summary";

export default function DevPostseason3SummaryLoaderPage() {
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
    const ok = persistSave(buildSeason3PostseasonSummarySampleSave());
    if (!ok) {
      setStatus("Could not write the sample save.");
      return;
    }
    setStatus("Sample save loaded. Opening Season 3 summary…");
    router.push("/game/postseason/3/summary");
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
        <h1 style={{ margin: 0 }}>Debug: Post-season 3 summary</h1>
        <p className="muted" style={{ marginTop: "0.5rem", lineHeight: 1.55 }}>
          Loads a finished Season 3 post-season save (rollover resolutions acknowledged, fresh Season 3 scenarios
          reviewed) and opens <code>/game/postseason/3/summary</code>. Local QA only.
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={loadSample}>
          Load sample and open Season 3 summary
        </button>
        {hasBackup ? (
          <button type="button" className="btn btn-secondary" onClick={restoreBackup}>
            Restore previous save
          </button>
        ) : null}
        <Link href="/game/postseason/3/summary" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open summary only (uses current save)
        </Link>
      </div>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </div>
  );
}
