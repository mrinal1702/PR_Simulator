"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { buildShoppingCenterSampleSave } from "@/lib/devSampleSaves";
import { enterNextPreseason } from "@/lib/preseasonTransition";
import { persistSave } from "@/lib/saveGameStorage";

const SAVE_KEY = "dma-save-slot";
const BACKUP_KEY = "dma-save-slot-debug-backup";

export default function DevShoppingCenterSamplePage() {
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
    const postSeason2 = buildShoppingCenterSampleSave();
    const preseason3 = enterNextPreseason(postSeason2, 2);
    const ok = persistSave(preseason3);
    if (!ok) {
      setStatus("Could not write the sample save.");
      return;
    }
    setStatus("Sample save loaded. Redirecting to Shopping Center…");
    router.push("/game/shopping-center");
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
        <h1 style={{ margin: 0 }}>Shopping Center dev sample</h1>
        <p className="muted" style={{ marginTop: "0.5rem", lineHeight: 1.55 }}>
          Loads the same financial story as the Season 2 summary QA sample, runs the real{" "}
          <code style={{ fontSize: "0.9em" }}>enterNextPreseason(…, 2)</code> transition so you land in{" "}
          <strong>Pre-season 3</strong> with shopping unlocked, then opens the Shopping Center. Budget uses your
          Season 2 ending cash vs liquidity (values update after the transition).
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/game/postseason/2/end-season" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          ← Back
        </Link>
        <button type="button" className="btn btn-primary" onClick={loadSample}>
          Load sample and open Shopping Center
        </button>
        <Link href="/game/shopping-center" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open Shopping Center only
        </Link>
        {hasBackup ? (
          <button type="button" className="btn btn-secondary" onClick={restoreBackup}>
            Restore previous save
          </button>
        ) : null}
      </div>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </div>
  );
}
