# Agent context (canonical)

**Purpose:** Single onboarding doc for contributors and AI agents working on the **Next.js** game under `web/`. Game design intent lives in the repo **`README.md`** (elevator pitch, resources, tradeoffs). **Mechanical authority** for money and hiring: `docs/AGENCY_FINANCE.md`. Do not duplicate long tables from those files here.

---

## Stack & layout

| Item | Detail |
|------|--------|
| Framework | Next.js 15 (App Router), TypeScript |
| App root | `web/` — Vercel **Root Directory** must be `web` |
| Save | Single slot, key `dma-save-slot` (`localStorage` + `sessionStorage`); `loadSave` / `persistSave` in `web/lib/saveGameStorage.ts` |
| Save type | `NewGamePayload` in `web/components/NewGameWizard.tsx` |

Run checks from `web/`: `npm run build`, `npm run dev`.

---

## Player journey (routes)

| Phase | Typical URL | Main component |
|-------|----------------|------------------|
| Home | `/` | `HomeMenu`, `HomeDashboard` |
| New game | `/game/new` | `NewGameWizard` |
| Pre-season | `/game/preseason/[season]` | `PreSeasonScreen` |
| Hiring | `/game/preseason/[season]/hiring` | `HiringScreen` |
| Season hub | `/game/season/[season]` | `SeasonHubScreen` |
| Client case | `/game/season/[season]/client` | `SeasonClientCaseScreen` |
| Post-season hub | `/game/postseason/[season]` | `PostSeasonHubScreen` |
| Post-season results (S1-style boosts) | `/game/postseason/[season]/results` | `PostSeasonResultsScreen` |
| Post-season S2+ resolutions | `/game/postseason/[season]/resolutions` | `PostSeasonResolutionScreen` |
| Season summary | `/game/postseason/[season]/summary` | `SeasonSummaryScreen` |

`getContinuePath(save)` in `saveGameStorage.ts` matches `phase` + `seasonNumber` to the right URL.

---

## Save payload (engineering highlights)

Omit fields not listed; many are optional for legacy loads.

- **Identity:** `playerName`, `agencyName`, `gender`, `buildId`, `spouseType`, `spouseName`, `spouseGender`
- **Loop:** `seasonNumber`, `phase` (`preseason` | `season` | `postseason`)
- **Resources:** `resources` (`eur`, `competence`, `visibility`, `firmCapacity`), `reputation`, `initialResources`, `initialReputation`
- **Pre-season:** `activityFocusUsedInPreseason`, `preseasonActionBySeason`, `preseasonFocusCounts`, `preseasonEntrySpouseGrantSeasons`, **`preseasonEntryRevealPending`** (one-shot modal data after `enterNextPreseason`; cleared on dismiss in `PreSeasonScreen`)
- **Season:** `seasonLoopBySeason[seasonKey]` → `SeasonLoopState` (queue, runs, `postSeason`, `season2CarryoverResolution`, …)
- **Finance:** `payablesLines`, `payrollPaidBySeason`, `seasonEntryScoresBySeason`, `rolloverReviewProgressBySeason`, `postSeasonResolutionProgressBySeason` (see `AGENCY_FINANCE.md`, `SEASON2_STRUCTURE.md`)

---

## Cross-cutting code

| Concern | Location |
|---------|----------|
| Post-season → next pre-season (spouse grant, tenure capacity, intern expiry, reveal pending) | `web/lib/preseasonTransition.ts` |
| Spouse seasonal amounts + line rotation copy | `web/lib/gameEconomy.ts`, `web/lib/preseasonEntrySpouseCopy.ts` |
| Post-season boosts & ledger | `web/lib/postSeasonResults.ts` |
| Outcomes (S1 knots vs S2+ benchmark C/V) | `web/lib/solutionOutcomeMath.ts`, `benchmarkSeason2Scores.ts`, `resolveClientOutcome` in `seasonClientLoop.ts` |
| Payables, receivables, liquidity, season start settlement | `web/lib/payablesReceivables.ts` |
| Season 2 carry-over in-season | `web/lib/seasonCarryover.ts` |
| Metric breakdown lines | `web/lib/metricBreakdown.ts` |
| Scenarios merge / pick | `web/lib/scenarios.ts`, `web/data/scenarios_*.json` |

---

## UI conventions (product-facing)

- **`AgencyResourceStrip`** — Sticky bar (`preseason-resource-strip` in CSS): EUR, competence, visibility, capacity, reputation with **`ResourceSymbol`** (`web/components/resourceSymbols.tsx`). Used on pre-season, hiring, season hub, client case, post-season hub/results.
- **“Next step” CTA** — **`btn-next-hint`** (yellow gradient) for post-season **Season summary** when results are complete, and **Enter pre-season N+1** on the summary screen. Summary → next season uses an **“Are you sure?”** modal before calling `enterNextPreseason`.
- **Modals** — Overlay `game-modal-overlay` + `game-modal`; keep focus and copy concise.
- **Client case — client money** — Labels are **client fees** (uppercase in UI): *CLIENT FEES THIS SEASON / NEXT SEASON / TOTAL CLIENT FEES* — not “budget,” to avoid confusion with agency cash (`SeasonClientCaseScreen` + `globals.css`).
- **Post-season results — optional boost** — Buttons show **ResourceSymbol** next to EUR / capacity costs (`PostSeasonResultsScreen`).
- **Season summary — scenario tab** — Only **accepted** clients; **Show more** / **Show less**; **CAMPAIGN RESULTS** block with gradient reach/effectiveness + B/W bars; reputation gain/loss coloring; visibility line in body color (`SeasonSummaryScreen` + `globals.css`).
- **Pre-season entry reveal** — After `enterNextPreseason`, first visit to that pre-season shows **`PreseasonEntryRevealModal`**: rotating spouse flavor line + grant row with symbols; per-employee **capacity before → after** for tenure bumps.

---

## Domain docs (read when touching that area)

| Doc | Use when |
|-----|----------|
| `docs/AGENCY_FINANCE.md` | Payables, receivables, liquidity, layoffs, hiring, settlement |
| `docs/CLIENT_ECONOMY_MATH.md` | Client pricing, Season 1 liquid math |
| `docs/SEASON2_STRUCTURE.md` | Season 2+ entry scores, client rolls, pricing, rollover UI |
| `docs/POST_SEASON.md` | Post-season flows, arcs, S2+ resolution vs S1 boosts |
| `docs/SCENARIO_CREATIVE_GUIDELINES.md` | Writing / JSON for scenarios |
| `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` | Solution / outcome balancing anchors |
| `docs/SCENARIO_NAMES_USED.md` | Avoid duplicate character names |
| `docs/DEPLOYMENT.md` | Supabase + Vercel |

---

## Conventions for changes

1. Prefer **small, focused diffs**; match existing component and CSS patterns.
2. **Persist** any save shape change through `persistSave` paths you touch; keep `NewGamePayload` as the type source of truth.
3. After UI or type changes, run **`npm run build`** from `web/`.
4. Do not rely on undocumented Supabase writes for core loop — gameplay is **local-first** until cloud sync is implemented.

---

## Obsolete / removed from older handoff notes

- Long “error fix” or deployment-debug narratives are intentionally dropped; use **git history** for archaeology.
- Separate **payroll** screen paths: legacy URLs should **redirect** to main pre-season (see `web/app/game/preseason/[season]/payroll/page.tsx` if present).
- Any doc claiming “post-season not built” or “no Continue path” is stale — treat this file + `README.md` snapshot as current.
