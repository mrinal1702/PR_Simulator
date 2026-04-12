"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  buildArcResolutionText,
  arcResolutionReachLabel,
  arcResolutionEffLabel,
} from "@/lib/postSeasonResults";
import {
  advancePostSeasonResolutionProgress,
  getPostSeasonResolutionEntries,
  getPostSeasonResolutionProgress,
  isPostSeasonResolutionComplete,
} from "@/lib/seasonCarryover";
import { getScenarioById } from "@/lib/scenarios";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";

function metricPercentGradientColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const darkRed = { r: 127, g: 29, b: 29 };
  const yellow = { r: 234, g: 179, b: 8 };
  const darkGreen = { r: 22, g: 101, b: 52 };
  let r: number, g: number, b: number;
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

function ScenarioMetricBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span className="scenario-summary-metric-bar" role="img" aria-label={`${w} percent`}>
      <span className="scenario-summary-metric-bar-fill" style={{ width: `${w}%`, display: "block" }} />
    </span>
  );
}

/** Season 2+ mandatory one-by-one resolution review screen (no boosts — arc_resolution shown). */
export function PostSeasonResolutionScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(() => (save ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);
  const progress = useMemo(() => (save ? getPostSeasonResolutionProgress(save, season) : 0), [save, season]);
  const done = useMemo(() => (save ? isPostSeasonResolutionComplete(save, season) : false), [save, season]);

  const total = entries.length;
  const current = !done && progress < total ? entries[progress] : null;

  const handleOk = () => {
    if (!save || done) return;
    const next = advancePostSeasonResolutionProgress(save, season);
    persistSave(next);
    setSave(next);
    setExpanded(false);
  };

  if (!save) {
    return (
      <div className="shell">
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link></p>
        <h1>No save found</h1>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="shell shell-wide">
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link>{" · "}<Link href={`/game/postseason/${season}`}>Post-season {season}</Link></p>
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
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link>{" · "}<Link href={`/game/postseason/${season}`}>Post-season {season}</Link></p>
        <h1>Completed scenarios</h1>
        <p className="muted" style={{ marginBottom: "1rem" }}>All {total} scenario{total === 1 ? "" : "s"} reviewed.</p>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
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
  const scenario = getScenarioById(client.scenarioId);
  const arcResolutionText = buildArcResolutionText(
    (scenario as Record<string, unknown> | undefined)?.arc_resolution,
    s2.messageSpread,
    s2.messageEffectiveness
  );
  const reachLabel = arcResolutionReachLabel(s2.messageSpread);
  const effLabel = arcResolutionEffLabel(s2.messageEffectiveness);

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
        <p className="muted" style={{ margin: "0 0 0.2rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {client.clientKind.replace("_", " ")}
        </p>
        <h2 style={{ margin: "0 0 0.2rem", fontSize: "1.15rem", fontFamily: "var(--font-display)" }}>
          {client.scenarioTitle}
        </h2>
        <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.9rem" }}>{client.displayName}</p>

        {!expanded ? (
          <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
            {client.problem.length > 160 ? `${client.problem.slice(0, 160)}…` : client.problem}
          </p>
        ) : (
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", lineHeight: 1.55 }}>{client.problem}</p>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "0.3rem 0.6rem", fontSize: "0.82rem" }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Resolution
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.97rem" }}>{arcResolutionText}</p>
        <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.82rem" }}>
          Reach: <strong>{reachLabel}</strong> ({s2.messageSpread}%) · Effectiveness: <strong>{effLabel}</strong> ({s2.messageEffectiveness}%)
        </p>
      </section>

      <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
        <p className="scenario-campaign-results-kicker">Final Metrics</p>
        <div className="scenario-summary-metric-row">
          <span style={{ color: metricPercentGradientColor(s2.messageSpread) }}>
            Reach — {s2.messageSpread}%
          </span>
          <ScenarioMetricBar pct={s2.messageSpread} />
        </div>
        <div className="scenario-summary-metric-row">
          <span style={{ color: metricPercentGradientColor(s2.messageEffectiveness) }}>
            Effectiveness — {s2.messageEffectiveness}%
          </span>
          <ScenarioMetricBar pct={s2.messageEffectiveness} />
        </div>
      </section>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link
          href={`/game/postseason/${season}/history/${client.id}`}
          className="btn btn-secondary"
          style={{ textDecoration: "none" }}
        >
          Scenario history
        </Link>
        <button type="button" className="btn btn-primary" onClick={handleOk}>
          {progress + 1 < total ? "OK — next scenario" : "OK — done"}
        </button>
      </div>
    </div>
  );
}
