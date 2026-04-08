# Agent Handoff (Current Game State)

Use this file as the fastest context for a fresh agent.

## Product state

- Deployed web app with onboarding and pre-season MVP flow.
- Single local save slot is active (`dma-save-slot`) with Continue routing.
- Seasons are planned through season 7; only pre-season activity loop is implemented so far.

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
   - `Save` button
4. Placeholder routes exist for future flow safety:
   - `/game/season/[season]`
   - `/game/postseason/[season]`

## Save model (single slot)

Source type: `NewGamePayload` in `web/components/NewGameWizard.tsx`.

Persisted fields:
- identity: `playerName`, `agencyName`, `gender`
- run setup: `buildId`, `spouseType`, `spouseName`, `spouseGender`
- loop state: `seasonNumber`, `phase`, `activityFocusUsedInPreseason`
- metrics: `resources` (`eur`, `competence`, `visibility`, `firmCapacity`)
- derived: `reputation`
- metadata: `createdAt`

Storage helpers: `web/lib/saveGameStorage.ts`
- `loadSave()`
- `persistSave(payload)`
- `getContinuePath(save)`

Notes:
- Saves are written to both `sessionStorage` and `localStorage`.
- Older session-only save is auto-migrated to local storage on load.

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
- `web/components/PreSeasonScreen.tsx`: pre-season activity + agency stats + manual save

## Supabase status

- SQL schema exists in `supabase/migrations/20260407120000_initial_schema.sql`
- Web MVP currently runs from local save state (not yet writing these screens to Supabase).
- Deployment details: `docs/DEPLOYMENT.md`

## Safe next tasks for another agent

1. Build employee hiring in pre-season (without breaking activity-focus one-time rule).
2. Implement season/post-season gameplay screens and transitions.
3. Persist run state to Supabase (while keeping local fallback).
4. Add centralized phase router utility if loop grows beyond 3 phases.
5. Add automated tests for:
   - save/load/continue path
   - metric band selection
   - spouse modifier invariants.

