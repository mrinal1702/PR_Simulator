# Compartment: client rolls and budgets

Use for logic that determines client volume, type, and fee levels.

---

## Scope

- How many clients roll in a season (2 vs 3, etc.)
- Client type/profile selection based on stats and scores
- Budget/fee determination for rolled clients
- Carry-over client behavior and rollover interactions

---

## Canonical references

- `docs/SEASON2_STRUCTURE.md`
- `docs/CLIENT_ECONOMY_MATH.md`

---

## Code anchors

- `web/lib/seasonClientLoop.ts`
- `web/lib/seasonCarryover.ts`
- `web/lib/clientEconomyMath.ts`
- `web/lib/preseasonFocus.ts`
- `web/lib/clientSatisfactionMood.ts`

---

## Guardrails

- Keep random roll rules deterministic where seeded/tested.
- Distinguish clearly between:
  - client generation rules
  - client fee assignment
  - client outcome/satisfaction resolution
- Any season-based roll rule difference must be documented in one place first.

---

## Cross-system synergies

- Client count/type/tier rolls depend on season-entry snapshots, reputation, and visibility normalization.
- Rolled budgets feed both campaign option pricing and receivable/payable timing via tranche splits.
- Scenario selection during client build affects downstream arc text and post-season narrative branches.
- Carry-over completion gates rolling fresh Season 2 clients and therefore changes seasonal cash and capacity rhythm.
- For cross-compartment dependencies, review `docs/SYSTEM_SYNERGY_MAP.md`.

---

## Open documentation tasks

- Add roll table with inputs and output ranges.
- Document budget/fee bands by client class and season.
- Add edge case notes for low-stat and high-stat extremes.

---

## Last updated for

- Initial compartment setup for doc-first memory workflow.
