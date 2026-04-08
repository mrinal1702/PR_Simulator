"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getContinuePath, loadSave } from "@/lib/saveGameStorage";

export function HomeMenu() {
  const save = useMemo(() => loadSave(), []);
  const continuePath = getContinuePath(save);
  const canContinue = !!save;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        maxWidth: "320px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <Link
        href={continuePath}
        className={`btn ${canContinue ? "btn-secondary" : "btn-secondary"}`}
        style={{
          textDecoration: "none",
          pointerEvents: canContinue ? "auto" : "none",
          opacity: canContinue ? 1 : 0.45,
        }}
        aria-disabled={!canContinue}
      >
        Continue
      </Link>
      <p className="muted" style={{ margin: "-0.35rem 0 0", fontSize: "0.8rem", textAlign: "center" }}>
        {canContinue
          ? "Continue from your current phase and season."
          : "No save yet — start a new game."}
      </p>
      <Link href="/game/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
        New game
      </Link>
    </div>
  );
}

