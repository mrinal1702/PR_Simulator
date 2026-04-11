# Scenario solution devicing metrics

*(Working title: use these numbers when **devising** scenario solutions and solution math so outcomes stay aligned with how “strong” an agency is in the live sim.)*

This note gives **visibility** and **competence** reference points: UI bands, economy calibration, empirical mid-game spread, and **ceiling** values from pre-season + hiring under current rules. Another agent can treat these as **normalization anchors** when calculating or scoring scenario solutions.

**Source of truth for numeric ranges and labels:** `web/lib/metricScales.ts` (`METRIC_SCALES`).

---

## Scale basics (both stats)

| | Visibility | Competence |
|---|------------|------------|
| **Design range** | 0–1000 | 0–1000 |
| **In formulas** | No hard ceiling in client math; `visibilityInfluence(V) = V / (V + 150)` in `web/lib/clientEconomyMath.ts` | Same numeric range; used heavily in `resolveClientOutcome` / hiring skill |

---

## Calibration benchmark (equal “power” at the line)

From `data/conversion_mechanics.txt` / `web/lib/gameEconomy.ts`:

- **80,000 EUR ≙ 80 competence ≙ 80 visibility ≙ 50 firm capacity** at the benchmark line.

So **~80** on visibility or competence is a **deliberate** “high but not endgame” anchor for comparing buffs and tradeoffs.

---

## What counts as “good” — UI bands (player-facing)

Use these to phrase **relative** quality (e.g. “agency is still Junior Desk tier” vs “Strategist tier”).

### Visibility (`METRIC_SCALES.visibility`)

| Band (approx.) | Label |
|----------------|--------|
| 0–50 | Unknown |
| 51–150 | Local Buzz |
| 151–300 | Niche Noticed |
| 301–450 | Talk of the Feed |
| 451–600 | Trending |
| 601–800 | Mainstream |
| 801–1000 | Ubiquitous |

### Competence (`METRIC_SCALES.competence`)

| Band (approx.) | Label |
|----------------|--------|
| 0–50 | Winging It |
| 51–150 | Junior Desk |
| 151–300 | Practitioner |
| 301–450 | Strategist |
| 451–600 | Specialist |
| 601–800 | Expert Office |
| 801–1000 | Crisis Authority |

**Rule of thumb for copy:** **below ~50** = weak on that axis; **~80** = benchmark “strong”; **150+** = solid mid-tier; **300+** = high; bands above **450** are “very strong” in UI terms.

---

## Empirical spread (early-game random saves)

One run of **100** randomized saves (uniform random **build**, **spouse**, **activity** `network` / `workshop` / `none`, random hires and random candidate slot 0–2) produced:

| Stat | Mean | Median (Q2) | Q1 (25%) | Q3 (75%) |
|------|------|-------------|----------|----------|
| **Visibility** | 67.3 | 61.5 | 40.0 | 93.0 |
| **Competence** | 61.9 | 54.0 | 38.8 | 90.0 |

**Interpretation for solution design:** Most agencies in that sample sit in **Local Buzz** / **Junior Desk** territory, with the **middle** of the pack around **~60** on both axes. Values **above ~90** are already **relatively high** for that early-game distribution; **below ~40** visibility or **~39** competence sit in the **lower quartile** of that sample.

Script: `web/scripts/save-stats-visibility-competence.ts` (re-run to refresh numbers if economy changes).

---

## Ceilings (pre-season + up to 2 hires, “best of 3” candidates)

Under **current** hiring rules (`web/lib/hiring.ts`), **not** typical playthroughs — useful as **upper bounds** when calibrating “best case” solution outcomes:

| Metric | Approx. max observed | Notes |
|--------|----------------------|--------|
| **Visibility** | **127** | e.g. Portfolio Pivot + Influential + Network + one senior Sales hire (best-of-three skill), single hire exhausts budget |
| **Competence** | **124** | e.g. Portfolio Pivot + Supportive + Workshop + one senior Data Analyst (best-of-three skill) |

Do **not** treat these as “average good” — they are **stacked** optima. Scenario solutions aimed at **typical** players should lean on the **empirical quartiles** and **UI bands** above.

---

## Tie-in to in-season outcomes

`resolveClientOutcome` in `web/lib/seasonClientLoop.ts` uses **current** `visibility` and `competence` from the save when a solution is executed. It routes to **`computeSeason1SolutionMetrics`** or **`computeSeason2SolutionMetrics`** depending on whether the campaign uses Season 1 or Season 2 **normalized** C/V scores (piecewise knots differ; see `docs/SEASON2_STRUCTURE.md`). Scenario text and difficulty should stay **consistent** with the same agency stats this document uses as references. Post-season boosts and summary screens read **final** `outcome` values after post-season resolution.

**Narrative arcs (scenario JSON vs displayed %):**

| Key | When selected | Metric basis |
|-----|----------------|--------------|
| **`arc_1`** | Season 1 in-season (and history detail) | Four-way grid: reach &gt; 50%, effectiveness &gt; 50% ⇒ `high_visibility_high_effectiveness`, etc. (`postSeasonArcKeyFromMetrics` in `postSeasonResults.ts`). Uses **initial** campaign reach/effectiveness for `arc_1` copy. |
| **`arc_2`** | Season 1 post-season results screen | Same 50% grid on **initial** S1 metrics (pre-boost), via `buildPostSeasonArcBlurb`. |
| **`arc_resolution`** | Season ≥ 2 post-season **resolutions** screen only | **3×3** grid: reach buckets ≤35 / 36–67 / ≥68 × effectiveness ≤35 / 36–67 / ≥68; keys `low`/`medium`/`high` × `poor`/`good`/`convincing`. See `docs/POST_SEASON.md`. |

Carry-over **Season 2** in-season choice uses **`computeCarryoverVarianceDeltasSeason2`** (±10 per metric on top of archetype deltas); stored on the run as **`season2CarryoverResolution`**.

Current resolver note (`solutionOutcomeMath.ts`):
- Reach/effectiveness start from archetype base and use an **additive signed force** from centered driver scores (rather than blending base toward a variance layer).
- Current tuning uses a fixed full span of **40 points** around base: **±20** before clamp/round.
- Explicit random term was removed from reach/effectiveness variance; instead, small deterministic jitter is applied to `V_score` / `C_score` (visibility jitter wider than competence jitter).
- **Two knot tables** for mapping raw stats to scores: **Season 1** (legacy calibration) and **Season 2** (median-recalibrated for late pre-season); **carry-over** improvement uses Season 2 variance with a **±10** span per metric.

---

## Changelog

- 2026-04-08: Initial snapshot (metric bands, benchmark 80, random-save quartiles, pre-season ceilings).
- 2026-04-09: Noted `solutionOutcomeMath` / post-season final metrics.
- 2026-04-09: Updated for additive-force resolver, ±30% half-span interpretation, and score-level jitter.
- 2026-04-09: Updated resolver tuning to fixed ±20 force span around base.
- 2026-04-11: Table for `arc_1` / `arc_2` / `arc_resolution` vs metrics; carry-over pointer; cross-ref `docs/POST_SEASON.md`.
