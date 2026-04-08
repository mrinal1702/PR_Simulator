# Reputation Recovery Simulator — Design Brief

Use this document to align AI agents and contributors on **what the game is**, **core systems**, and **one rule that must not drift**.

---

## Elevator pitch

**Decision-driven simulation** where the player runs a **PR / reputation management agency**: take clients with reputation problems, choose strategies, allocate resources, and manage tradeoffs between short-term wins and long-term credibility.

- **System-driven**, replayable, lightly narrative (humor and irony through outcomes).
- **Not** a realistic PR simulator; **prioritize clarity and fun** over realism.

---

## Player identity

The player is the **founder of a PR / reputation firm** — clear, grounded, always agency-first.

---

## Starting builds (backgrounds)

| Build | Profile |
|--------|---------|
| **Millionaire Founder** | High wealth · medium competence · medium visibility · high risk sensitivity |
| **Elite Graduate** | High competence · low wealth · low visibility |
| **Social Influencer** | High visibility · low competence · medium wealth |

Builds affect starting stats, client types, discipline tendencies, and playstyle.

---

## Optional meta

- **Spouse**: passive bonuses (e.g. wealth, competence, or visibility).
- **Growth focus**: **Build Skills** → passive competence · **Network** → passive visibility.

---

## Core resources (player-controlled)

1. **Wealth** — numeric; primarily increases **reach** of campaigns; also contributes **modestly** to outcome effectiveness (see scaling below).
2. **Visibility (influence)** — affects client quality, client volume, and scale of opportunities.
3. **Competence** — drives how well solutions are executed and how convincing strategies are.

## Derived metric (not directly spent)

**Reputation** — long-term outcome of performance; influences future clients, difficulty, and trust in the agency. **Not** a spendable currency.

---

## Money: reach vs effectiveness

- **Reach**: **Wealth scales strongly** here — the main lever money buys is **how many people see** the campaign.
- **Effectiveness (convincingness / execution quality)**: **Wealth can help**, but **scales much worse** than for reach. **Competence and strategy** remain the primary drivers of how well the narrative lands.

---

## Game loop (high level)

1. **Pre-season** — hire (competence / visibility / capacity), market positioning, optional spending.
2. **In-season (core)** — per client: accept or decline → choose strategy → allocate money, effort, employees → execute.
3. **Post-season** — outcomes, events; may continue client (round 2), pivot, or abandon.

---

## Client-facing flow

Clients have budget, profile value (visibility potential), discipline (follow-the-plan likelihood), audience segments, and crisis type.

**Strategies** (examples): Quick Fix, Reframe, Rebrand, Distract, Long-term repair.

**Allocation**: money (reach + small effectiveness bump), effort (capacity), employees (competence / reach / stability modifiers).

---

## Three outcome dimensions (per campaign)

1. **Reach** — how many saw it; **wealth + visibility** dominate; wealth scales **best** here.
2. **Convincingness** — did people believe it; **competence + strategy** dominate; wealth is a **minor** booster with **weak scaling**.
3. **Stability** — will it hold; **strategy type, client discipline, competence**; **not** something money buys directly at full strength.

**Client satisfaction** — how well outcomes match that client’s preferences (e.g. celebrity → reach; corporation → stability; influencer → visibility).

---

## Tradeoffs (design heart)

High reach vs high stability · client satisfaction vs agency reputation · profit vs credibility · one strong client vs many weaker ones. **Tradeoffs, not single optimal builds.**

---

## Multi-season clients (max 2 cycles)

- **Round 1 — Visibility phase**: reach and immediate impact; rewards visibility, money, referrals.
- **Round 2 — Credibility phase**: stability and long-term perception; rewards reputation and better future clients.

---

## Uncertainty & tone

Client discipline failures, backfires, audience differences. Tone: **light, ironic, slightly absurd but logical**.

---

## Audience segments (simplified)

Mass audience · core fans · skeptics · trend followers — each can react differently; keep the model **simple**, not a full demography sim.

---

## Capacity

Limited **effort** per cycle; clients consume effort; employees increase capacity; **overextension** should reduce quality (typically convincingness / stability), not replace the core resource grammar.

---

## Consistency checkpoint (single rule)

**Do not let wealth become the dominant lever for convincingness or stability.** Money may nudge effectiveness with **deliberately weak scaling**, but **reach** is where spending **scales strongly**; **competence, strategy, discipline, and segment fit** must remain what separate great runs from noisy, expensive ones.

---

## Non-goals

Do not overcomplicate currencies, chase full realism, or turn the game into a spreadsheet. **Keep decisions meaningful, feedback clear, systems interconnected, player experience first.**

---

## Current implementation snapshot

- Implemented UI loop so far: `Home -> New Game -> Pre-season -> Season`.
- `Continue` is enabled and routes to saved `preseason/season/postseason` path.
- Save system is single-slot local (`localStorage` + `sessionStorage`) via `dma-save-slot`.
- Pre-season has one-time activity focus (`Strategy workshop` or `Network`) and an `Agency stats` panel.
- Pre-season activity buttons disappear after the activity is used for that pre-season.
- Added dedicated hiring route: `/game/preseason/[season]/hiring` (Talent Bazaar).
- Hiring supports:
  - mode split: `Intern` vs `Full-time`
  - role-first full-time flow (`Data Analyst`, `Sales Representative`, `Campaign Manager`)
  - salary-band dropdowns (5k steps by tier)
  - deterministic 3-candidate pools for same run/season/role/tier/budget
  - unique names + unique descriptions within each 3-candidate result set
  - irreversible hire action with autosave
  - themed in-game hire result modal
  - budget guard (actions blocked if EUR would go negative)
- Employee contributions now persist and are visible in an `Employees` panel.
- Employees list is always sorted by salary and shows only non-zero stat contributions.
- Added per-metric breakdown modal on agency stats (`Wealth`, `Visibility`, `Competence`, `Capacity`, `Reputation`) with zero-value lines hidden for non-base contributors.
- Added pre-season `Start season` confirmation:
  - warns player they cannot return to pre-season
  - shows strong warning if no pre-season activity was selected
  - still allows proceeding.
- Season hub now includes:
  - `Agency stats`
  - `Employees`
  - `Invite client` button
  - no Talent Bazaar option.
- Reputation is initialized at `5` and treated as derived (not directly purchasable at start).
- Metric bands/labels are data-driven in `web/lib/metricScales.ts`.

For agent handoff and implementation details, see `docs/AGENT_HANDOFF.md`.
