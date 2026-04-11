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
3. **Post-season** — milestone / wrap-up between seasons; may include results UI and transitions to the next pre-season (see `/game/postseason/` routes in the app).

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

## Design consistency (single rule)

**Do not let wealth become the dominant lever for convincingness or stability.** Money may nudge effectiveness with **deliberately weak scaling**, but **reach** is where spending **scales strongly**; **competence, strategy, discipline, and segment fit** must remain what separate great runs from noisy, expensive ones.

---

## Non-goals

Do not overcomplicate currencies, chase full realism, or turn the game into a spreadsheet. **Keep decisions meaningful, feedback clear, systems interconnected, player experience first.**

---

## Current implementation snapshot

- Implemented UI loop: `Home → New Game → Pre-season → Season hub → Client cases → Post-season hub → Post-season results (per client) → Season summary → Pre-season N+1`. **Home** (with a save) shows **phase**, **agency stats / employees / breakdowns** (client + post-season ledger lines), and **Case log — Season 1** where applicable.
- `Continue` is enabled and routes to saved `preseason/season/postseason` path.
- Save system is single-slot local (`localStorage` + `sessionStorage`) via `dma-save-slot`.
- Pre-season has one-time activity focus (`Strategy workshop` or `Network`) and an `Agency stats` panel.
- Pre-season activity buttons disappear after the activity is used for that pre-season.
- Dedicated hiring route: `/game/preseason/[season]/hiring` (Talent Bazaar).
- Hiring supports intern vs full-time, role-first full-time flow, salary bands, deterministic candidate pools, irreversible hire + autosave, themed modal, and **liquidity**-based affordability (payables model; see `docs/AGENCY_FINANCE.md`).
- Employees persist; roster is salary-sorted with non-zero contribution lines only.
- Per-metric breakdown modals on agency stats (zero-value lines hidden for non-base contributors).
- Pre-season `Start season` confirmation: cannot return to pre-season; extra warning if no activity chosen; can still proceed.
- **Season hub** (`/game/season/[season]`): **`Roll season clients`**, **`Open current client case`**, then **`Continue to post-season`** when the queue is fully resolved (`phase` → `postseason`).
- **Post-season** (`/game/postseason/[season]`): hub with **Season summary**, **View results** (mandatory review + boosts), link to **next pre-season**. **`/game/postseason/[season]/summary`**: stats, scenario overview, company financials (P&amp;L-style + cash bridge), liquidity / layoff pressure when relevant, **Enter pre-season N+1**.
- Outcome math is resolved in `web/lib/solutionOutcomeMath.ts`: archetype base plus a centered, additive force from visibility/competence/discipline drivers (with small score-level jitter); **Season 1 vs Season 2** use different C/V normalization knots for campaign outcomes. Post-season: Season 1 boosts + rep/vis; Season 2+ mandatory **completed scenarios** + history — `docs/POST_SEASON.md`. Metric ↔ arc mapping: `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md`. **Season 2 structure** (entry V/C scores, client count roll, rollover carry-over): `docs/SEASON2_STRUCTURE.md`.
- **Client case** (`/game/season/[season]/client`): separate screen per client. **Season 1**: Season 1 liquid only applies if you **run a priced campaign** (`+budgetSeason1 − spend`); **Reject client** means **no** funds from them. Creative copy from `web/data/scenarios_*.json` (merged in code; see `docs/SCENARIO_CREATIVE_GUIDELINES.md`).
- In-season client economy and loop state: `web/lib/seasonClientLoop.ts`, `web/lib/clientEconomyMath.ts`, `web/lib/scenarios.ts`; save field `seasonLoopBySeason` on `NewGamePayload`.
- Reputation is initialized at `5` and treated as derived (not directly purchasable at start).
- Metric bands/labels are data-driven in `web/lib/metricScales.ts`.
- **Agency finance & employees (Season 2+):** **Payables** (wages, severance—positive amounts, red in UI) and **receivables** (guaranteed client follow-up fees—green) feed **liquidity** = cash + receivables − payables. **Layoff pressure** when liquidity &lt; 0: player must fix roster on **main pre-season** (Employees highlighted); **voluntary** fire (severance payable + rep hit; limits apply) vs **mandatory** fire in crisis (no severance, no rep hit). **Hiring** adds wage payables (no full salary deducted from cash at hire); affordability uses liquidity. **Start season** settles receivables minus payables and clears payables; `payrollPaidBySeason` gates season entry. **Interns** expire on year transition (removed from roster, stats reversed). Canonical rules: `docs/AGENCY_FINANCE.md`. Legacy path `/game/preseason/[season]/payroll` redirects to main pre-season.

## Documentation index

| Doc | Purpose |
|-----|---------|
| `docs/AGENT_HANDOFF.md` | Current product state, routes, save model, key files, manual QA |
| `docs/CLIENT_ECONOMY_MATH.md` | In-season client pricing and Season 1 liquid math |
| `docs/SEASON2_STRUCTURE.md` | Season 2+ entry scores, client count, C/V knots, rollover |
| `docs/POST_SEASON.md` | Post-season routes, Season 1 vs 2+ UI, `arc_*` keys, scenario history |
| `docs/SCENARIO_CREATIVE_GUIDELINES.md` | Writing / merging scenario JSON |
| `docs/DEPLOYMENT.md` | Supabase + Vercel |
| `docs/AGENCY_FINANCE.md` | Cash, payables, receivables, liquidity, hiring, layoffs — **authoritative** |
| `docs/SCENARIO_SOLUTION_DEVICING_METRICS.md` | Metric anchors for solution / outcome balancing |

For agent handoff and economy notes, start with `docs/AGENT_HANDOFF.md`, `docs/AGENCY_FINANCE.md`, and `docs/CLIENT_ECONOMY_MATH.md`.
