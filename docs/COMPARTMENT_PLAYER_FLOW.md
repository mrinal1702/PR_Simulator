# Compartment: player flow and screens

Use for anything related to progression between screens and phases.

---

## Scope

- Main landing and new game setup (build/spouse choices)
- Pre-season, season, post-season, summary sequencing
- Season transition behavior (including entry reveal)
- **Pre-season 3** salary negotiation modal and gating (Start season / Talent Bazaar until resolved)
- Shopping center access and placement in flow

---

## Canonical references

- `docs/AGENT_CONTEXT.md` (routes and save highlights)
- `README.md` (high-level game loop)
- `docs/POST_SEASON.md` (post-season behavior)

---

## Code anchors

- `web/lib/saveGameStorage.ts` (`getContinuePath`, save/phase mapping)
- `web/lib/preseasonTransition.ts` (post-season to next pre-season transition)
- `web/app/game/preseason/**`
- `web/components/PreSeasonScreen.tsx`, `web/components/PreseasonSalaryNegotiationModal.tsx` (PS3 salary flow)
- `web/app/game/season/**`
- `web/app/game/postseason/**`
- `web/lib/shoppingCenter.ts`

---

## Current phase model

- `preseason`
- `season`
- `postseason`

Transition correctness depends on `seasonNumber` + `phase` consistency.

---

## Cross-system synergies

- Pre-season flow gates economy settlement and freezes season-entry scores (`payablesReceivables.ts`).
- Season flow consumes capacity/EUR and writes outcome state used by post-season and carry-over systems.
- Post-season completion gates next pre-season transition and determines whether stat gains are fully applied.
- Continue-path routing depends on save shape consistency (`phase`, `seasonNumber`, loop progress fields).
- For cross-system impacts, check `docs/SYSTEM_SYNERGY_MAP.md`.

---

## Open documentation tasks

- Clarify exact shopping center entry/exit points in season flow.
- Add one short screen contract per major route:
  - inputs from save
  - actions allowed
  - outputs persisted to save

---

## Last updated for

- Pre-season 3 salary negotiation UI gating and code anchors.
