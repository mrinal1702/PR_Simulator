# Agent Handoff (Current Game State)

Use this file as the fastest context for a fresh agent.

## Documentation map

| File | Contents |
|------|----------|
| `README.md` | Design brief + implementation snapshot + doc index |
| `docs/CLIENT_ECONOMY_MATH.md` | Client / Season 1 liquid math |
| `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` | Visibility/competence anchors for solution balancing |
| `docs/SCENARIO_CREATIVE_GUIDELINES.md` | Scenario JSON authoring |
| `docs/DEPLOYMENT.md` | Supabase + Vercel |
| `docs/PAYROLL_AND_LAYOFF_RULES.md` | Payroll, layoffs, warnings, gates (**design**; not fully wired) |

## Design locked (not yet fully implemented)

Full spec: **`docs/PAYROLL_AND_LAYOFF_RULES.md`**. Summary:

- **Payroll:** per-season obligation; UI should say “upcoming season” (not vague “annual”); confirm on hire / Talent Bazaar copy.
- **Spouse grants** apply **before** payroll resolution — call this out in warnings and projections.
- **Warnings:** hard modal vs soft inline when spend risks missing payroll; persistent **payroll vs cash** chip without scaring players who can still earn **in-season** from clients.
- **Forced layoffs** at checkpoint if cash cannot cover total payroll after inflows; **choose who** if multiple employees; **auto** if only one must go; conspicuous **Employees** CTA when player must act.
- **Voluntary Fire:** −10 reputation, **20% severance**, max **1 voluntary layoff per season**; warn on attempt.
- **Progression:** cannot advance from **pre-season 2** (or equivalent) until payroll / layoff state is resolved if the roster is unaffordable.
- **Same pre-season:** cannot lay off someone hired **in that same** pre-season.
- Pre-season **2** checkpoint UI for layoff resolution is **not** deployed yet; rules are for the next build.

## Product state

- Deployed web app with onboarding, pre-season flow, **season hub**, **in-season client cases**, **home dashboard** (phase + case log), and **post-season** (hub, mandatory results flow, season summary with financials + payroll heads-up).
- Single local save slot is active (`dma-save-slot`) with Continue routing.
- Seasons are planned through season 7; **Season 1–style client queue** (roll → sequential cases → solutions) is implemented; deeper multi-season / round-2 campaign logic can build on `seasonLoopBySeason`.
- **Post-season 1 (Season 1)** is feature-complete for: outcome review, optional reach/effectiveness boosts, reputation/visibility rewards, ledger breakdown lines, **Season summary** (`/game/postseason/[season]/summary`) with scenario overview, operating P&amp;L + cash bridge, future-receivables footnote, and payroll vs cash check (`docs/PAYROLL_AND_LAYOFF_RULES.md` alignment). **Pre-season 2+** route exists from summary (`Enter pre-season N+1`); content may still mirror Season 1 until multi-season economy is expanded.

## Implemented flow

1. Home (`/`)
   - `Continue` (enabled when save exists) and `New game`.
   - With a save: `HomeDashboard` shows **phase** (e.g. Season 1 · In season), agency stats with **metric breakdown** (`web/lib/metricBreakdown.ts`, includes Season 1 client ledger lines), employees, **Case log — Season 1**.
2. New game (`/game/new`)
   - Founder name + gender (`male`, `female`, `non_binary`)
   - Agency name
   - Build selection (3 origins)
   - Spouse selection (4 options) with spouse name+gender when spouse is not `none`
   - Writes initial run payload and routes to pre-season.
3. Pre-season screen (`/game/preseason/[season]`)
   - Activity focus once per pre-season:
     - `strategy_workshop` => +10 competence
     - `network` => +10 visibility
   - `Agency stats` panel with bars + labels for reputation/visibility/competence
   - `Employees` panel with salary-sorted roster and non-zero contribution lines
   - Metric breakdown modal buttons for:
     - wealth
     - visibility
     - competence
     - capacity
     - reputation
   - `Start season` confirmation modal:
     - warns player they cannot return to pre-season
     - adds strong warning if no pre-season activity was selected
     - allows proceed anyway
   - Activity cards are hidden after pre-season focus is used
   - Talent Bazaar entry button routes to dedicated hiring screen
   - `Save` button
4. Hiring screen (`/game/preseason/[season]/hiring`)
   - Mode: `Intern` vs `Full-time`
   - Intern:
     - fixed salary (`10k`)
     - no role selection
     - fixed gains: +3 competence, +3 visibility
   - Full-time:
     - role select (`data_analyst`, `sales_representative`, `campaign_manager`)
     - tiered salary dropdowns (5k anchored bands)
   - Candidate generation:
     - deterministic pool of 3 for same run/season/role/tier/budget
     - unique names and unique descriptions within same 3-option set
   - Hire behavior:
     - irreversible
     - autosaves immediately
     - updates EUR, stats, and capacity
     - themed modal shows flavor lines + transparent numeric gains
   - Budget safety:
     - blocks unaffordable options and any action that would make EUR negative
5. Season hub (`/game/season/[season]`)
   - Component: `SeasonHubScreen` (also exported as `SeasonScreen` from `web/components/SeasonScreen.tsx` for a stable import path).
   - Agency stats, employees, save (same patterns as pre-season).
   - No Talent Bazaar (pre-season only).
   - **`Roll season clients`**: deterministic queue for that season (`plannedClientCount`, `clientsQueue`, `runs`, `currentClientIndex`) stored under `save.seasonLoopBySeason[season]`.
   - **`Open current client case`**: navigates to `/game/season/[season]/client` while the queue is not finished.
   - When **`runs.length === plannedClientCount`** and **`currentClientIndex >= plannedClientCount`**, season client work is **done**; **`Continue to post-season`** appears. It sets `phase: "postseason"` and navigates to `/game/postseason/[season]` — **no** “are you sure” modal (unlike pre-season → season).
6. Client case (`/game/season/[season]/client`)
   - Component: `SeasonClientCaseScreen`.
   - **Season 1 economy**: Season 1 liquid is **not** credited on page load. **Reject client** = no EUR/capacity change. **Execute a campaign** applies `+budgetSeason1 − costBudget` to EUR and subtracts capacity in one step; run records optional `costBudget`, `costCapacity`, `solutionTitle` for ledger/history.
   - Four priced archetypes + reject; creative copy from merged `web/data/scenarios_*.json` via `pickScenarioForClient` (unique `scenario_id` per playthrough via `usedScenarioIds`).
7. Post-season (`/game/postseason/[season]`)
   - **`PostSeasonHubScreen`**: agency stats, case log (Season 1), **Season summary** link, **View results** (mandatory one-by-one review of accepted campaigns in queue order).
   - **`/game/postseason/[season]/results`**: per scenario — arc completeness bar, outcome metrics, optional boost (reach costs EUR 5k, effectiveness costs 5 capacity; gain 1–5% from competence), or do nothing. Updates `run.outcome`, `run.postSeason`, `reputation`, `visibility`, EUR/capacity as applicable.
   - **`/game/postseason/[season]/summary`**: agency gains (post-season rep/vis), average reach/effectiveness/satisfaction, payroll vs cash (**may need to fire / reduce headcount** if cash &lt; roster payroll per `docs/PAYROLL_AND_LAYOFF_RULES.md`), toggles for **Scenario overview** and **Company financials** (operating P&amp;L + cash bridge; future receivables footnote). **Enter pre-season N+1** button (capped at 7).
   - `Continue` routes here when `phase === "postseason"` (`getContinuePath` in `saveGameStorage.ts`).

## Save model (single slot)

Source type: `NewGamePayload` in `web/components/NewGameWizard.tsx`.

Persisted fields:
- identity: `playerName`, `agencyName`, `gender`
- run setup: `buildId`, `spouseType`, `spouseName`, `spouseGender`
- loop state: `seasonNumber`, `phase`, `activityFocusUsedInPreseason`
- metrics: `resources` (`eur`, `competence`, `visibility`, `firmCapacity`)
- derived: `reputation`
- baseline snapshot: `initialResources`, `initialReputation`
- hiring state: `hiresBySeason`, `employees[]`
- **in-season client loop**: `seasonLoopBySeason` — optional map keyed by season string → `SeasonLoopState` (`plannedClientCount`, `currentClientIndex`, `clientsQueue`, `runs`, `lastOutcome`). Each `SeasonClientRun` may include **`postSeason`** after the post-season results flow. See `web/lib/seasonClientLoop.ts`.
- **used scenario IDs**: `usedScenarioIds` — list of `scenario_id` values already assigned to a client this playthrough. `pickScenarioForClient` excludes these (widening pool as needed); rolling clients updates the list. Load merges with IDs found in existing `clientsQueue` for older saves. If the DB runs out of unused scenarios, the roll fails with a user-facing message.
- metadata: `createdAt`

Storage helpers: `web/lib/saveGameStorage.ts`
- `loadSave()`
- `persistSave(payload)`
- `getContinuePath(save)`

Notes:
- Saves are written to both `sessionStorage` and `localStorage`.
- Older session-only save is auto-migrated to local storage on load.
- Save is still local-only; existing players keep their own local state until Supabase persistence is wired for gameplay loop.

## Economy (current constants)

Primary location: `web/lib/gameEconomy.ts` (starting builds, spouse modifiers, Total_V benchmark).

**Client-facing in-season pricing and queue** (authoritative for client math): `web/lib/clientEconomyMath.ts`, `web/lib/seasonClientLoop.ts`. Human-readable summary: `docs/CLIENT_ECONOMY_MATH.md`.

- Build IDs: `velvet_rolodex`, `summa_cum_basement`, `portfolio_pivot`
- Spouse IDs: `supportive`, `influential`, `rich`, `none`
- Baseline build stats (`STARTING_BUILD_STATS`) are equal Total_V.
- Total_V benchmark:
  - `80,000 EUR ≙ 80 competence ≙ 80 visibility ≙ 50 capacity`
- Starting reputation: `STARTING_REPUTATION = 5`
- Spouse effects at start and per season:
  - `rich`: +20,000 EUR
  - `supportive`: +20 competence
  - `influential`: +20 visibility
  - `none`: capacity set to 100 at start, no recurring inflow

Validation utilities:
- `validateEconomyInvariants()`
- `patchBuildsToEqualTotalV()`

## Metric labels and bar scales

Data-driven scale config: `web/lib/metricScales.ts`

### Reputation
- range: `-100..200`
- labels: Fraud, Untrustworthy, Dicey, Insignificant, Reputable, Trustworthy, Institutional

### Visibility
- range: `0..1000`
- labels:
  - 0–50 Unknown
  - 51–150 Local Buzz
  - 151–300 Niche Noticed
  - 301–450 Talk of the Feed
  - 451–600 Trending
  - 601–800 Mainstream
  - 801+ Ubiquitous

### Competence
- range: `0..1000`
- same numeric bands as visibility
- labels:
  - Winging It, Junior Desk, Practitioner, Strategist, Specialist, Expert Office, Crisis Authority

UI behavior:
- Agency stats panel is in `web/components/PreSeasonScreen.tsx`
- Bars have a red→yellow→green spectrum with a black position marker.

## Key UI data files

