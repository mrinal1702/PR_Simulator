# Post-season (UI flows and narrative arcs)

Authoritative code: `web/lib/postSeasonResults.ts`, `web/lib/seasonCarryover.ts` (Season 2+ resolution tracking), UI under `web/app/game/postseason/`.

**Solution outcome math** (reach / effectiveness / satisfaction during a campaign): `web/lib/solutionOutcomeMath.ts` and `resolveClientOutcome` in `web/lib/seasonClientLoop.ts`. Metric anchors and knot tables: `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` and `docs/SEASON2_STRUCTURE.md`.

---

## Season 1 post-season

**Hub:** `/game/postseason/1` — `PostSeasonHubScreen.tsx`  
Agency snapshot, optional stats/employees/case log, liquidity copy, **View results** (mandatory if there are accepted campaigns), **Season summary** (enabled only after results are complete).

**Results:** `/game/postseason/1/results` — `PostSeasonResultsScreen.tsx`  
One scenario at a time in **queue order** (same order as in-season). For each accepted run with an outcome:

- Arc completeness bar (50% for Season 1 half-arc).
- Scenario title and brief; **post-season arc** text from scenario **`arc_2`** branches (see *Arc keys* below).
- Message reach / effectiveness (from in-season resolution).
- Player chooses **optional boost**: increase reach (EUR 5,000), increase effectiveness (5 capacity), or **do nothing** — competence maps to **1–5%** boost when applicable.
- **Reputation** (−2 … +5 from effectiveness octets) and **visibility** (+1 … +10 from 50% reach + 50% satisfaction) apply **after** the choice; stored on `run.postSeason` and in agency stats.

**Summary:** `/game/postseason/1/summary` — `SeasonSummaryScreen.tsx`  
Agency outcomes, scenario overview (expandable), company financials (operating summary + cash flow), footnotes. **Enter pre-season 2** only after post-season results are done.

**Transition:** `enterNextPreseason` in `web/lib/preseasonTransition.ts` (spouse grant, capacity reset, intern expiry).

---

## Season 2+ post-season (rollover resolution)

Rollover clients are resolved **in-season** (carry-over queue, `applySeason2CarryoverChoice`); outcomes are written on the **prior season’s** run as **`season2CarryoverResolution`** (`seasonClientLoop.ts`).

There is **no** second boost step in post-season for these arcs — the scenario **ends** here for narrative purposes.

**Hub:** `/game/postseason/[season]` for `season >= 2`  
Shows **Completed scenarios** instead of Season 1’s “View results”. **Season summary** stays disabled until every resolution card is acknowledged.

**Completed scenarios (mandatory):** `/game/postseason/[season]/resolutions` — `PostSeasonResolutionScreen.tsx`  
Same queue order as **Season 1 clients who now have** `season2CarryoverResolution` on their Season 1 run. For each:

- `client_type`, `scenario_title`, client display name; **`problem_summary`** (expandable **Show more**).
- **Resolution** text from scenario JSON **`arc_resolution`**: a **3×3** grid keyed by **reach band** × **effectiveness band** (see *Season 2 resolution grid* below).
- Final **reach** / **effectiveness** with the same metric bars as the season summary (gradient + B/W bar).
- **OK** advances to the next scenario; progress is stored in **`postSeasonResolutionProgressBySeason`** on the save (`NewGamePayload`).
- **Scenario history** links to the detail page for that client.

**Reputation / visibility** for Season 2 resolution: **not yet applied** in code; UI may show a placeholder until design is finalized.

**Scenario history (reference):**

- **List:** `/game/postseason/[season]/history` — `ScenarioHistoryListScreen.tsx` (scenario titles only).
- **Detail:** `/game/postseason/[season]/history/[clientId]` — `ScenarioHistoryDetailScreen.tsx`  
  Full brief, Season 1 solution, **`arc_1`** outcome (50% high/low grid on **initial** Season 1 reach/effectiveness), **midseason checkpoint** (Season 1 **final** metrics after post-season boost + S1 rep/vis), **`arc_2`** blurb (same 50% grid on **initial** S1 metrics — what the player saw in Season 1 post-season), Season 2 carry-over action summary, **`arc_resolution`** text (3×3 on **final** S2 metrics), final metrics. **Back** returns to resolutions (or list context as linked).

Helpers: `getPostSeasonResolutionEntries`, `advancePostSeasonResolutionProgress`, `isPostSeasonResolutionComplete` in `web/lib/seasonCarryover.ts`.  
Arc text: `buildArcResolutionText`, `buildArc1Text`, `buildPostSeasonArcBlurb`, `arcResolutionReachLabel`, `arcResolutionEffLabel` in `web/lib/postSeasonResults.ts`.  
Scenario lookup: `getScenarioById` in `web/lib/scenarios.ts`.

---

## Arc keys (scenario JSON)

### `arc_1` and `arc_2` (four branches each)

Keys: `low_visibility_low_effectiveness`, `low_visibility_high_effectiveness`, `high_visibility_low_effectiveness`, `high_visibility_high_effectiveness`.

**Selection in code:** `postSeasonArcKeyFromMetrics` — **reach > 50%** ⇒ “high visibility” half; **effectiveness > 50%** ⇒ “high effectiveness” half. (Naming uses “visibility” for historical reasons; in copy this is **message reach**.)

Used for:

- **`arc_1`:** Season 1 **in-season** outcome (initial reach/effectiveness after campaign execution, before post-season boost).
- **`arc_2`:** Season 1 **post-season** screen blurb (`buildPostSeasonArcBlurb`) — same threshold, **initial** S1 metrics (pre-boost), matching what the player saw when reviewing results.

### `arc_resolution` (nine branches — Season 2 post-season only)

Structure: top-level keys **`low` | `medium` | `high`** (reach row); each value is an object with **`poor` | `good` | `convincing`** (effectiveness column) → string paragraph.

**Reach row** (`arcResolutionReachLabel`):

| Band | Reach % |
|------|---------|
| low | ≤ 35 |
| medium | 36–67 |
| high | ≥ 68 |

**Effectiveness column** (`arcResolutionEffLabel`):

| Band | Effectiveness % |
|------|-----------------|
| poor | ≤ 35 |
| good | 36–67 |
| convincing | ≥ 68 |

Cutoffs are **not** shown to the player; they only see the chosen resolution paragraph.

---

## Related files (quick reference)

| Area | File |
|------|------|
| S1 boosts + ledger | `web/lib/postSeasonResults.ts` |
| S2+ resolution progress | `web/lib/seasonCarryover.ts` |
| Run types (`postSeason`, `season2CarryoverResolution`) | `web/lib/seasonClientLoop.ts` |
| Hub | `web/components/PostSeasonHubScreen.tsx` |
| S1 results | `web/components/PostSeasonResultsScreen.tsx` |
| S2+ resolutions | `web/components/PostSeasonResolutionScreen.tsx` |
| History list / detail | `ScenarioHistoryListScreen.tsx`, `ScenarioHistoryDetailScreen.tsx` |
| Summary | `web/components/SeasonSummaryScreen.tsx` |

---

## Changelog

- 2026-04-11: Initial doc — Season 1 vs Season 2+ flows, routes, `arc_resolution` 3×3, `postSeasonResolutionProgressBySeason`, scenario history pages.
