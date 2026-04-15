# Compartment: randomness and normalization

Use for deterministic seed contracts, score normalization, clamp behavior, and threshold mapping.

---

## Scope

- Hash/seed deterministic rolls across hiring, clients, outcomes, and scenario picking
- **Hiring attract** inputs: season-keyed normalization of reputation and agency competence/visibility for hidden hire skill (`benchmarkHiringAttract.ts`; Season 1 reuses Season 1 V/C knots from `solutionOutcomeMath.ts`; Season 2 uses `benchmarkSeason2Scores.ts`; season ≥ 3 uses **blended** S2+S3 μ/σ — see `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §3)
- Season 1 vs Season 2+ score normalization paths
- Clamp and threshold behavior for stats and outcomes
- Frozen season-entry scores versus live mutable resources

---

## Canonical references

- `docs/SEASON2_STRUCTURE.md`
- `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md`
- `docs/AGENT_CONTEXT.md`

---

## Code anchors

- `web/lib/metricScales.ts`
- `web/lib/benchmarkSeason2Scores.ts`
- `web/lib/benchmarkSeason3Scores.ts` (constants averaged into hiring attract for season ≥ 3)
- `web/lib/benchmarkHiringAttract.ts` (hiring-only rep / V / C normalization by season)
- `web/lib/solutionOutcomeMath.ts`
- `web/lib/clientEconomyMath.ts`
- `web/lib/hiring.ts`
- `web/lib/scenarios.ts`
- `web/lib/postSeasonResults.ts`
- `web/lib/seasonCarryover.ts`

---

## 1) Seed registry (deterministic contracts)

| Area | Seed style | Function path | Output |
|---|---|---|---|
| Scenario selection | caller-provided seed, hashed index | `scenarios.ts` `hashPickIndex` | deterministic candidate pick |
| Hiring productivity | `{bucketSeed}|c{idx}` + `|prod` | `hiring.ts` | `0..80` productivity |
| Hiring skill variance | `{bucketSeed}|c{idx}` + `|skill` | `hiring.ts` | deterministic skill variation (after **attract** from live rep + effective V/C via `benchmarkHiringAttract.ts` for the pre-season **season** number) |
| Hiring split tilt | `seed|split` | `hiring.ts` | competence/visibility split tilt |
| Client slots per season | `...|season1|slots` or `...|s{season}|slots` | `clientEconomyMath.ts` | 2 vs 3 clients |
| S2 kind/tier/budget | `...|s2|kind|i`, `...|s2|tier|i`, `...|s2|bud|i` | `clientEconomyMath.ts` | deterministic S2 client roll |
| Satisfaction weight jitter | `{seedBase}-satw-{season}-{i}` | `seasonClientLoop.ts` | per-client reach weight |
| Outcome score jitter | `seed` + `v-score-jitter` / `c-score-jitter` | `solutionOutcomeMath.ts` | jittered V/C score inputs |
| Post-season boost jitter | `createdAt|postseason|season|client|choice` | `postSeasonResults.ts` | S2 boost point jitter |
| Carry-over variance | caller-provided seed | `seasonCarryover.ts` + `solutionOutcomeMath.ts` | deterministic deltas |

Seed policy:

- Changing seed composition is a gameplay-breaking change for reproducibility.
- If changed intentionally, document migration rationale and expected behavioral drift.

---

## 2) Normalization systems

### Season 1 normalization (piecewise knots)

`solutionOutcomeMath.ts`:

- `visibilityScoreForVariance(visibility)` from `VISIBILITY_SCORE_KNOTS_SEASON1`
- `competenceScoreForVariance(competence)` from `COMPETENCE_SCORE_KNOTS_SEASON1`
- discipline also uses knot mapping `disciplineScoreForVariance`

These are non-linear piecewise maps from raw stat -> `0..100`.

### Season 2+ benchmark normalization

`benchmarkSeason2Scores.ts`:

- visibility score:
  - `z = (max(0, raw) - mu_vis) / sigma_vis`
  - `score = clamp(50 + 10*z, 0, 100)`
- competence score:
  - `z = (max(0, raw) - mu_comp) / sigma_comp`
  - `score = clamp(50 + 10*z, 0, 100)`

Current benchmark constants:

- `SEASON2_BENCHMARK_VISIBILITY_MEAN = 81`
- `SEASON2_BENCHMARK_VISIBILITY_STD = 30.519854182245947`
- `SEASON2_BENCHMARK_COMPETENCE_MEAN = 81`
- `SEASON2_BENCHMARK_COMPETENCE_STD = 30.736628483871677`

---

## 3) Outcome force model and jitter

`solutionOutcomeMath.ts` uses the same additive-force model for Season 1 and Season 2+:

- driver mix:
  - reach driver: `0.6*V + 0.35*C`
  - effectiveness driver: `0.7*C + 0.25*discipline`
- centered normalization: `(score - 50) / 50`
- force curve: `tanh(FORCE_CURVE_K * centered) * maxAbs`
- full campaign force span: `maxAbs = 20` (approx `-20..+20`)
- carry-over variance span: `maxAbs = 10`

Jitter caps:

- visibility score jitter max: `5.5`
- competence score jitter max: `3.5`

---

## 4) Frozen vs live numbers

Frozen at season start:

- `seasonEntryScoresBySeason[seasonKey] = { vScore, cScore }`
- populated on `settlePreseasonAndEnterSeason` in `payablesReceivables.ts`

Used as frozen references for:

- Season 2+ client count probability inputs
- Season 2+ client type/tier rolls
- Season 2+ budget roll behavior
- some post-season boost behavior (`cScore` usage)

Live mutable during season:

- `resources.visibility`, `resources.competence`
- `reputation`
- current cash/capacity and other save fields

---

## 5) Clamp and threshold registry

### Scale clamps

`metricScales.ts`:

- reputation range: `-100..200`
- visibility range: `0..1000`
- competence range: `0..1000`
- `clampToScale` is canonical for these metrics

### Outcome clamps

- Reach/effectiveness/satisfaction computations clamp to `0..100` where applicable.
- Carry-over do-nothing decay is `-5` each metric then clamped.

### Notable thresholds

- `reach >= 50` / `effectiveness >= 50` for high/low branch labels in multiple arc paths
- Arc-resolution 3x3 in post-season:
  - reach: `<=35 low`, `36..67 medium`, `>=68 high`
  - effectiveness: `<=35 poor`, `36..67 good`, `>=68 convincing`

---

## Guardrails

- Keep threshold definitions centralized and mirrored in docs when changed.
- Avoid silent drift between:
  - normalization in `solutionOutcomeMath.ts`
  - roll logic in `clientEconomyMath.ts`
  - post-season mapping in `postSeasonResults.ts`
- For balancing changes, record old and new benchmark assumptions.

---

## Cross-system synergies

- Seed contracts influence reproducibility across hiring, client generation, and post-season outcomes.
- Normalization constants simultaneously affect roll quality, outcome variance, and post-season reward curves.
- Threshold drift can desync narrative arc branches from underlying score math.
- Clamp choices affect economy balance indirectly by changing reward and roll distributions over long runs.
- Use `docs/SYSTEM_SYNERGY_MAP.md` when touching seeds, thresholds, or benchmark constants.

---

## Change checklist (for this compartment)

- If you touch normalization constants in `benchmarkSeason2Scores.ts`, update:
  - constants table in this doc
  - references in `SEASON2_STRUCTURE.md`
- If you touch **`benchmarkHiringAttract.ts`** blended μ/σ or season branches, update:
  - hiring seed registry notes (attract path) in this doc
  - `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §3
- If you touch seed strings, update seed registry and call out reproducibility impact.
- If you touch thresholds (50, 35/67, jitter caps), update branch mapping notes.

---

## Last updated for

- Deterministic seed contracts and normalization formulas documentation pass.
- Hiring attract normalization (`benchmarkHiringAttract.ts`) and seed table note.
