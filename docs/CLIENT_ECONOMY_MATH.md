# Client economy math (authoritative)

Implementation: `web/lib/clientEconomyMath.ts`. Reputation bands: `web/lib/metricScales.ts`.

## Reputation

- Range **−100 … 200** (`METRIC_SCALES.reputation`).
- `normalizeReputation()` → `R*` in \[0, 1\].

## Visibility (no hard ceiling)

- `visibilityInfluence(V) = V / (V + k)`, default `k = 150` (`DEFAULT_VISIBILITY_ASYMPTOTE_K`).

## Client type & budget (Season 1)

- **Weights:** `typeSkewWeightsSeason1` → `typeSkewProbabilities` → `sampleClientKindDeterministic` (seeded).
- **Budget tier (1 or 2):** `budgetTierScore` + jitter + `BUDGET_TIER2_SCORE_THRESHOLD`; cap `EARLY_GAME_MAX_BUDGET_TIER`.
- **Within-tier EUR:** `rollClientBudgetTotalInTier` (visibility influence on range).
- **Split:** `splitBudgetBySeason(total)` in `seasonClientLoop.ts` — **~70%** first tranche / remainder second tranche (`CURRENT_TRANCHE_SHARE_OF_TOTAL`).

## Season 1 client count (2 vs 3)

`season1ThirdClientProbability(visibility)` (piecewise) + deterministic seed in `plannedClientCountForSeason`.

## Season 1 in-season liquid & pricing

See `seasonClientLoop.ts` + `SeasonClientCaseScreen`:

- Season 1 tranche is **not** credited until the player runs a priced campaign: **EUR** `+ budgetSeason1 − costBudget`, **capacity** `− costCapacity`; afford check uses **agency cash + that tranche**.
- **Solutions:** `buildSolutionOptionsForClient` — share-of-tranche × `SOLUTION_COST_SCALE`; scenario copy merged via `buildSolutionOptionsForClientWithScenario`.
- **Reject:** no EUR/capacity from the client.

**Post-season (Season 1 style):** boosts, rep, visibility — `postSeasonResults.ts`; see `POST_SEASON.md`.

## Season 2+ (pointer)

**New client queue** (type, tier, budgets, third-slot probability, tier-2 bands) and **Season 2+ main-case pricing** are **not** the Season 1 skew/tier pipeline above — they live in `clientEconomyMath.ts` + `buildSeasonClients` / `buildSolutionOptionsSeason2Plus` as documented in **`docs/SEASON2_STRUCTURE.md`**.

Constants and tuning: top of `clientEconomyMath.ts` and `SEASON2_PLUS_SOLUTION_PRICING` in `seasonClientLoop.ts`.

## Tuning

Constants at the top of `clientEconomyMath.ts` (and pricing table in `seasonClientLoop.ts` for Season 2+ solutions).
