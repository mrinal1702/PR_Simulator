# Compartment: scenario architecture

Use for scenario data model, deterministic runtime selection, and arc text resolution behavior.

---

## Scope

- Scenario JSON schema and authoring contracts
- Runtime merge and deterministic pick behavior
- Solution archetype coupling between scenario copy and gameplay systems
- Arc mapping (`arc_1`, `arc_2`, `arc_resolution`) and threshold behavior
- Scenario uniqueness and pool exhaustion handling

---

## Canonical references

- `docs/SCENARIO_CREATIVE_GUIDELINES.md`
- `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md`
- `docs/SEASON2_STRUCTURE.md`

---

## Code anchors

- `web/lib/scenarios.ts`
- `web/lib/seasonClientLoop.ts`
- `web/lib/postSeasonResults.ts`
- `web/data/scenario_database.json`
- `web/data/scenarios_individual.json`
- `web/data/scenarios_small_company.json`
- `web/data/scenarios_corporate.json`

---

## 1) Data architecture

### Source files

- `scenario_database.json`: metadata + glossary (not full scenario row pool)
- split scenario row pools:
  - `scenarios_individual.json`
  - `scenarios_small_company.json`
  - `scenarios_corporate.json`

### Runtime merge

`web/lib/scenarios.ts` builds a merged in-memory `scenarioDatabase` with all split `scenarios` arrays.

---

## 2) Schema contract (runtime-critical fields)

Each scenario row is expected to contain:

- Identity:
  - `scenario_id`
  - `client_type`
  - `budget_tier`
  - `client_subtype`
  - optional typed `client_name` in code path
- Intake:
  - `scenario_title`
  - `problem_summary`
- Solution copy:
  - `solutions` array with archetype IDs `1..4` (one each)
  - each solution has `solution_name`, `solution_brief`
- Arc text:
  - `arc_1` with 2x2 keys (high/low reach/effectiveness combinations)
  - `arc_2` with follow-up branch text (same 2x2 keys used in runtime pulls)
  - `arc_resolution` with 3x3 keys (`low|medium|high` x `poor|good|convincing`)

---

## 3) Deterministic pick and fallback order

Selection function: `pickScenarioForClient(kind, budgetTier, seed, excludeIds)`.

Fallback order when trying to choose candidates:

1. same client type + requested budget tier band
2. same client type regardless of budget tier
3. global unused scenarios regardless of type/tier
4. if none unused -> throw `SCENARIO_POOL_EXHAUSTED_MESSAGE`

Pick index inside candidate set is deterministic via hash of seed.

---

## 4) Uniqueness model in season generation

`buildSeasonClients` in `seasonClientLoop.ts`:

- receives `usedScenarioIds` from save
- tracks `exclude` set through current season generation loop
- each pick adds `scenario_id` to exclusion set immediately
- returns updated `usedScenarioIds` so uniqueness persists across seasons

Design effect:

- scenario reuse is prevented until pool exhaustion conditions are reached.

---

## 5) Solution archetype contract

Important coupling:

- scenario JSON defines creative labels via `solution_archetype_id` mapping (1..4)
- gameplay math and costing are owned by fixed archetypes in `seasonClientLoop.ts`
  - base spread/effectiveness profiles
  - cost profiles (Season 1 and Season 2+)

Runtime behavior:

- UI option cards are priced from archetype logic
- names/descriptions are then overlaid from scenario row copy via `mergeScenarioSolutionCopy`

---

## 6) Arc text mapping behavior

### 2x2 mapping paths

Threshold helper in multiple paths:

- high if metric `> 50` (or `>= 50` for some carry-over labels)
- keys:
  - `low_visibility_low_effectiveness`
  - `low_visibility_high_effectiveness`
  - `high_visibility_low_effectiveness`
  - `high_visibility_high_effectiveness`

Used in:

- post-season branch text for `arc_1` / fallback narrative
- Season 2 carry-over branch extraction from `arc_2` in client generation

### 3x3 arc resolution mapping

`buildArcResolutionText` in `postSeasonResults.ts`:

- reach label:
  - `<=35 low`, `36..67 medium`, `>=68 high`
- effectiveness label:
  - `<=35 poor`, `36..67 good`, `>=68 convincing`
- final lookup:
  - `arc_resolution[reachLabel][effLabel]`

---

## 7) End-to-end flow (runtime)

1. Client roll decides kind/tier.
2. `pickScenarioForClient` picks scenario deterministically with uniqueness guards.
3. `buildSeasonClients` stores:
   - scenario id/title/problem
   - scenario solution copy
   - carry-over arc outcomes from `arc_2`
4. `buildSolutionOptionsForClientWithScenario` applies creative names onto fixed priced archetypes.
5. Outcome resolution computes final metrics.
6. Post-season text uses threshold-to-key mapping for `arc_1`/`arc_resolution` displays.

---

## Guardrails

- Keep scenario copy decoupled from direct EUR or capacity formulas.
- Do not remap archetype IDs without auditing:
  - `seasonClientLoop.ts`
  - economy docs
  - outcome docs
- Threshold changes require docs + copy-path verification.

---

## Cross-system synergies

- Scenario pick uniqueness changes alter long-run variety and can bias economy/outcome distributions.
- Archetype-ID contracts couple scenario authoring to pricing and scoring systems.
- Arc threshold rules must stay aligned with post-season resolution math and player-facing labels.
- Scenario copy overlays should not hide mechanical cost/performance assumptions from balancing docs.
- Use `docs/SYSTEM_SYNERGY_MAP.md` when editing schema contracts or selection behavior.

---

## Change checklist (for this compartment)

- If you change fallback order in `pickScenarioForClient`, update this doc and `SCENARIO_CREATIVE_GUIDELINES.md`.
- If you change arc threshold behavior, update this doc and `POST_SEASON.md`.
- If you add schema fields needed by runtime logic, document required/optional status here.

---

## Last updated for

- Scenario schema/runtime architecture documentation pass.
