# Agent Handoff (Current Game State)

Use this file as the fastest context for a fresh agent.

## Documentation map

| File | Contents |
|------|----------|
| `README.md` | Design brief + implementation snapshot + doc index |
| `docs/AGENCY_FINANCE.md` | **Cash, payables, receivables, liquidity, hiring, layoffs** — authoritative |
| `docs/CLIENT_ECONOMY_MATH.md` | Client economy + Season 1 liquid math |
| `docs/SEASON2_STRUCTURE.md` | Season 2+ entry scores, client count, C/V knots, rollover carry-over |
| `docs/POST_SEASON.md` | Post-season routes: Season 1 results/summary vs Season 2+ resolutions, arc keys, history |
| `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` | Visibility/competence anchors for solution balancing |
| `docs/SCENARIO_CREATIVE_GUIDELINES.md` | Scenario JSON authoring |
| `docs/DEPLOYMENT.md` | Supabase + Vercel |

## Agency finance & employees

Authoritative spec: **`docs/AGENCY_FINANCE.md`**.

**Implemented:**

- **Payables / receivables / liquidity:** `web/lib/payablesReceivables.ts` — wage and severance lines, guaranteed receivables from accepted clients, `liquidityEur`, `hasLayoffPressure`, `settlePreseasonAndEnterSeason`.
- **Pre-season 2+** (`PreSeasonScreen`): **Employees** with **Fire** — voluntary (severance payable + rep; caps) vs mandatory when **liquidity &lt; 0** (no severance, no rep). **Start season** settles `receivables − payables`, clears payables, sets `payrollPaidBySeason[season]` for season ≥ 2, and writes **`seasonEntryScoresBySeason[seasonKey]`** (frozen **V_score** / **C_score** for that year — Season 1 knots for season 1, Season 2 knots for season ≥ 2; see `docs/SEASON2_STRUCTURE.md`).
- **Season route guard:** `SeasonHubScreen` and `SeasonClientCaseScreen` redirect to **`/game/preseason/[season]`** if season ≥ 2 and that season is not yet marked settled — blocks direct URL entry to season until pre-season is completed.
- **Hiring** (`HiringScreen`): adds **wage** payable; hire allowed when liquidity supports salary; confirmation modals on hire.
- **Resource strip:** `AgencyResourceStrip` — payables (red), receivables (green), liquidity.
- **Post-season hub / season summary:** layoff pressure + liquidity copy where relevant.
- **Legacy URL:** `web/app/game/preseason/[season]/payroll/page.tsx` **redirects** to main pre-season (no separate screen).
- **Interns:** on `enterNextPreseason`, interns whose `seasonHired` is the completed season are **removed** from `employees[]` and their competence/visibility gains are removed from agency stats.

**Optional polish / future:**

- Richer spend warnings mid-season (not fully modeled).
- Additional payable line types beyond wages and severance.

## Product state

- Deployed web app with onboarding, pre-season flow, **season hub**, **in-season client cases**, **home dashboard** (phase + case log), and **post-season** (hub, mandatory results flow, season summary with financials + liquidity / layoff pressure when relevant).
- Single local save slot is active (`dma-save-slot`) with Continue routing.
- Seasons are planned through season 7; **client queue** (roll → sequential cases → solutions) is implemented on `seasonLoopBySeason`. **Season 2+**: **Season 1 rollover** (carry-over scenarios, build-shifted metrics, Arc 2, fixed EUR/capacity, outcome math) must be completed before rolling **new** Season 2 clients (`SeasonHubScreen` / `SeasonClientCaseScreen`). See **`docs/SEASON2_STRUCTURE.md`**.
- **Post-season (Season 1)** is feature-complete for: outcome review, optional reach/effectiveness boosts, reputation/visibility rewards, ledger breakdown lines, **Season summary** (`/game/postseason/[season]/summary`) with scenario overview, operating P&amp;L + cash bridge, future-receivables footnote, and liquidity panel. **Enter pre-season N+1** applies spouse grant + capacity reset + intern expiry and routes to **`/game/preseason/[n]`**. **Post-season (Season 2+)** uses **Completed scenarios** (`/game/postseason/[season]/resolutions`) — mandatory one-by-one **`arc_resolution`** review for rollover runs (`season2CarryoverResolution`); **Scenario history** at `/game/postseason/[season]/history` (+ per-client detail). **Season summary** for season ≥ 2 stays disabled until resolution progress is complete. See **`docs/POST_SEASON.md`**. **Pre-season 2+** uses the same `PreSeasonScreen` with upgraded focus cards, **Fire**, simplified ledgers when `seasonNumber >= 2` and `phase === "preseason"`, and **Start season** settlement (receivables − payables, clear payables) for season 2+.

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
   - Activity focus once per pre-season (season 1: +10 each track; season 2+: **+15** if doubling down on last pre-season’s track, **+10** on the other — see `web/lib/preseasonFocus.ts`):
     - `strategy_workshop` => competence
     - `network` => visibility
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
   - Talent Bazaar entry button routes to dedicated hiring screen (disabled while **layoff pressure** blocks **Start season** on season 2+)
   - Season **2+**: **Fire** on employees — voluntary (severance payable + rep; limits) or **mandatory** when liquidity is negative (no severance, no rep)
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
     - updates roster, stats, capacity, and **payables** (full-time wage lines; interns per current rules)
     - themed modal shows flavor lines + transparent numeric gains
   - Affordability: full-time hires require sufficient **liquidity** (payables-based model); blocks choices that would violate guards; see `docs/AGENCY_FINANCE.md`.
