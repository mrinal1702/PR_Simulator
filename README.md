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
2. **In-season (core)** — clients arrive **in a fixed order** (no choosing which client next). For each client you see the brief, pick a **solution archetype** (priced from that client’s Season 1 tranche), or **do nothing** to walk away with **no net cash change** (the tranche that was credited for the engagement is refunded). Post-season and round-2 client work are still to be expanded.
3. **Post-season** — outcomes, events; may continue client (round 2), pivot, or abandon (largely placeholder today).

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

- Implemented UI loop so far: `Home → New Game → Pre-season → Season hub → Client cases → Post-season (milestone)`. **Home** (with a save) shows **phase** (e.g. Season 1 · In season), **agency stats / employees / breakdowns** (including Season 1 client lines in EUR and capacity ledgers), and **Case log — Season 1** for completed cases (decision, spend, money retained).
- `Continue` is enabled and routes to saved `preseason/season/postseason` path.
- Save system is single-slot local (`localStorage` + `sessionStorage`) via `dma-save-slot`.
- Pre-season has one-time activity focus (`Strategy workshop` or `Network`) and an `Agency stats` panel.
- Pre-season activity buttons disappear after the activity is used for that pre-season.
- Dedicated hiring route: `/game/preseason/[season]/hiring` (Talent Bazaar).
- Hiring supports intern vs full-time, role-first full-time flow, salary bands, deterministic candidate pools, irreversible hire + autosave, themed modal, and budget guard (EUR cannot go negative).
- Employees persist; roster is salary-sorted with non-zero contribution lines only.
- Per-metric breakdown modals on agency stats (zero-value lines hidden for non-base contributors).
- Pre-season `Start season` confirmation: cannot return to pre-season; extra warning if no activity chosen; can still proceed.
- **Season hub** (`/game/season/[season]`): agency stats, employees, save, **`Roll season clients`** (builds a **sequential** queue for that season), **`Open current client case`** while the queue is active, and when **every** queued client has a resolved run, **`Continue to post-season`** (sets `phase` to `postseason`, **no** confirmation modal — unlike pre-season → season). Routes to `/game/postseason/[season]` (milestone / placeholder content for now).
- **Client case** (`/game/season/[season]/client`): separate screen per client. **Season 1**: Season 1 liquid only applies if you **run a priced campaign** (`+budgetSeason1 − spend`); **Reject client** means **no** funds from them. Creative copy from `web/data/scenarios_*.json` (merged in code; see `docs/SCENARIO_CREATIVE_GUIDELINES.md`).
- In-season client economy and loop state: `web/lib/seasonClientLoop.ts`, `web/lib/clientEconomyMath.ts`, `web/lib/scenarios.ts`; save field `seasonLoopBySeason` on `NewGamePayload`.
- Reputation is initialized at `5` and treated as derived (not directly purchasable at start).
- Metric bands/labels are data-driven in `web/lib/metricScales.ts`.

For agent handoff, economy notes, and scenario authoring, see `docs/AGENT_HANDOFF.md`, `docs/CLIENT_ECONOMY_MATH.md`, and `docs/SCENARIO_CREATIVE_GUIDELINES.md`.

**Upcoming (design doc, not yet in UI):** payroll coverage, layoffs, and progression gates — `docs/PAYROLL_AND_LAYOFF_RULES.md`.
