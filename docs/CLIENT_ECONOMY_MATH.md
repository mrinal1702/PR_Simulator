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
