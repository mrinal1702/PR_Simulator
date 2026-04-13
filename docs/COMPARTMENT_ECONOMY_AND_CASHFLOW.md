# Compartment: economy and cash flow

Use for all agency money logic and season financial mechanics.

---

## Scope

- Cash flow, liquidity, receivables, payables
- Employee payroll and staffing-related cost pressure
- **Pre-season 3** mid-preseason wage increases from salary negotiation (`preseasonSalaryNegotiationV3`); see `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §6 for eligibility and rolls
- Client fees, tranche rollover logic, settlement timing
- Post-season spending impacts and boosts with monetary cost
- Profit calculation and season-level money interpretation

---

## Canonical references

- `docs/AGENCY_FINANCE.md`
- `docs/CLIENT_ECONOMY_MATH.md`
- `docs/SEASON2_STRUCTURE.md` (S2+ contract/rollover structure)

---

## Code anchors

- `web/lib/payablesReceivables.ts`
- `web/lib/preseasonSalaryNegotiation.ts` (PS3 raises + `applyPayRaise`; `settlePreseasonAndEnterSeason` clears negotiation state)
- `web/lib/preseasonTransition.ts` (seeds PS3 asks when entering pre-season 3)
- `web/lib/clientEconomyMath.ts`
- `web/lib/seasonFinancials.ts`
- `web/lib/gameEconomy.ts`
- `web/lib/postSeasonResults.ts`

---

## Guardrails

- Preserve the design rule from `README.md`: money scales strongly for reach, weakly for convincingness/stability.
- Separate clearly:
  - player cash (`EUR`)
  - client fee economics
  - accounting-like movement (receivable/payable timing)
- Any contract split or rollover rule change should be documented with examples.

---

## Cross-system synergies

- Hiring and layoffs directly reshape payables, liquidity, and season-start payroll pressure.
- PS3 salary accept/refuse flows update wage payables and roster stats; same liquidity rules as hiring (`liquidityEur`).
- Settlement at season start writes frozen entry scores used by Season 2+ roll and outcome systems.
- Campaign and carry-over spending reduce the same EUR/capacity pools used by post-season boosts.
- Post-season reach/effectiveness choices create both stat deltas and spend lines that affect profit views.
- For upstream/downstream impact checks, use `docs/SYSTEM_SYNERGY_MAP.md`.

---

## Open documentation tasks

- Add a single "money timeline" table for one full season cycle.
- Document exact profit formula with included/excluded lines.
- Document edge cases: low liquidity, unpaid obligations, rollover overlap.

---

## Last updated for

- Pre-season 3 salary negotiation economy hooks and code anchors.
