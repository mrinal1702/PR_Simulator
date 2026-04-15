# Knowledge system for low-context chats

Purpose: keep durable project memory in files, not chat history.

Use this file as the entry point for future sessions. Start here, then read only the compartment that matches the task.

---

## How to use in future chats

1. State the task in one line.
2. Open this file.
3. Open only the relevant compartment doc(s).
4. Make code changes.
5. Update the touched compartment doc before ending the session.

This keeps each session small and reduces repeated context loading.

---

## Compartment map

| Compartment | Scope | Primary docs | Main code anchors |
|---|---|---|---|
| Player flow and screens | Navigation and phase transitions | `docs/COMPARTMENT_PLAYER_FLOW.md`, `docs/AGENT_CONTEXT.md` | `web/lib/saveGameStorage.ts`, `web/lib/preseasonTransition.ts`, route screens in `web/app/game/**` |
| Economy and cash flow | Cash, receivables, payables, payroll, contracts | `docs/COMPARTMENT_ECONOMY_AND_CASHFLOW.md`, `docs/AGENCY_FINANCE.md`, `docs/CLIENT_ECONOMY_MATH.md` | `web/lib/payablesReceivables.ts`, `web/lib/preseasonSalaryNegotiation.ts` (PS3 wage bumps), `web/lib/clientEconomyMath.ts`, `web/lib/seasonFinancials.ts`, `web/lib/gameEconomy.ts` |
| Scoring and scenario outcomes | V/C score logic, outcome resolution, season differences | `docs/COMPARTMENT_SCORING_AND_OUTCOMES.md`, `docs/SEASON2_STRUCTURE.md`, `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` | `web/lib/solutionOutcomeMath.ts`, `web/lib/benchmarkSeason2Scores.ts`, `web/lib/seasonClientLoop.ts` |
| Clients, rolls, carry-over, budgets | Client count/type rolls, carry-over flow, fee levels | `docs/COMPARTMENT_CLIENT_ROLLS_AND_BUDGETS.md`, `docs/SEASON2_STRUCTURE.md` | `web/lib/seasonClientLoop.ts`, `web/lib/seasonCarryover.ts`, `web/lib/clientEconomyMath.ts` |
| Agency stats and boosts | Reputation/resources updates and post-season boosts | `docs/COMPARTMENT_AGENCY_STATS_AND_BOOSTS.md`, `docs/POST_SEASON.md` | `web/lib/postSeasonResults.ts`, `web/lib/agencyStatAudit.ts`, `web/lib/metricBreakdown.ts` |
| Talent and workforce math | Hiring quality, productivity, tenure capacity, layoffs, roster skill %, PS3 salary asks | `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md`, `docs/AGENCY_FINANCE.md` | `web/lib/hiring.ts`, `web/lib/benchmarkHiringAttract.ts`, `web/lib/employeeSkillDisplay.ts`, `web/lib/preseasonSalaryNegotiation.ts`, `web/lib/tenureCapacity.ts`, `web/lib/employeeActions.ts`, `web/lib/shoppingCenter.ts`, `web/lib/preseasonTransition.ts`, `web/components/PreSeasonScreen.tsx`, `web/components/HiringScreen.tsx` |
| Scenario architecture | Scenario schema, deterministic pick, arc mapping | `docs/COMPARTMENT_SCENARIO_ARCHITECTURE.md`, `docs/SCENARIO_CREATIVE_GUIDELINES.md` | `web/lib/scenarios.ts`, `web/lib/postSeasonResults.ts`, `web/data/scenarios_*.json` |
| Randomness and normalization | Deterministic seeds, score transforms, clamps | `docs/COMPARTMENT_RANDOMNESS_AND_NORMALIZATION.md`, `docs/SEASON2_STRUCTURE.md` | `web/lib/solutionOutcomeMath.ts`, `web/lib/benchmarkSeason2Scores.ts`, `web/lib/metricScales.ts` |

---

## Cross-system dependencies

When a change spans more than one compartment, always load:

- `docs/SYSTEM_SYNERGY_MAP.md`

Treat it as the checklist for "what else must be updated."

---

## Update rules

- Keep formulas and constants in docs close to their code source.
- Link to file paths directly instead of copying large code blocks.
- When a rule changes, update both:
  - the compartment doc
  - the canonical domain doc (if one exists)
- Add a short "last updated for" note with the feature name.
- For cross-system changes, update `docs/SYSTEM_SYNERGY_MAP.md` too.

---

## Session handoff template

Copy this into the end of each implementation chat:

- Scope touched:
- Files changed:
- Compartment docs updated:
- Mechanical behavior changed:
- Follow-up checks needed:
