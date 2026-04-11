"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  buildArc1Text,
  buildArcResolutionText,
  buildPostSeasonArcBlurb,
} from "@/lib/postSeasonResults";
import { getPostSeasonResolutionEntries } from "@/lib/seasonCarryover";
import { getScenarioById } from "@/lib/scenarios";
import { loadSave } from "@/lib/saveGameStorage";

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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="agency-stats-panel" style={{ marginBottom: "1rem" }}>
      <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </p>
      {children}
    </section>
  );
}

function MetricRows({ reach, effectiveness }: { reach: number; effectiveness: number }) {
  return (
    <>
      <div className="scenario-summary-metric-row" style={{ marginTop: "0.5rem" }}>
        <span style={{ color: metricPercentGradientColor(reach) }}>Reach — {reach}%</span>
        <ScenarioMetricBar pct={reach} />
      </div>
      <div className="scenario-summary-metric-row">
        <span style={{ color: metricPercentGradientColor(effectiveness) }}>Effectiveness — {effectiveness}%</span>
        <ScenarioMetricBar pct={effectiveness} />
      </div>
    </>
  );
}

function s2SolutionLabel(solutionId: string): string {
  switch (solutionId) {
    case "solution_1": return "Minimal intervention";
    case "solution_2": return "Effectiveness-focused follow-up";
    case "solution_3": return "Reach-focused follow-up";
    case "solution_4": return "Full reinvestment";
    case "reject":
    case "pending": return "No further action taken";
    default: return solutionId;
  }
}

export function ScenarioHistoryDetailScreen({ season, clientId }: { season: number; clientId: string }) {
  const save = useMemo<NewGamePayload | null>(() => loadSave(), []);
  const entries = useMemo(() => (save ? getPostSeasonResolutionEntries(save, season) : []), [save, season]);
  const entry = useMemo(() => entries.find((e) => e.client.id === clientId), [entries, clientId]);

  if (!save) {
    return (
      <div className="shell">
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link></p>
        <h1>No save found</h1>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="shell shell-wide">
        <p className="muted"><Link href="/">← {GAME_TITLE}</Link>{" · "}<Link href={`/game/postseason/${season}`}>Post-season {season}</Link></p>
        <h1>Scenario not found</h1>
        <p className="muted">This scenario may not be part of the current season's rollover.</p>
        <Link href={`/game/postseason/${season}/resolutions`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Back
        </Link>
      </div>
    );
  }

  const { client, run } = entry;
  const s2 = run.season2CarryoverResolution!;
  const scenario = getScenarioById(client.scenarioId);
  const rawScenario = scenario as Record<string, unknown> | undefined;

  // S1 initial metrics (pre-boost, used for arc_1 and arc_2 key selection)
  const s1InitialReach = run.outcome.messageSpread;
  const s1InitialEff = run.outcome.messageEffectiveness;

  // S1 final metrics (post-boost, shown as midway metrics)
  const s1FinalReach = run.postSeason?.reachPercent ?? s1InitialReach;
  const s1FinalEff = run.postSeason?.effectivenessPercent ?? s1InitialEff;
  const s1RepDelta = run.postSeason?.reputationDelta ?? 0;
  const s1VisGain = run.postSeason?.visibilityGain ?? 0;
  const s1BoostChoice = run.postSeason?.choice ?? "none";

  // Arc texts
  const arc1Text = buildArc1Text(rawScenario?.arc_1, s1InitialReach, s1InitialEff);
  const arc2Text = buildPostSeasonArcBlurb(client, s1InitialReach, s1InitialEff);
  const arcResText = buildArcResolutionText(rawScenario?.arc_resolution, s2.messageSpread, s2.messageEffectiveness);

  return (
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.25rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}`}>Post-season {season}</Link>
          {" · "}
          <Link href={`/game/postseason/${season}/history`}>Scenario history</Link>
        </p>
        <h1 style={{ margin: 0 }}>{client.scenarioTitle}</h1>
        <p className="muted" style={{ marginTop: "0.4rem" }}>{client.displayName} · {client.clientKind.replace("_", " ")}</p>
      </header>

      {/* Full scenario brief */}
      <Section label="The situation">
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.95rem" }}>{client.problem}</p>
      </Section>

      {/* Season 1 solution */}
      <Section label="Your solution">
        <p style={{ margin: 0, fontWeight: 600 }}>{run.solutionTitle ?? run.solutionId}</p>
      </Section>

      {/* What happened in Season 1 (arc_1) */}
      {arc1Text ? (
        <Section label="What happened">
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.95rem" }}>{arc1Text}</p>
        </Section>
      ) : null}

      {/* Midway metrics (Season 1 final, after any boost) */}
      <Section label="Midseason checkpoint">
        <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.86rem" }}>
          Season 1 outcomes{s1BoostChoice !== "none" ? ` — you boosted ${s1BoostChoice}` : " — no boost taken"}.
        </p>
        <MetricRows reach={s1FinalReach} effectiveness={s1FinalEff} />
        <div style={{ marginTop: "0.6rem", display: "flex", gap: "1.25rem" }}>
          <p style={{
            margin: 0,
            fontSize: "0.92rem",
            fontWeight: 600,
            color: s1RepDelta < 0 ? "#dc2626" : s1RepDelta === 0 ? "#fbbf24" : "#22c55e",
          }}>
            {s1RepDelta < 0 ? `Reputation Loss: ${s1RepDelta}` : `Reputation Gain: ${s1RepDelta > 0 ? "+" : ""}${s1RepDelta}`}
          </p>
          <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "var(--text)" }}>
            Visibility Gain: +{s1VisGain}
          </p>
        </div>
      </Section>

      {/* Season 2 arc (arc_2 — what the player saw in S1 post-season) */}
      {arc2Text ? (
        <Section label="How it played out">
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.95rem" }}>{arc2Text}</p>
        </Section>
      ) : null}

      {/* Season 2 action */}
      <Section label="What you did next">
        <p style={{ margin: 0, fontWeight: 600 }}>{s2SolutionLabel(s2.solutionId)}</p>
      </Section>

      {/* Final resolution (arc_resolution) */}
      <Section label="Final resolution">
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: "0.95rem" }}>{arcResText}</p>
      </Section>

      {/* Final metrics */}
      <Section label="Final metrics">
        <MetricRows reach={s2.messageSpread} effectiveness={s2.messageEffectiveness} />
        <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.85rem" }}>
          Reputation and visibility impact from this resolution will be shown on the post-season summary.
        </p>
      </Section>

      <div style={{ marginTop: "0.5rem" }}>
        <Link href={`/game/postseason/${season}/resolutions`} className="btn btn-primary" style={{ textDecoration: "none" }}>
          Back
        </Link>
      </div>
    </div>
  );
}