5. Season hub (`/game/season/[season]`)
   - Component: `SeasonHubScreen` (also exported as `SeasonScreen` from `web/components/SeasonScreen.tsx` for a stable import path).
   - Agency stats, employees, save (same patterns as pre-season).
   - Season **≥ 2**: if `payrollPaidBySeason[season]` is false, **redirect** to pre-season — season entry blocked until pre-season is completed and **Start season** has run for that year.
   - No Talent Bazaar (pre-season only).
   - **`Roll season clients`**: deterministic queue for that season (`plannedClientCount`, `clientsQueue`, `runs`, `currentClientIndex`) stored under `save.seasonLoopBySeason[season]`. **Season 2+** client count is **2 or 3** from **entry V_score** vs benchmark curve (`plannedClientCountForSeason` + `seasonEntryScoresBySeason`).
   - **`Open current client case`**: navigates to `/game/season/[season]/client` while the queue is not finished.
   - When **`runs.length === plannedClientCount`** and **`currentClientIndex >= plannedClientCount`**, season client work is **done**; **`Continue to post-season`** appears. It sets `phase: "postseason"` and navigates to `/game/postseason/[season]` — **no** “are you sure” modal (unlike pre-season → season).
6. Client case (`/game/season/[season]/client`)
   - Component: `SeasonClientCaseScreen`.
   - **Season 1 economy**: Season 1 liquid is **not** credited on page load. **Reject client** = no EUR/capacity change. **Execute a campaign** applies `+budgetSeason1 − costBudget` to EUR and subtracts capacity in one step; run records optional `costBudget`, `costCapacity`, `solutionTitle` for ledger/history.
   - **Season 2+ in-season campaigns** use **Season 2** C/V knot normalization for outcomes (`resolveClientOutcome` with `outcomeScoreSeason: 2`).
   - **Season 2+ before new clients**: **Season 1 carry-over** UI (rollover queue, Arc 2, priced options, `applySeason2CarryoverChoice`) — see `docs/SEASON2_STRUCTURE.md`.
   - Four priced archetypes + reject; creative copy from merged `web/data/scenarios_*.json` via `pickScenarioForClient` (unique `scenario_id` per playthrough via `usedScenarioIds`).
