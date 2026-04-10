# Season 2 structure (authoritative overview)

This document describes **structural** Season 2+ behavior that differs from Season 1: frozen entry scores, client rolls, normalization of competence/visibility scores, and **Season 1 scenario rollover** (carry-over) before new clients are rolled.

**Code touchpoints:** `web/lib/payablesReceivables.ts`, `web/lib/clientEconomyMath.ts`, `web/lib/solutionOutcomeMath.ts`, `web/lib/seasonCarryover.ts`, `web/lib/seasonClientLoop.ts`, `web/components/SeasonHubScreen.tsx`, `web/components/SeasonClientCaseScreen.tsx`.

---

## 1. Frozen **V_score** and **C_score** at season entry

When the player taps **Start season** after pre-season, `settlePreseasonAndEnterSeason` in `payablesReceivables.ts` writes **`seasonEntryScoresBySeason[seasonKey]`** on the save:

| Season key | Normalization used for snapshot |
|------------|----------------------------------|
| **1** | Season 1 knots: `visibilityScoreForVariance`, `competenceScoreForVariance` |
| **≥ 2** | Season 2 knots: `visibilityScoreForVarianceSeason2`, `competenceScoreForVarianceSeason2` |

- These values are **fixed for that season** (and for post-season design: they do **not** update mid-season when campaigns resolve or reputation/visibility change from outcomes).
- Economy rolls that should reflect “who you were when the season started” should read **`seasonEntryScoresBySeason`**, not re-derived scores after play.

---

## 2. How many clients this season? (2 vs 3)

| Season | Rule |
|--------|------|
| **1** | Unchanged: third client slot probability from **raw visibility** via `season1ThirdClientProbability` (piecewise linear), then a deterministic coin flip from seed. |
| **≥ 2** | **Only 2 or 3** clients. Probability of **3** clients depends on **entry V_score** vs a **benchmark distribution** from `web/scripts/results/season2-preseason-end-190.json`: |
| | • `V_score ≥` reference **P75** → **~80%** chance of 3 clients |
| | • **P50 ≤ V_score < P75** → **~50%** |
| | • **V_score < P50** → **~25%** |

Constants: `SEASON2_REFERENCE_V_SCORE_P50`, `SEASON2_REFERENCE_V_SCORE_P75` in `clientEconomyMath.ts` (update when you refresh the benchmark JSON).

**Roll:** `plannedClientCountForSeason` — hub passes **`seasonEntryScoresBySeason[season].vScore`** when present; if missing (legacy save), falls back to **`visibilityScoreForVarianceSeason2(current visibility)`**.

---

## 3. Campaign outcomes: Season 1 vs Season 2 **C/V normalization**

`solutionOutcomeMath.ts` keeps **two** piecewise knot tables for mapping raw visibility / competence to 0–100 driver scores:

- **Season 1** (legacy calibration): used for Season 1 campaigns and for systems that intentionally stay on the old curve (e.g. some post-season boost mapping).
- **Season 2** (recalibrated medians): used for **Season 2+** `resolveClientOutcome` when `outcomeScoreSeason === 2` (see `seasonClientLoop.ts`).

Same additive-force model (jitter, discipline, `tanh`, ±20 full campaign span); only the **knots** differ.

---

## 4. Season 1 scenario rollover (before new Season 2 clients)

**Gating:** On **Season 2** hub, the player must complete **carry-over** follow-ups for **accepted Season 1 clients** (original queue order) before **Roll season clients** is enabled.

**Display:**

- **EM** = reach/effectiveness after **build** modifier (`applyBuildOutcomeShift` in `seasonCarryover.ts`): e.g. Summa Cum Basement shifts reach −5 / effectiveness +5 absolute points; Velvet Rolodex the opposite; Portfolio Pivot unchanged.
- **Arc 2** text uses `postSeasonArcOutcomes` branches with **high/low** at **50%** threshold on **shifted** reach and effectiveness.
- **Options:** fixed EUR/capacity (`CARRYOVER_SOLUTION_FIXED_COSTS` + `buildCarryoverSolutionOptionsForClient`), plus **Do nothing** (no spend; **−5** absolute points on **both** reach and effectiveness).

**Outcome math (carry-over):** New metrics = EM + (base archetype deltas + Season 2 variance deltas with **±10** max per metric). Stored on the Season 1 run as **`season2CarryoverResolution`** (`seasonClientLoop.ts`).

---

## 5. Post-season and satisfaction / reputation (later)

**Rollover** scenarios can have **no** post-season boost choice; **satisfaction / reputation / visibility** from resolution are still intended to be applied in **post-season** when that flow is wired for Season 2. Entry scores in section 1 remain the season’s **pre-play** snapshot for rolls and economy.

---

## 6. Benchmark files

- **`web/scripts/results/season2-preseason-end-190.json`** — empirical distribution of raw stats and **vScore/cScore** at end of Pre-season 2 (before season start). Used to set **P50/P75** thresholds for client count; re-run sims and **update constants** when the economy or knots change.

---

## Related docs

- `docs/CLIENT_ECONOMY_MATH.md` — type skew, budget tier, Season 1 liquid; Season 2+ client count summarized here.
- `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` — raw stat anchors; dual knot tables for outcomes noted above.
- `docs/AGENCY_FINANCE.md` — liquidity, pre-season settlement, receivables.
