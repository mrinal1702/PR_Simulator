"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  advancePostSeasonResolutionProgress,
  carryoverSoftStatGainsFromResolution,
  getPostSeasonResolutionEntries,
  getPostSeasonResolutionProgress,
  isPostSeasonResolutionComplete,
} from "@/lib/seasonCarryover";
import { formatClientSatisfactionMood } from "@/lib/clientSatisfactionMood";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { ResourceSymbol } from "@/components/resourceSymbols";

function metricPercentGradientColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const darkRed = { r: 127, g: 29, b: 29 };
  const yellow = { r: 234, g: 179, b: 8 };
  const darkGreen = { r: 22, g: 101, b: 52 };
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = darkRed.r + (yellow.r - darkRed.r) * t;
    g = darkRed.g + (yellow.g - darkRed.g) * t;
    b = darkRed.b + (yellow.b - darkRed.b) * t;
  } else {
    const t = (p - 0.5) * 2;
    r = yellow.r + (darkGreen.r - yellow.r) * t;
    g = yellow.g + (darkGreen.g - yellow.g) * t;
    b = yellow.b + (darkGreen.b - yellow.b) * t;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function RevealMetricCard({
  visible,
  pct,
  label,
  color,
  prefersReducedMotion,
}: {
  visible: boolean;
  pct: number;
  label: string;
  color: string;
  prefersReducedMotion: boolean;
}) {
  const [fillPct, setFillPct] = useState(0);

  useEffect(() => {
    if (!visible) {
      setFillPct(0);
      return;
    }
    if (prefersReducedMotion) {
      setFillPct(Math.max(0, Math.min(100, pct)));
      return;
    }
    setFillPct(0);
    const t = window.setTimeout(() => setFillPct(Math.max(0, Math.min(100, pct))), 200);
    return () => clearTimeout(t);
  }, [visible, pct, prefersReducedMotion]);

  if (!visible) return null;

  const w = Math.max(0, Math.min(100, pct));

  return (
    <div
      className="resolution-reveal-card resolution-reveal-card--in"
      role="group"
      aria-label={`${label} ${w} percent`}
    >
      <div className="resolution-reveal-metric-row">
        <span style={{ color }}>
          {label} — {w}%
        </span>
        <div className="resolution-reveal-metric-track" aria-hidden>
          <div className="resolution-reveal-metric-fill" style={{ width: `${fillPct}%`, background: "#fafafa" }} />
        </div>
      </div>
    </div>
  );
}

function RevealCopyCard({ visible, children, role }: { visible: boolean; children: React.ReactNode; role?: "status" }) {
  if (!visible) return null;
  return (
    <div className="resolution-reveal-card resolution-reveal-card--in" role={role}>
      {children}
    </div>
  );
}

/** Season 2+ mandatory one-by-one resolution review (carryover recap; no redundant resolution text box). */
export function PostSeasonResolutionScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<"intro" | "reveal">("intro");
  const [showReach, setShowReach] = useState(false);
  const [showEff, setShowEff] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [showRep, setShowRep] = useState(false);
  const [showVis, setShowVis] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const timersRef = useRef<number[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  const entries = useMemo(() => (save ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);
  const progress = useMemo(() => (save ? getPostSeasonResolutionProgress(save, season) : 0), [save, season]);
  const done = useMemo(() => (save ? isPostSeasonResolutionComplete(save, season) : false), [save, season]);

  const total = entries.length;
  const current = !done && progress < total ? entries[progress] : null;

  const clearRevealTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const scheduleReveal = () => {
    clearRevealTimers();
    const push = (ms: number, fn: () => void) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };

    if (prefersReducedMotion) {
      setShowReach(true);
      setShowEff(true);
      setShowMood(true);
      setShowRep(true);
      setShowVis(true);
      setShowActions(true);
      return;
    }

    setShowReach(true);
    push(500, () => setShowEff(true));
    push(500 + 720, () => setShowMood(true));
    push(500 + 720 + 620, () => setShowRep(true));
    push(500 + 720 + 620 + 620, () => setShowVis(true));
    push(500 + 720 + 620 + 620 + 620, () => setShowActions(true));
  };

  useEffect(() => {
    setPhase("intro");
    setExpanded(false);
    setShowReach(false);
    setShowEff(false);
    setShowMood(false);
    setShowRep(false);
    setShowVis(false);
    setShowActions(false);
    clearRevealTimers();
  }, [progress, season, done, total]);

  useEffect(() => {
    if (phase !== "reveal" || !current) return;
    scheduleReveal();
    return () => clearRevealTimers();
  }, [phase, current?.client.id, prefersReducedMotion]);

  const handleOk = () => {
    if (!save || done) return;
    clearRevealTimers();
    const next = advancePostSeasonResolutionProgress(save, season);
    persistSave(next);
    setSave(next);
  };

  const handleContinueFromIntro = () => {
    setPhase("reveal");
  };

  if (!save) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>No save found</h1>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1>Completed scenarios</h1>
        <p className="muted">No rollover scenarios to review for this season.</p>
        <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          Back to post-season
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="shell shell-wide">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1>Completed scenarios</h1>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          All {total} scenario{total === 1 ? "" : "s"} reviewed.
        </p>
        <div className="resolution-reveal-actions">
          <Link href={`/game/postseason/${season}/history`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
            Scenario history
          </Link>
          <Link href={`/game/postseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
            Back to post-season
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const { client, run } = current;
  const s2 = run.season2CarryoverResolution!;
  const { reputationDelta, visibilityGain } = carryoverSoftStatGainsFromResolution(s2);
  const reachColor = metricPercentGradientColor(s2.messageSpread);
  const effColor = metricPercentGradientColor(s2.messageEffectiveness);
  const isLast = progress + 1 >= total;

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Completed scenarios</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {progress + 1} of {total}
        </p>
      </header>

      <AgencyResourceStrip save={save} />

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p
          className="muted"
          style={{ margin: "0 0 0.2rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {client.clientKind.replace("_", " ")}
        </p>
        <h2 style={{ margin: "0 0 0.2rem", fontSize: "1.15rem", fontFamily: "var(--font-display)" }}>{client.scenarioTitle}</h2>
        <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.9rem" }}>
          {client.displayName}
        </p>

        {!expanded ? (
          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
            {client.problem.length > 160 ? `${client.problem.slice(0, 160)}…` : client.problem}
          </p>
        ) : (
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", lineHeight: 1.55 }}>{client.problem}</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.82rem" }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
          {phase === "intro" ? (
            <button type="button" className="btn btn-primary" onClick={handleContinueFromIntro}>
              Continue
            </button>
          ) : null}
        </div>
      </section>

      {phase === "reveal" ? (
        <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
          <p className="scenario-campaign-results-kicker">Final metrics</p>
          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
            Outcome after your carry-over work on this client.
          </p>

          <RevealMetricCard
            visible={showReach}
            pct={s2.messageSpread}
            label="Reach"
            color={reachColor}
            prefersReducedMotion={prefersReducedMotion}
          />
          <RevealMetricCard
            visible={showEff}
            pct={s2.messageEffectiveness}
            label="Effectiveness"
            color={effColor}
            prefersReducedMotion={prefersReducedMotion}
          />

          <RevealCopyCard visible={showMood} role="status">
            <p style={{ margin: 0, fontSize: "0.97rem", lineHeight: 1.5 }}>
              {formatClientSatisfactionMood(client.displayName, s2.satisfaction)}
            </p>
          </RevealCopyCard>

          <RevealCopyCard visible={showRep} role="status">
            <div className="resolution-reveal-stat-line">
              <ResourceSymbol id="reputation" size={18} />
              <span style={{ fontWeight: 700, color: reputationDelta < 0 ? "#dc2626" : reputationDelta === 0 ? "#fbbf24" : "#22c55e" }}>
                {reputationDelta < 0 ? "Reputation loss" : "Reputation gain"}: {reputationDelta > 0 ? "+" : ""}
                {reputationDelta}
              </span>
            </div>
          </RevealCopyCard>

          <RevealCopyCard visible={showVis} role="status">
            <div className="resolution-reveal-stat-line">
              <ResourceSymbol id="visibility" size={18} />
              <span style={{ fontWeight: 700, color: "var(--text)" }}>
                Visibility gain: {visibilityGain >= 0 ? "+" : ""}
                {visibilityGain}
              </span>
            </div>
          </RevealCopyCard>

          {showActions ? (
            <div className="resolution-reveal-actions">
              <Link
                href={`/game/postseason/${season}/history/${client.id}`}
                className="btn btn-secondary"
                style={{ textDecoration: "none" }}
              >
                Scenario history
              </Link>
              <button type="button" className="btn btn-primary" onClick={handleOk}>
                {isLast ? "Ok — done" : "Ok — next scenario"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