- `web/lib/onboardingContent.ts`: display copy + build/spouse IDs and titles
- `web/components/NewGameWizard.tsx`: onboarding and initial save creation
- `web/components/HomeMenu.tsx`: Continue/New game entry buttons
- `web/components/HomeDashboard.tsx`: phase, stats, breakdowns, Season 1 case log
- `web/lib/metricBreakdown.ts`: agency ledger lines for breakdown modals (pre-season, home, Season 1 client deltas, post-season rep/vis/EUR/capacity)
- `web/lib/solutionOutcomeMath.ts`: Season 1 campaign reach/effectiveness (archetype base + variance)
- `web/lib/postSeasonResults.ts`: post-season boosts, rewards, `collectPostSeasonLedger`
- `web/lib/seasonFinancials.ts`: season summary cash bridge, future receivables, payroll heads-up
- `web/components/PostSeasonHubScreen.tsx`, `PostSeasonResultsScreen.tsx`, `SeasonSummaryScreen.tsx`: post-season UI
- `web/components/PreSeasonScreen.tsx`: pre-season hub (focus, employees, breakdowns, season-start confirmation)
- `web/components/HiringScreen.tsx`: dedicated hiring flow and hire outcome modal
- `web/components/SeasonHubScreen.tsx`: season hub (roll queue, link to client case)
- `web/components/SeasonClientCaseScreen.tsx`: dedicated client scenario + solution choices
- `web/components/SeasonScreen.tsx`: re-exports `SeasonHubScreen` as `SeasonScreen`
- `web/lib/seasonClientLoop.ts`, `web/lib/scenarios.ts`: client queue, solution costs, scenario pick
- `web/data/scenarios_individual.json`, `scenarios_small_company.json`, `scenarios_corporate.json`, `scenario_database.json`: creative scenario pool; merged in `scenarios.ts`
- `web/lib/hiring.ts`: candidate generation, band logic, productivity/capacity mapping, campaign manager split
- `web/lib/budgetGuard.ts`: non-negative EUR guard helpers

## Manual verification (season client flow)

Useful checks before wider QA:

1. From season hub, **Roll season clients** once; note **Planned client count** and **Current N / N**.
2. **Open current client case** — **no** automatic Season 1 credit on load. **Reject client** leaves **EUR** unchanged.
3. **Execute a priced solution** (affordable with **your cash + their Season 1 tranche**) — EUR changes by **`+budgetSeason1 − costBudget`**, capacity by **`−costCapacity`**; hub advances after resolving the case.
4. Repeat until the queue is finished; **Continue to post-season** appears only when **`runs.length`** matches **planned** count and the queue index is past the last client.
5. **Continue to post-season** — no confirmation modal; save `phase` is **postseason**; URL `/game/postseason/[season]`.
6. Post-season hub: open **View results**, complete every campaign (boost or not); verify EUR/capacity/rep/vis updates and breakdown lines.
7. **Season summary**: check averages, financials toggle, payroll warning when cash &lt; total salaries; **Enter pre-season 2** (or next) navigates to `/game/preseason/[n]`.

## Supabase status

- SQL schema exists in `supabase/migrations/20260407120000_initial_schema.sql`
- Web MVP currently runs from local save state (not yet writing these screens to Supabase).
- Deployment details: `docs/DEPLOYMENT.md`

## Safe next tasks for another agent

1. **Implement `docs/PAYROLL_AND_LAYOFF_RULES.md`:** projection with spouse grants, spend warnings, checkpoint layoff resolution UI (pre-season 2+), `Fire` on Employees, same-pre-season hire protection, progression gate. (Summary screen already shows cash vs total payroll shortfall.)
2. Extend client loop: Season 2 follow-up spend, multi-season post-season parity, reputation from non–Season-1 arcs.
3. Add intern expiry after one season transition.
4. Persist run state to Supabase (while keeping local fallback).
5. Add automated tests for:
   - save/load/continue path
   - non-negative budget guard behavior
   - deterministic candidate pool stability (hiring + client kind / budget rolls)
   - unique candidate name/description set guarantees
   - metric band selection
   - spouse modifier invariants
   - pre-season → season transition warning and phase routing
   - **season client queue**: roll idempotency, sequential index, reject = no credit, execute = net Season 1 liquid, **Continue to post-season** when queue fully resolved
   - **payroll / layoff rules** (once implemented): projection, gate, forced choice, voluntary caps
