# Compartment: scoring and outcomes

Use for V-score/C-score math, scenario resolution, and season-dependent outcome logic.

---

## Scope

- How scenario outcomes are calculated
- V-score and C-score derivation and thresholds
- Season 1 vs Season 2+ differences in outcome resolution
- Reach/effectiveness/stability interpretation and impact

---

## Canonical references

- `docs/SEASON2_STRUCTURE.md`
- `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md`
- `docs/POST_SEASON.md` (downstream effects)

---

## Code anchors

- `web/lib/solutionOutcomeMath.ts`
- `web/lib/benchmarkSeason2Scores.ts`
- `web/lib/seasonClientLoop.ts` (`resolveClientOutcome` and related flow)
- `web/lib/metricScales.ts`
- `web/lib/metricBreakdown.ts`

---

## Guardrails

- Keep season-specific logic explicit and documented (no hidden branching assumptions).
- Document threshold changes with before/after examples.
- Keep player-facing interpretation aligned with internal score math.

---

## Cross-system synergies

- Season-entry V/C scores are frozen at settlement and reused by Season 2+ roll logic and some post-season calculations.
- Outcome reach/effectiveness feed satisfaction, which feeds reputation/visibility gain curves in post-season.
- Scenario archetype base profiles (cost and effectiveness shape) come from client/campaign architecture, not scenario prose.
- Carry-over variance uses the same normalization family as Season 2+ outcomes and must remain aligned.
- For non-local impacts, check `docs/SYSTEM_SYNERGY_MAP.md`.

---

## Open documentation tasks

- Add a compact formula sheet for V-score/C-score inputs and weighting.
- Add threshold table for each season stage.
- Add one worked example from inputs to final outcome.

---

## Last updated for

- Initial compartment setup for doc-first memory workflow.
