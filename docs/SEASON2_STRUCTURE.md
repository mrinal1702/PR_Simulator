# Season 2+ structure

Season **1** stays on the Season 1 economy, outcome knots, and liquid rules described in `CLIENT_ECONOMY_MATH.md`. This doc covers **Season 2 and later**: frozen entry scores, **benchmark-normalized** V/C for snapshots and rolls, new client queue logic, contract split, main-case pricing, and **Season 1 rollover** before new clients.

**Code:** `web/lib/benchmarkSeason2Scores.ts`, `payablesReceivables.ts`, `clientEconomyMath.ts`, `solutionOutcomeMath.ts`, `seasonCarryover.ts`, `seasonClientLoop.ts`, `SeasonHubScreen.tsx`, `SeasonClientCaseScreen.tsx`.

---

## 1. Entry **V_score** and **C_score** (`seasonEntryScoresBySeason`)

On **Start season**, `settlePreseasonAndEnterSeason` writes `seasonEntryScoresBySeason[seasonKey]`:

| Season | Snapshot |
|--------|----------|
| **1** | `visibilityScoreForVariance` / `competenceScoreForVariance` (Season 1 piecewise knots) |
| **≥ 2** | `visibilityScoreForVarianceSeason2` / `competenceScoreForVarianceSeason2` → **benchmark** raw stats for Season 2 entry (μ / σ in `benchmarkSeason2Scores.ts`) |

These numbers are **fixed for the whole season** for rolls and design that should mean “stats when the season opened.” Mid-season campaign outcomes do **not** rewrite them.

---

## 2. Client count (2 vs 3)

- **Season 1:** unchanged — `season1ThirdClientProbability(raw visibility)` + seed.
- **Season 2+:** `plannedClientCountForSeason` uses entry **V_score** vs `SEASON2_REFERENCE_V_SCORE_P50` / `_P75` (derived from the same benchmark grid as §1). Hub passes `seasonEntryScoresBySeason[season].vScore` when present.

---

## 3. New Season 2+ clients (`buildSeasonClients`, `season === 2` path)

- **Type & tier:** probabilistic rules in `clientEconomyMath.ts` — reputation z vs (4.54, 1.8), corporate cooldown, SMB vs individual mix, no corporate tier 2, third slot forced individual tier 1 when count = 3, tier-2 repeat dampening, etc.
- **Budget bands:** `CLIENT_BUDGET_TIER_RANGES` (tier 2 EUR bands updated for Season 2 design); within-tier roll uses entry V_score + seed; tier-1 **individual** gets a fixed **+5k** bump in Season 2.
- **Split:** `splitBudgetBySeason` → ~**70%** current tranche (`budgetSeason1`) / remainder follow-up (`budgetSeason2`), whole-thousands rounding (`CURRENT_TRANCHE_SHARE_OF_TOTAL` in `seasonClientLoop.ts`).
- **Main-case solution pricing (Season 2+):** `buildSolutionOptionsSeason2Plus` — EUR as **% of `budgetSeason1` only** per client kind (individual / SMB / corporate); corporate secondary options are fractions of the **best** anchor EUR; capacities scaled by `SOLUTION_COST_SCALE`. Bases for reach/effectiveness match Season 1 archetypes.

**Scenarios:** same merged DB as Season 1 — `pickScenarioForClient(kind, tier, seed)`; no separate “Season 2-only” pool.

---

## 4. Campaign outcomes (Season 2+ full campaigns)

`resolveClientOutcome` with `outcomeScoreSeason === 2`: same additive-force model as Season 1; **drivers** use **benchmark-normalized** visibility and competence (then jitter), not the Season 1 piecewise knot tables (`computeSeason2SolutionMetrics`).

---

## 5. Season 1 rollover **before** new Season 2 clients

**Gate:** Season 2 hub blocks **Roll season clients** until every Season 1 **accepted** client with an outcome has been through the carry-over queue (original order).

**Player-facing UI** (`SeasonClientCaseScreen`, carry-over branch):

- Narrative block **“So what happened?”** (accent colour) + **`postSeasonArcOutcomes`** prose for the branch (no “Arc 2”, no branch-key / threshold developer copy).
- **Bars:** shifted Season 1 reach / effectiveness (`applyBuildOutcomeShift` — Velvet +5 reach / −5 effectiveness, Summa opposite, Portfolio none).
- **Build hint:** only for non–Portfolio Pivot — **Reach** / **Effectiveness** lines with **green “+N% boost”** or **red “−N% decay”** (absolute percentage points), not long “Build modifier applied …” sentences.
- **“What should you do?”** — fixed EUR/capacity options from `CARRYOVER_SOLUTION_FIXED_COSTS` + `buildCarryoverSolutionOptionsForClient`. **No** internal pricing or variance essay; **no** “Archetype N:” labels. **Take no action** uses short player copy; **Confirm** modal on all choices.

**Logic:** `applySeason2CarryoverChoice` — spends agency EUR/capacity, writes `season2CarryoverResolution` on the Season 1 run. Outcome math: carryover variance ±10 per metric (`seasonCarryover.ts` / `computeCarryoverVarianceDeltasSeason2`).

**Soft stats (rep, visibility-from-satisfaction, etc.):** still applied in **post-season** flows per `POST_SEASON.md`; not credited on carry-over confirm.

---

## 6. Benchmarks (code, not JSON dumps)

| Location | Use |
|----------|-----|
| `web/lib/benchmarkSeason2Scores.ts` | **μ / σ** for raw visibility and competence at Season 2 entry (`benchmarkRawVisibilityToScore`, etc.). Update here when you recalibrate. |
| `web/lib/clientEconomyMath.ts` | `SEASON2_REFERENCE_V_SCORE_P50` / `_P75` (third-client probability bands), derived from the same benchmark normalization. |
| `web/scripts/simulate-main-strategy-rollover-metrics.ts` | Optional replay: main strategy through Season 2 entry + greedy rollovers; writes a fresh JSON under `scripts/results/` when run. |

---

## Related

- `CLIENT_ECONOMY_MATH.md` — Season 1 liquid + shared primitives
- `POST_SEASON.md` — post-season hubs and resolutions
- `AGENCY_FINANCE.md` — settlement, receivables, liquidity
