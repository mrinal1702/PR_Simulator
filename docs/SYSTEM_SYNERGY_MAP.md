# System synergy map

Purpose: document where one game system drives another, so changes do not drift across compartments.

---

## Coverage status

Core gameplay mechanics are now covered by compartment docs:

- player flow
- economy/cash flow
- scoring/outcomes
- client rolls/budgets
- agency stats/boosts
- talent/workforce math
- scenario architecture
- randomness/normalization

This file is the cross-system glue.

---

## Primary dependency chains

| Upstream system | Downstream systems affected | Key code anchors |
|---|---|---|
| Build/spouse/new-game choices | Starting stats, early economy headroom, first-season strategy space | `web/lib/gameEconomy.ts`, `web/components/NewGameWizard.tsx` |
| Pre-season focus choice | Competence/visibility totals -> Season entry V/C scores -> client roll quality and outcomes | `web/lib/preseasonFocus.ts`, `web/lib/payablesReceivables.ts`, `web/lib/clientEconomyMath.ts` |
| Hiring outcomes (skill/productivity) | Competence/visibility/capacity changes + wage payables -> liquidity pressure and layoff risk | `web/lib/hiring.ts`, `web/lib/payablesReceivables.ts`, `web/lib/employeeActions.ts` |
| Pre-season 3 salary negotiations | Wage payable + salary bumps or mandatory fire; blocks season hub until resolved; liquidity + shopping EUR | `web/lib/preseasonSalaryNegotiation.ts`, `web/lib/preseasonTransition.ts`, `web/lib/payablesReceivables.ts`, `web/components/PreSeasonScreen.tsx`, `web/components/HiringScreen.tsx` |
| Shopping center purchases | Immediate EUR changes, seasonal spouse bonus, hiring multipliers, downstream stat growth | `web/lib/shoppingCenter.ts`, `web/lib/preseasonTransition.ts` |
| Season-start settlement | Receivables/payables settlement + payroll flags + frozen entry V/C snapshot for season logic | `web/lib/payablesReceivables.ts` |
| Client roll pipeline | Client count/type/tier/budgets -> scenario selection -> campaign option costs | `web/lib/clientEconomyMath.ts`, `web/lib/seasonClientLoop.ts`, `web/lib/scenarios.ts` |
| Scenario architecture | Creative copy overlays fixed archetypes; arc text drives post-season narrative mapping | `web/lib/scenarios.ts`, `web/lib/seasonClientLoop.ts`, `web/lib/postSeasonResults.ts` |
| Campaign choices and outcomes | EUR/capacity spend + reach/effectiveness/satisfaction -> post-season deltas and carry-over state | `web/lib/seasonClientLoop.ts`, `web/lib/solutionOutcomeMath.ts`, `web/lib/postSeasonResults.ts`, `web/lib/seasonCarryover.ts` |
| Post-season and carry-over resolution | Reputation/visibility updates and resource spend -> next season rolls and hiring quality | `web/lib/postSeasonResults.ts`, `web/lib/seasonCarryover.ts`, `web/lib/clientEconomyMath.ts`, `web/lib/hiring.ts` |
| Metric scales/clamps | Bounds and labels for reputation/visibility/competence across all systems | `web/lib/metricScales.ts` |

---

## High-risk synergy points (change together)

1. **Normalization constants and S2 roll logic**
   - If `benchmarkSeason2Scores.ts` constants change, revisit:
     - `clientEconomyMath.ts` (S2 client count and tier behavior)
     - `solutionOutcomeMath.ts` (S2 outcome scoring)
     - `SEASON2_STRUCTURE.md` and randomness compartment docs

2. **Solution archetype semantics**
   - If archetype costs/bases change in `seasonClientLoop.ts`, revisit:
     - scenario architecture docs (ID contracts)
     - economy docs (pricing implications)
     - scoring docs (base profile assumptions)

3. **Layoff and payroll settlement rules**
   - If `employeeActions.ts`, `payablesReceivables.ts`, or `preseasonSalaryNegotiation.ts` changes, revisit:
     - economy/cash flow compartment
     - talent/workforce compartment (including PS3 §6)
     - agency stats compartment (rep impacts)

4. **Carry-over and post-season reward logic**
   - If `seasonCarryover.ts` or `postSeasonResults.ts` changes, revisit:
     - scoring/outcomes
     - agency stats/boosts
     - client rolls/budgets (next-season effects)

---

## Verification loop after cross-system changes

Use this minimum sequence:

1. Run impacted simulation scripts under `web/scripts/`.
2. Check one full season transition (`preseason` -> `season` -> `postseason` -> next `preseason`).
3. Confirm:
   - settlement math
   - entry score snapshot correctness
   - post-season stat deltas
   - continuity of `phase` and `seasonNumber`
4. Update touched compartment docs plus this synergy map.

---

## Last updated for

- Pre-season 3 salary negotiation dependency chain and layoff/payroll synergy note.
