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
- Scenario title and brief; **post-season arc** text from scenario **`arc_1`** branches (see *Arc keys* below).
- Message reach / effectiveness (from in-season resolution).
- Player chooses **optional boost**: increase reach (EUR 5,000), increase effectiveness (5 capacity), or **do nothing** — competence maps to **1–5%** boost when applicable.
- These boost buttons are generic gameplay choices; they do **not** come from scenario JSON `arc_2.options`.
- **Reputation** (−2 … +5 from effectiveness octets) and **visibility** (+1 … +10 from 50% reach + 50% satisfaction) apply **after** the choice; stored on `run.postSeason` and in agency stats.

**Summary:** `/game/postseason/1/summary` — `SeasonSummaryScreen.tsx`  
Agency outcomes, scenario overview (expandable), company financials (operating summary + cash flow), footnotes. **Enter pre-season 2** only after post-season results are done.

**Finance on these screens:** After **Continue to post-season** (`SeasonHubScreen`), **`payablesLines`** is rebuilt with **wage lines** for surviving non-intern staff so **payables**, **`liquidityEur`**, and **`hasLayoffPressure`** match the next year’s payroll obligation (see `docs/AGENCY_FINANCE.md` §5.2). **Enter pre-season N+1** (`enterNextPreseason`) applies spouse grant, capacity reset, intern expiry, and **merges/rebuilds** rollover wages for the new pre-season.

---

## Season 2+ post-season (rollover resolution + fresh-scenario review)

Rollover clients are resolved **in-season** (carry-over queue, `applySeason2CarryoverChoice`); outcomes are written on the **prior season’s** run as **`season2CarryoverResolution`** (`seasonClientLoop.ts`).

There is **no** second boost step in post-season for these carry-over arcs — those scenarios **end** here for narrative purposes. After the player finishes reviewing those resolution cards, the hub unlocks a second mandatory pass over the **fresh scenarios from the current season**.

**Hub:** `/game/postseason/[season]` for `season >= 2`  
Shows **Completed scenarios** (rollover recap), **Season 2 scenarios** (fresh current-season review), and **Scenario history**. **Scenario history** unlocks once the rollover resolutions are acknowledged. **Season summary** stays disabled until the player has completed **both** mandatory tracks.

**Completed scenarios (mandatory):** `/game/postseason/[season]/resolutions` — `PostSeasonResolutionScreen.tsx`  
Same queue order as **Season 1 clients who now have** `season2CarryoverResolution` on their Season 1 run. For each:

- `client_type`, `scenario_title`, client display name; **`problem_summary`** (expandable **Show more**).
- **Resolution** text from scenario JSON **`arc_resolution`**: a **3×3** grid keyed by **reach band** × **effectiveness band** (see *Season 2 resolution grid* below).
- Final **reach** / **effectiveness** with the same metric bars as the season summary (gradient + B/W bar).
- **OK** advances to the next scenario; progress is stored in **`postSeasonResolutionProgressBySeason`** on the save (`NewGamePayload`).
- **Scenario history** links to the detail page for that client.

**Mechanics note:** Carry-over **EUR / capacity** spends and final **reach / effectiveness / satisfaction** for the arc are applied **in-season** when the player picks a carry-over option (`applySeason2CarryoverChoice` in `seasonCarryover.ts`). The post-season **resolutions** screen is a **mandatory narrative recap** of those outcomes (plus progress tracking), not a second spend step.

**Fresh Season 2 scenarios (mandatory after rollover recap):** `/game/postseason/[season]/results` — `PostSeasonResultsScreen.tsx`  
Once rollover resolutions are complete, the player reviews the **current season’s accepted scenarios** one by one in queue order. For each:

- Scenario title and brief.
- **`arc_1`** outcome text keyed from the scenario’s initial reach/effectiveness result (same 50% reach/effectiveness split used elsewhere).
- Optional boost choice: **reach**, **effectiveness**, or **do nothing**.
- For `season >= 2`, the boost size uses the season’s frozen **Season 2 `cScore`** with a small deterministic jitter, then rounds to **1–5%**.
- Costs are budget-tier based:
  - **Tier 1:** reach boost **EUR 5,000**, effectiveness boost **10 capacity**
  - **Tier 2:** reach boost **EUR 10,000**, effectiveness boost **15 capacity**
- Reputation and visibility from these fresh-scenario reviews are stored on `run.postSeason` and feed the season summary.

**Scenario history (reference):**

- **List:** `/game/postseason/[season]/history` — `ScenarioHistoryListScreen.tsx` (scenario titles only).
- **Detail:** `/game/postseason/[season]/history/[clientId]` — `ScenarioHistoryDetailScreen.tsx`  
  Full brief, Season 1 solution, **`arc_1`** outcome (50% high/low grid on **initial** Season 1 reach/effectiveness), **midseason checkpoint** (Season 1 **final** metrics after post-season boost + S1 rep/vis), **`arc_2`** blurb (same 50% grid on **initial** S1 metrics — what the player saw in the Season 2 carry-over case flow), Season 2 carry-over action summary, **`arc_resolution`** text (3×3 on **final** S2 metrics), final metrics. **Back** returns to resolutions (or list context as linked).

Helpers: `getPostSeasonResolutionEntries`, `advancePostSeasonResolutionProgress`, `isPostSeasonResolutionComplete` in `web/lib/seasonCarryover.ts`.  
Arc text: `buildArcResolutionText`, `buildArc1Text`, `buildPostSeasonArcBlurb`, `arcResolutionReachLabel`, `arcResolutionEffLabel` in `web/lib/postSeasonResults.ts`.  
Scenario lookup: `getScenarioById` in `web/lib/scenarios.ts`.

---

## Arc keys (scenario JSON)

### `arc_1` and `arc_2` (four branches each)

Keys: `low_visibility_low_effectiveness`, `low_visibility_high_effectiveness`, `high_visibility_low_effectiveness`, `high_visibility_high_effectiveness`.

**Selection in code:** `postSeasonArcKeyFromMetrics` — **reach > 50%** ⇒ “high visibility” half; **effectiveness > 50%** ⇒ “high effectiveness” half. (Naming uses “visibility” for historical reasons; in copy this is **message reach**.)

Used for:

- **`arc_1`:** Season 1 **post-season** results screen blurb and the Season 1 outcome shown in history, both keyed from the **initial** reach/effectiveness result before any post-season boost.
- **`arc_2`:** Season 2 carry-over follow-up blurb (`buildPostSeasonArcBlurb`) — same threshold, still keyed from the original Season 1 reach/effectiveness result.
- **`arc_2.options`:** authoring/reference copy only in the current build. The live option buttons in Season 1 and carry-over flows come from the fixed solution-card system, not these strings.

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
| S1/S2 boosts + ledger | `web/lib/postSeasonResults.ts` |
| S2+ resolution progress | `web/lib/seasonCarryover.ts` |
| Run types (`postSeason`, `season2CarryoverResolution`) | `web/lib/seasonClientLoop.ts` |
| Hub | `web/components/PostSeasonHubScreen.tsx` |
| S1 results / S2 fresh-scenario review | `web/components/PostSeasonResultsScreen.tsx` |
| S2+ resolutions | `web/components/PostSeasonResolutionScreen.tsx` |
| History list / detail | `ScenarioHistoryListScreen.tsx`, `ScenarioHistoryDetailScreen.tsx` |
| Summary | `web/components/SeasonSummaryScreen.tsx` |
