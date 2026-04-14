"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { persistSave } from "@/lib/saveGameStorage";
import { buildSeason1SummarySampleSave } from "@/lib/devSampleSaves";

const SAVE_KEY = "dma-save-slot";
const BACKUP_KEY = "dma-save-slot-debug-backup-postseason1-hub";

export default function DevPostseason1HubLoaderPage() {
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
    setStatus("Sample save loaded. Opening post-season 1 hub…");
    router.push("/game/postseason/1");
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
        <h1 style={{ margin: 0 }}>Debug: Post-season 1 hub</h1>
        <p className="muted" style={{ marginTop: "0.5rem", lineHeight: 1.55 }}>
          Writes the same sample as the Season 1 summary dev page, then sends you to{" "}
          <code>/game/postseason/1</code> so you can work on the hub UI. Local QA only.
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={loadSample}>
          Load sample and open post-season 1
        </button>
        {hasBackup ? (
          <button type="button" className="btn btn-secondary" onClick={restoreBackup}>
            Restore previous save
          </button>
        ) : null}
        <Link href="/game/postseason/1" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open hub only (uses current save)
        </Link>
      </div>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </div>
  );
}
