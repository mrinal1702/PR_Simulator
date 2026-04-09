# Client economy math (authoritative)

Implementation: `web/lib/clientEconomyMath.ts`. Reputation UI bands remain in `web/lib/metricScales.ts`.

## Reputation

- Range: **−100** to **200** (see `METRIC_SCALES.reputation`).
- Normalized: `R* = clamp((R − Rmin) / (Rmax − Rmin), 0, 1)` via `normalizeReputation()`.

## Visibility (no maximum)

- **No hard ceiling** in formulas. Use an asymptotic map so high visibility never “saturates” at a false cap:
  - `visibilityInfluence(V) = V / (V + k)` with default `k = 150` (`DEFAULT_VISIBILITY_ASYMPTOTE_K`).
- Values approach 1 as `V → ∞`; early game stays sensitive.

## Client type (individual / small business / corporate)

Weights come from `typeSkewWeights` → `typeSkewProbabilities`, **branching by season** (“round-wise”):

- **Season 1**: fixed **early pipeline** (`typeSkewWeightsSeason1`) — mostly individuals, corporates very rare, SMB bumps when visibility influence is low.
- **Season 2**: **bridge** (`typeSkewWeightsSeason2`) — blends season 1 with the season 3+ model (~45% toward the flexible mix).
- **Season 3+**: **stat-varied** mix (`typeSkewWeightsSeason3Plus`) — classic skew: individual `0.65·V* + 0.35·(1−R*)`, SMB `0.5·V* + 0.5·R*`, corporate `0.35·V* + 0.65·R*`.

**Sampling**: deterministic from seed (`sampleClientKindDeterministic`) for repeatable runs.

## Budget tier (seasons 1–2 only: tiers 1 and 2)

- **Score**: `0.45·V* + 0.55·R*` (`budgetTierScore`).
- **Jitter**: small deterministic jitter from seed.
- **Tier 2 threshold**: `BUDGET_TIER2_SCORE_THRESHOLD` (default 0.52).
- **Cap**: seasons 1–2 cannot exceed tier 2 (`EARLY_GAME_MAX_BUDGET_TIER`).

## Within-tier budget (total contract)

- **Ranges** (`CLIENT_BUDGET_TIER_RANGES`): per type per tier 1 or 2, `min`/`max` in EUR.
- **Roll**: **visibility only** — `rollClientBudgetTotalInTier`.
- **Season split**: `splitBudgetBySeason(total)` in `seasonClientLoop.ts` (~70% / remainder, whole thousands).

## Season client count (visibility)

- **Season 1**: **2** or **3** clients. Third slot probability: `season1ThirdClientProbability(visibility)` — **piecewise linear**:
  - ~**8%** at visibility ≤ 20
  - ~**30%** at visibility **60** (mid / “normal” investment)
  - ~**92%** by visibility **115+** (strong visibility investment only)
- **Deterministic** per save: `plannedClientCountForSeason(season, visibility, seed)` with seed e.g. `createdAt|playerName`.
- **Other seasons** (placeholder): same bands as before for `season > 1`.

## Tuning

Constants live at the top of `clientEconomyMath.ts`.

---

## In-season engagement (EUR and capacity)

Implemented in `web/lib/seasonClientLoop.ts` (with client construction in `buildSeasonClients` and UI in `SeasonClientCaseScreen`).

1. **Queue**: From the season hub, **Roll season clients** fills `clientsQueue` for that season. Clients are processed **in order**; the case screen always shows the client at `currentClientIndex`.

2. **Season 1 liquid (cash)**: The client’s **Season 1 tranche** is **not** credited when the case opens. It only enters play when the player **runs a priced campaign**: agency EUR changes by **`+budgetSeason1 − costBudget`** in one step, and capacity decreases by **`costCapacity`**. Affordability uses **your cash + their Season 1 tranche** against the solution’s EUR spend.

3. **Priced solutions**: Four archetypes (`solution_1` … `solution_4`) have EUR and capacity costs **derived from** `budgetSeason1`, client kind scaling, and fixed share rules — see `buildSolutionOptionsForClient`. Creative **names and briefs** are merged from the scenario record when present (`mergeScenarioSolutionCopy` / `buildSolutionOptionsForClientWithScenario`).

4. **Season 1 — Reject client**: The reject option means the client **does not** commit Season 1 liquid to you; **no** EUR or capacity change. (Later seasons may allow a different “do nothing” where arcs carry over.)

5. **Execute a campaign**: Applies the net EUR and capacity change above; computes spread / effectiveness / satisfaction via `resolveClientOutcome`. **Money retained** for the case log is **`budgetSeason1 − costBudget`** (Season 1 liquid after spend).

6. **Post-season transition**: When every queued client has a resolved run, the season hub offers **Continue to post-season** (updates `phase` to `postseason`, no confirmation modal).

## Post-season (Season 1 implemented)

Authoritative implementation: `web/lib/postSeasonResults.ts`, `web/lib/solutionOutcomeMath.ts` (in-season outcomes), `web/lib/seasonFinancials.ts` (summary financials), UI under `web/app/game/postseason/`.

- **Results flow**: Player reviews each accepted campaign in order; optional **reach** boost (EUR 5,000) or **effectiveness** boost (5 capacity), each up to 5% based on competence. **Reputation** (−2…+5 from effectiveness bands) and **visibility** (+1…10 from a 50/50 blend of final reach and final satisfaction) apply **after** the choice, using final metrics.
- **Ledger**: `collectPostSeasonLedger` / `buildMetricBreakdown` include post-season lines. **Season summary** adds operating P&amp;L + cash bridge, future **receivables** footnote (`budgetSeason2` sum), and **payroll vs cash** (see `docs/PAYROLL_AND_LAYOFF_RULES.md`).
