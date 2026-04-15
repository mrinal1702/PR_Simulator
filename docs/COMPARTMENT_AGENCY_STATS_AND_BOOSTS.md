# Compartment: agency stats and boosts

Use for updates to agency resources/reputation and boost application logic.

---

## Scope

- Resource and reputation changes after scenarios
- Client satisfaction and reputation boost outcomes
- Post-season boost mechanics and costs
- Correct stat propagation into subsequent phases/seasons

---

## Canonical references

- `docs/POST_SEASON.md`
- `docs/SEASON2_STRUCTURE.md`
- `docs/AGENT_CONTEXT.md` (save fields and flow references)

---

## Code anchors

- `web/lib/postSeasonResults.ts`
- `web/lib/agencyStatAudit.ts`
- `web/lib/metricBreakdown.ts`
- `web/lib/solutionOutcomeMath.ts`
- `web/lib/seasonClientLoop.ts`

---

## Guardrails

- All boosts should have a clear source event and one write path to save state.
- Ensure no double-application across route reloads.
- Keep season-sensitive rewards explicit and testable.

---

## Cross-system synergies

- Post-season gains are a downstream effect of campaign outcomes and satisfaction weighting logic.
- Carry-over resolution writes season-close stat gains on a different timeline than fresh-scenario post-season boosts.
- Reputation and raw competence/visibility changes feed next-season **client roll quality** (benchmark-normalized in Season 2+) and **Talent Bazaar hire quality**: `HiringScreen` passes **effective** competence/visibility (`getEffectiveCompetenceForAgency` / `getEffectiveVisibilityForAgency`) into `generateCandidates`, which maps them through **`hiringAttractChannels`** in `benchmarkHiringAttract.ts` by **pre-season season number** (Season 1 knots, Season 2 grid μ/σ, **averaged Season 2+Season 3 μ/σ** for season ≥ 3). See `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §3.
- Spending on boosts competes with payroll/liquidity requirements and can indirectly increase layoff pressure.
- For dependency checks, use `docs/SYSTEM_SYNERGY_MAP.md`.

---

## Open documentation tasks

- Add stat update matrix (trigger -> stat delta -> save fields touched).
- Add season-based reward difference table.
- Add audit checklist for "expected vs actual stat deltas."

---

## Last updated for

- Initial compartment setup for doc-first memory workflow.
- Hiring attract linkage: effective V/C, `benchmarkHiringAttract`, season-keyed normalization.
