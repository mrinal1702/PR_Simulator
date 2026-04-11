# Season 2+ structure

Structural behaviour that differs from Season 1: **frozen entry scores**, **Season 2 client rolls**, **benchmark-normalised V/C** for outcomes and entry snapshots, **Season 1 rollover** before new clients, and **player-facing Season 2 case UI** (carry-over screen).

**Code:** `web/lib/benchmarkSeason2Scores.ts`, `web/lib/payablesReceivables.ts`, `web/lib/clientEconomyMath.ts`, `web/lib/solutionOutcomeMath.ts`, `web/lib/seasonCarryover.ts`, `web/lib/seasonClientLoop.ts`, `web/components/SeasonHubScreen.tsx`, `web/components/SeasonClientCaseScreen.tsx`.

---

## 1. Frozen entry **V_score** and **C_score**

On **Start season** after pre-season, `settlePreseasonAndEnterSeason` writes `seasonEntryScoresBySeason[seasonKey]`:

| Season key | Snapshot |
|------------|----------|
| **1** | `visibilityScoreForVariance` / `competenceScoreForVariance` (Season 1 knots). |
| **≥ 2** | `visibilityScoreForVarianceSeason2` / `competenceScoreForVarianceSeason2` → **benchmark** raw V/C vs Season 2 entry grid (μ = 81, σ from `web/scripts/results/cv-season2-entry-grid.json` `gridAll1200`; see `benchmarkSeason2Scores.ts`). |

Values are **fixed for that season**. Client-count and economy logic that mean “at season open” should read this map, not live stats after play.

---

## 2. Client count (2 vs 3) for Season **≥ 2**

- **Season 1:** unchanged — third slot from raw visibility (`season1ThirdClientProbability`) + seed.
- **Season ≥ 2:** 2 or 3 clients; third-slot probability from **entry V_score** vs `SEASON2_REFERENCE_V_SCORE_P50` / `P75` in `clientEconomyMath.ts` (scores derived from grid median / Q3 raw visibility through the same benchmark mapping). Hub passes `seasonEntryScoresBySeason[season].vScore` when present.

---

## 3. New Season 2 clients (`buildSeasonClients`, season **=== 2**)

- **Type / tier:** `season2RollClientKindAndTier` — reputation z vs 4.54 / 1.8, corporate cooldown rules, no corporate tier 2, third slot forced individual tier 1 when count = 3, tier-2 repeat dampening, etc. (`clientEconomyMath.ts`).
- **Budget:** tier bands in `CLIENT_BUDGET_TIER_RANGES`; within-tier EUR for Season 2 via `rollSeason2ClientBudget`; tier-1 individuals get a flat +5k where applicable.
- **Contract split:** `splitBudgetBySeason` — ~**70%** current tranche (`budgetSeason1`) / remainder follow-up (`budgetSeason2`); constant `CURRENT_TRANCHE_SHARE_OF_TOTAL` in `seasonClientLoop.ts`.
- **Solution pricing (Season ≥ 2, ids `s2-…`, `s3-…`, …):** `buildSolutionOptionsSeason2Plus` — `SEASON2_PLUS_SOLUTION_PRICING` (% of `budgetSeason1` by client kind; corporate secondary options chained from best anchor). Season **1** queue still uses legacy share-based pricing.

---

## 4. Campaign outcomes (Season **≥ 2** main cases)

`resolveClientOutcome` with `outcomeScoreSeason === 2` uses **benchmark-normalised** raw visibility / competence (same additive-force model as Season 1: jitter, discipline, ±20 span); implementation in `computeSeason2SolutionMetrics` (`solutionOutcomeMath.ts`).

---

## 5. Season 1 rollover (before **Roll season clients** on Season 2 hub)

**Gating:** Accepted Season 1 clients must be cleared in **queue order** (`getSeasonCarryoverEntries` / `applySeason2CarryoverChoice`).

**Math (implementation):** Shifted Season 1 outcome (`applyBuildOutcomeShift`) + carry-over choice → `computeCarryoverOutcomeAfterChoice` / `season2CarryoverResolution` on the Season 1 run (`seasonCarryover.ts`, `seasonClientLoop.ts`). Spend is **agency EUR + capacity only** (see `docs/AGENCY_FINANCE.md`).

### 5.1 Season 2 carry-over **screen** (`SeasonClientCaseScreen`, rollover branch)

Player-facing copy is **not** dev-facing:

- **“So what happened?”** (accent colour) + narrative from `postSeasonArcOutcomes` (branch chosen from shifted reach/effectiveness; **no** “Arc 2”, “branch key”, or threshold debug text).
- **Bars** for shifted Season 1 reach / effectiveness (you already know past performance).
- **Build modifier:** Velvet Rolodex / Summa Cum Basement show **Reach** / **Effectiveness** as **green “+N% boost”** or **red “−N% decay”** (absolute points); **Portfolio Pivot** shows nothing.
- **“What should you do?”** — priced options with EUR and capacity on each card; **no** “Archetype *n*”, **no** internal carry-over pricing paragraph.
- **Take no action:** title + description *“Take no action. Reach and effectiveness might drop slightly.”*
- **Confirm modal** for every choice (including non-reject); short body copy, no variance-maths lecture.

---

## 6. Post-season

Season 2+ mandatory resolution flow and `arc_resolution` grid: **`docs/POST_SEASON.md`**. Entry scores (§1) stay the season’s pre-play snapshot for rolls.

---

## 7. Benchmark inputs

- **`web/scripts/results/cv-season2-entry-grid.json`** — `gridAll1200` raw visibility / competence stats; drives benchmark μ/σ and V_score quantile proxies for third-client probability.
- **`web/scripts/results/season2-preseason-end-190.json`** — optional sim snapshot; refresh if you re-tune pre-season play.

---

## Related

- `docs/CLIENT_ECONOMY_MATH.md` — Season 1 economy detail; Season 2+ queue and liquids cross-reference here.
- `docs/POST_SEASON.md` — post-season routes and Season 2 resolution narrative.
- `docs/AGENCY_FINANCE.md` — receivables, carry-over spend rules.
- `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` — scenario stat anchors; Season 2+ outcomes use benchmark V/C.
