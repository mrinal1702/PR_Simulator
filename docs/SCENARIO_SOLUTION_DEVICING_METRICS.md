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

Under **current** hiring rules (`web/lib/hiring.ts` + `web/lib/benchmarkHiringAttract.ts` for agency-stat normalization by season), **not** typical playthroughs — useful as **upper bounds** when calibrating “best case” solution outcomes (re-run scripted max checks if attract μ/σ or role weights change):

| Metric | Approx. max observed | Notes |
|--------|----------------------|--------|
| **Visibility** | **127** | e.g. Portfolio Pivot + Influential + Network + one senior Sales hire (best-of-three skill), single hire exhausts budget |
| **Competence** | **124** | e.g. Portfolio Pivot + Supportive + Workshop + one senior Data Analyst (best-of-three skill) |

Do **not** treat these as “average good” — they are **stacked** optima. Scenario solutions aimed at **typical** players should lean on the **empirical quartiles** and **UI bands** above.

---

## Tie-in to in-season outcomes

`resolveClientOutcome` in `web/lib/seasonClientLoop.ts` uses **current** `visibility` and `competence` from the save when a solution is executed. It routes to **`computeSeason1SolutionMetrics`** or **`computeSeason2SolutionMetrics`** by season: **Season 1** uses legacy **piecewise** C/V knots; **Season 2+** uses **benchmark-normalized** raw C/V (`benchmarkSeason2Scores.ts`) before the same jitter + force path — see `docs/SEASON2_STRUCTURE.md`. Post-season boosts and summary screens read **final** `outcome` values after post-season resolution.

Current resolver note (`solutionOutcomeMath.ts`):
- Reach/effectiveness start from archetype base and use an **additive signed force** from centered driver scores.
- Full campaign span **±20** per metric before clamp/round; small deterministic jitter on the mapped V/C scores (visibility jitter wider than competence).
- **Carry-over** improvement uses Season 2+ variance drivers with **±10** span per metric.

---

## Changelog

- 2026-04-11: Season 2+ outcomes use benchmark C/V mapping (not a second piecewise knot table).
- Earlier: additive-force resolver, ±20 span, jitter on mapped scores.
