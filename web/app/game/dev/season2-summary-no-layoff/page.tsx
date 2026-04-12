"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_TITLE } from "@/lib/onboardingContent";
import { persistSave } from "@/lib/saveGameStorage";
import { buildSeason2SummaryNoLayoffSampleSave } from "@/lib/devSampleSaves";

const SAVE_KEY = "dma-save-slot";
const BACKUP_KEY = "dma-save-slot-debug-backup";

export default function DevSeason2SummaryNoLayoffPage() {
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
    const ok = persistSave(buildSeason2SummaryNoLayoffSampleSave());
    if (!ok) {
      setStatus("Could not write the sample save.");
      return;
    }
    setStatus("Sample save loaded. Redirecting to the Season 2 summary...");
    router.push("/game/postseason/2/summary");
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
        <h1 style={{ margin: 0 }}>Season 2 Summary QA Sample</h1>
        <p className="muted" style={{ marginTop: "0.5rem", lineHeight: 1.55 }}>
          This sample has no mandatory or voluntary layoff. It is set up so you can reconcile the Season 2 summary against a known set of financial decisions.
        </p>
      </header>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Financial decisions in this sample</h2>
        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>Season 1 rollover revenue paid into Season 2:</strong> EUR 37,000
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem", lineHeight: 1.55 }}>
          Bakery Backlash follow-up tranche EUR 16,000 + Conference Collapse follow-up tranche EUR 21,000.
        </p>

        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>Fresh Season 2 client fees recognized this season:</strong> EUR 83,000
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem", lineHeight: 1.55 }}>
          Gala Joke Fallout current tranche EUR 35,000 + Scooter Safety Spiral current tranche EUR 48,000.
        </p>

        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>In-season campaign cost:</strong> EUR 42,000
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem", lineHeight: 1.55 }}>
          Rollover actions: EUR 9,000 + EUR 7,000 = EUR 16,000. Fresh Season 2 solutions: EUR 12,000 + EUR 14,000 = EUR 26,000.
        </p>

        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>Post-season extra campaign cost:</strong> EUR 5,000
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem", lineHeight: 1.55 }}>
          One reach boost on a tier-1 fresh Season 2 case. The other case takes an effectiveness boost, which uses capacity and therefore does not appear in EUR cash costs.
        </p>

        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>Payroll paid at Season 2 start:</strong> EUR 16,000
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem", lineHeight: 1.55 }}>
          Leah Park EUR 9,000 + Owen Price EUR 7,000. There is no severance and no layoff in this sample.
        </p>

        <p style={{ margin: "0 0 0.5rem", lineHeight: 1.55 }}>
          <strong>Expected operating summary:</strong> Revenue EUR 120,000 − Campaign cost EUR 42,000 − Extra campaign cost EUR 5,000 = <strong>Net operating cash EUR 73,000</strong>.
        </p>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          <strong>Expected cash flow:</strong> Opening EUR 25,000 − Wages EUR 16,000 + Cash from operations EUR 73,000 = <strong>Closing EUR 82,000</strong>.
        </p>
      </section>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={loadSample}>
          Load sample and open Season 2 summary
        </button>
        <Link href="/game/postseason/2/summary" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Open summary directly
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
