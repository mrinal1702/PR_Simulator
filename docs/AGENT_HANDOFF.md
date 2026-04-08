# Agent Handoff (Current Game State)

Use this file as the fastest context for a fresh agent.

## Product state

- Deployed web app with onboarding, pre-season flow, and early season hub.
- Single local save slot is active (`dma-save-slot`) with Continue routing.
- Seasons are planned through season 7; season gameplay proper is still a placeholder, but season entry flow is now active.

## Implemented flow

1. Home (`/`)
   - `Continue` (enabled when save exists) and `New game`.
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
5. Season screen (`/game/season/[season]`)
   - Shows agency stats and employees panels
   - Hides Talent Bazaar (pre-season-only)
   - Provides `Invite client` action button (placeholder)
6. Placeholder route remains:
   - `/game/postseason/[season]`

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

Primary location: `web/lib/gameEconomy.ts`

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
- `web/components/PreSeasonScreen.tsx`: pre-season hub (focus, employees, breakdowns, season-start confirmation)
- `web/components/HiringScreen.tsx`: dedicated hiring flow and hire outcome modal
- `web/components/SeasonScreen.tsx`: early in-season hub
- `web/lib/hiring.ts`: candidate generation, band logic, productivity/capacity mapping, campaign manager split
- `web/lib/budgetGuard.ts`: non-negative EUR guard helpers

## Supabase status

- SQL schema exists in `supabase/migrations/20260407120000_initial_schema.sql`
- Web MVP currently runs from local save state (not yet writing these screens to Supabase).
- Deployment details: `docs/DEPLOYMENT.md`

## Safe next tasks for another agent

1. Implement `Invite client` flow and first in-season client interaction loop.
2. Extend stat breakdown ledger to include client-driven deltas/events (keep zero-line suppression behavior).
3. Add intern expiry after one season transition.
4. Persist run state to Supabase (while keeping local fallback).
5. Add automated tests for:
   - save/load/continue path
   - non-negative budget guard behavior
   - deterministic candidate pool stability
   - unique candidate name/description set guarantees
   - metric band selection
   - spouse modifier invariants
   - pre-season->season transition warning and phase routing.