7. Post-season (`/game/postseason/[season]`)
   - **`PostSeasonHubScreen`**: agency stats, case log (Season 1). **Season 1**: **View results** + **Season summary** (summary disabled until results done). **Season ≥ 2**: **Completed scenarios** (mandatory resolutions) + **Scenario history**; **Season summary** disabled until `postSeasonResolutionProgressBySeason` is complete for that season.
   - **`/game/postseason/[season]/results`** (Season 1): per scenario — arc completeness bar, outcome metrics, optional boost (reach costs EUR 5k, effectiveness costs 5 capacity; up to 5% from competence), or do nothing. Updates `run.outcome`, `run.postSeason`, `reputation`, `visibility`, EUR/capacity as applicable.
   - **`/game/postseason/[season]/resolutions`** (Season ≥ 2): one-by-one rollover review; **`arc_resolution`** text from JSON (3×3 reach × effectiveness buckets); **OK** advances `postSeasonResolutionProgressBySeason`. No EUR/capacity boosts here.
   - **`/game/postseason/[season]/history`** (Season ≥ 2): list of resolved rollover scenarios; **`/game/postseason/[season]/history/[clientId]`** — full arc trail (`arc_1`, midseason, `arc_2`, S2 action, `arc_resolution`, final metrics).
   - **`/game/postseason/[season]/summary`**: agency gains (post-season rep/vis where applicable), averages, liquidity / layoff pressure when relevant (see `docs/AGENCY_FINANCE.md`), toggles for **Scenario overview** and **Company financials** (operating P&amp;L + cash bridge; future receivables footnote). **Enter pre-season N+1** button (capped at 7).
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
- pre-season settlement: `payrollPaidBySeason` — per season key, set when pre-season **Start season** runs settlement for season 2+; used to block season hub / client case until pre-season is completed for that year
- payables: `payablesLines` — wage and severance lines (see `docs/AGENCY_FINANCE.md`)
- transitions: `preseasonEntrySpouseGrantSeasons`, `voluntaryLayoffsBySeason`
- **season entry scores**: `seasonEntryScoresBySeason` — per season key, `{ vScore, cScore }` frozen at **Start season** (see `settlePreseasonAndEnterSeason`, `docs/SEASON2_STRUCTURE.md`)
- **rollover progress**: `rolloverReviewProgressBySeason` — Season 2+ carry-over step index before new clients can roll
- **post-season resolution progress**: `postSeasonResolutionProgressBySeason` — Season ≥ 2 index through mandatory **completed scenarios** flow (`/resolutions`); must finish before **Season summary** unlocks
- **in-season client loop**: `seasonLoopBySeason` — optional map keyed by season string → `SeasonLoopState` (`plannedClientCount`, `currentClientIndex`, `clientsQueue`, `runs`, `lastOutcome`). Each `SeasonClientRun` may include **`postSeason`** after the post-season results flow, and **`season2CarryoverResolution`** after a Season 2 carry-over choice on that client. See `web/lib/seasonClientLoop.ts`.
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
- `web/lib/solutionOutcomeMath.ts`: campaign reach/effectiveness (archetype base + additive signed force; score-level jitter); **Season 1 vs Season 2** knot tables; carry-over variance helper (`computeCarryoverVarianceDeltasSeason2`)
- `web/lib/postSeasonResults.ts`: post-season boosts, rewards, `collectPostSeasonLedger`
- `web/lib/payablesReceivables.ts`: payables, receivables, liquidity, pre-season settlement
- `web/lib/seasonFinancials.ts`: season summary cash bridge, future receivables loop sum; legacy `computePayrollHeadsUp` (not used for gates)
- `web/components/PostSeasonHubScreen.tsx`, `PostSeasonResultsScreen.tsx`, `PostSeasonResolutionScreen.tsx`, `ScenarioHistoryListScreen.tsx`, `ScenarioHistoryDetailScreen.tsx`, `SeasonSummaryScreen.tsx`: post-season UI
- `web/components/PreSeasonScreen.tsx`: pre-season hub (focus, employees, breakdowns, season-start confirmation, liquidity block + fire modals)
- `web/app/game/preseason/[season]/payroll/page.tsx`: redirects to main pre-season
- `web/lib/employeeActions.ts`: voluntary vs mandatory (`fireEmployeeForPayrollShortfall`) layoffs
- `web/lib/preseasonTransition.ts`: post-season → next pre-season (spouse grant, capacity reset, intern expiry)
- `web/components/HiringScreen.tsx`: dedicated hiring flow and hire outcome modal
- `web/components/SeasonHubScreen.tsx`: season hub (roll queue, link to client case)
- `web/components/SeasonClientCaseScreen.tsx`: dedicated client scenario + solution choices
- `web/components/SeasonScreen.tsx`: re-exports `SeasonHubScreen` as `SeasonScreen`
- `web/lib/seasonClientLoop.ts`, `web/lib/scenarios.ts`: client queue, solution costs, scenario pick, `getScenarioById`
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
6. Post-season hub: **Season 1** — **View results**, complete every campaign (boost or not); verify EUR/capacity/rep/vis updates and breakdown lines. **Season ≥ 2** — **Completed scenarios** (`/resolutions`), OK each rollover until summary unlocks; optional **Scenario history** spot-check.
7. **Season summary**: check averages, financials toggle, liquidity / layoff pressure panel; **Enter pre-season N+1** goes to **`/game/preseason/[n]`**. From pre-season, **Start season** runs settlement and sets `payrollPaidBySeason`; direct navigation to **`/game/season/2`** should redirect back to pre-season if unsettled.

## Supabase status

- SQL schema exists in `supabase/migrations/20260407120000_initial_schema.sql`
- Web MVP currently runs from local save state (not yet writing these screens to Supabase).
- Deployment details: `docs/DEPLOYMENT.md`

## Safe next tasks for another agent

1. Optional UX: richer **soft vs hard** spend warnings outside hiring; extra onboarding copy for liquidity.
2. Extend client loop: Season 2 follow-up spend, multi-season post-season parity, reputation from non–Season-1 arcs.
3. Persist run state to Supabase (while keeping local fallback).
4. Add automated tests for:
   - save/load/continue path
   - non-negative budget guard behavior
   - deterministic candidate pool stability (hiring + client kind / budget rolls)
   - unique candidate name/description set guarantees
   - metric band selection
   - spouse modifier invariants
   - pre-season → season transition warning and phase routing
   - **season client queue**: roll idempotency, sequential index, reject = no credit, execute = net Season 1 liquid, **Continue to post-season** when queue fully resolved
   - **agency finance**: liquidity, `payrollPaidBySeason`, settlement, voluntary vs mandatory fire, hiring payables
