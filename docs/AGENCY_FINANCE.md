# Agency finance (authoritative)

This document describes how **cash**, **payables**, **receivables**, and **liquidity** work in the web app. It is the single reference for contributors and agents—there is no separate “legacy payroll” model documented elsewhere.

**Implementation:** `web/lib/payablesReceivables.ts` (math and settlement), `web/lib/employeeActions.ts` (fire), `web/lib/preseasonTransition.ts` (post-season → next pre-season, **rollover wage payables**, **seed pre-season 3 salary asks**), `web/lib/preseasonSalaryNegotiation.ts` (PS3 raise rolls, pay/refuse helpers), `web/components/SeasonHubScreen.tsx` (**rebuild wage payables when entering post-season**), `web/components/PreSeasonScreen.tsx` (start season, layoff UI, PS3 salary modal), `web/components/HiringScreen.tsx` (hire), `web/lib/hiring.ts` + `web/lib/benchmarkHiringAttract.ts` (candidate **skill** vs agency stats; see `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §3), `web/lib/saveGameStorage.ts` (migrations). Eligibility and productivity/skill thresholds for PS3: `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §6.

---

## 0. Source of truth (what the code actually uses)

The **formulas and settlement path** live in **`web/lib/payablesReceivables.ts`**. If the doc and that file disagree, **update the doc** (or fix the bug in code)—this section is the checklist.

### 0.1 Persisted state (save payload)

| Field | Role |
|-------|------|
| `resources.eur` | Cash already in the bank. Mutated by client scenarios, post-season spend, pre-season transitions (e.g. spouse), and **`settlePreseasonAndEnterSeason`** (receivables netted in, payables paid). |
| `payablesLines` | Accrued obligations (wages, severance). **Cleared** to `[]` every time the player **Start season**s from pre-season. |
| `seasonLoopBySeason` | Per-season client queue + **runs**. Receivables are **derived** from accepted, non-reject runs and each client’s `budgetSeason2` (see `getReceivableLoopKey`, `sumReceivablesFromLoop`). |
| `seasonNumber`, `phase` | Determine **which** loop key counts for pending receivables (`getReceivableLoopKey`). |
| `payrollPaidBySeason` | Set when **Start season** runs for season ≥ 2; used for **route guards** and **season-summary cash-flow narrative** (`computeSeasonCashFlow`), not for computing `liquidityEur`. |
| `preseasonSalaryNegotiationV3` | **Pre-season 3 only:** pending salary asks and resolutions; cleared on **Start season** (`settlePreseasonAndEnterSeason`). Empty/absent when no asks rolled. |

### 0.2 Derived values (single implementation)

All of the following are defined only in **`payablesReceivables.ts`**:

- **`totalPayables(save)`** — sum of `payablesLines`.
- **`getPendingReceivablesEur(save)`** — follow-up tranches (`budgetSeason2`) for the active receivable loop (phase-dependent).
- **`liquidityEur(save)`** — `resources.eur + getPendingReceivablesEur(save) − totalPayables(save)`.
- **`hasLayoffPressure(save)`** — `liquidityEur(save) < 0`.
- **`settlePreseasonAndEnterSeason`** — the **only** settlement primitive for pre-season → season: updates `resources.eur`, clears `payablesLines`, sets phase/season, sets `payrollPaidBySeason` when applicable.

**Consumers that should stay aligned:** `PreSeasonScreen`, `HiringScreen`, `SeasonHubScreen` (post-season entry must refresh payables), `AgencyResourceStrip`, `AgencyFinanceStatsRows`, `PostSeasonHubScreen`, `SeasonSummaryScreen` (liquidity line), `metricBreakdown.ts` (breakdown totals).

### 0.3 In-season scenario spend (separate from agency liquidity)

**`web/components/SeasonClientCaseScreen.tsx`** resolves **affordability of a solution** using **per-campaign** Season 1 budget: effectively **`resources.eur + currentClient.budgetSeason1`** against the solution’s EUR cost. That path does **not** substitute for **`liquidityEur`** when deciding hiring, layoffs, or whether you can **Start season**—those use §0.2.

### 0.4 Season summary / cash-bridge screens (display narrative)

**`computeSeasonCashBridge` / `computeSeasonCashFlow`** in **`web/lib/seasonFinancials.ts`** rebuild a season-summary story for **`SeasonSummaryScreen`**:

- **Revenue** = accepted fresh-client current tranches for the season (`budgetSeason1`) **plus** prior-season rollover receivables that were paid into cash at season start.
- **Campaign cost** = in-season EUR spend on fresh campaigns **plus** in-season EUR spend on rollover follow-up actions.
- **Extra campaign cost** = post-season reach boosts (EUR only).
- **Net operating cash** = revenue − campaign cost − extra campaign cost.
- **Cash flow** = opening value − wages − optional severance + cash from operations = closing.

Closing cash in the bridge is **`save.resources.eur`** at render time. This block is still a **summary narrative**, not the authoritative solvency engine — trust **`liquidityEur`**, `payablesLines`, and `settlePreseasonAndEnterSeason` for gameplay rules.

### 0.5 Not used for gameplay

**`computePayrollHeadsUp`** in **`seasonFinancials.ts`** (cash vs sum of all salaries) is **not imported** anywhere else in the repo. Do not use it for gates or new UI; prefer **`liquidityEur` / `hasLayoffPressure`**.

---

## 1. Why this model

The agency tracks **obligations** (what you owe staff and similar) and **guaranteed inflows** (what accepted clients have committed) separately from **cash already in the bank**. That makes “can we afford the roster?” a **liquidity** question, not a naive “cash vs sum of salaries” check at hire time.

---

## 2. Definitions

| Term | Meaning |
|------|--------|
| **Cash (EUR)** | Money already received. In-season client fees hit cash as you work scenarios (per existing client math). |
| **Payables** | Accrued obligations, **positive numbers** in data. Today this is mainly **per-employee wage lines** and optional **severance** lines; the structure (`payablesLines[]`) allows more line types later. |
| **Receivables** | **Guaranteed** money not yet credited to cash—e.g. follow-up tranches from **accepted** clients (`budgetSeason2` summed per relevant loop). Client money **does not** appear as receivable until you accept the engagement; rejecting a client does not create a receivable. |
| **Liquidity** | `cash + receivables − payables`; implemented only as `liquidityEur` (**§0.2**). |
| **Layoff pressure** | `liquidity < 0`. The player must reduce payables (typically by firing) before starting a season—see §7. |

**Sign convention:** Payables and receivables are both **positive magnitudes**. In the UI, payables read as positive amounts in **red**; receivables in **green**—consistent semantics, color distinguishes them.

---

## 3. What is *not* a receivable

- **Spouse support** is **direct cash** when the game applies it (e.g. on entering pre-season via `enterNextPreseason`). It is **not** modeled as a receivable.

---

## 4. Pre-season 1 vs later seasons

- **Pre-season 1:** New company—**no** promises and **no** guaranteed pipeline. **Receivables are 0** until the player accepts client work in play; the UI does not imply guaranteed money sitting off–balance-sheet.
- **After you have accepted clients:** Receivables reflect guaranteed follow-up fees from those relationships, per the active save/phase rules in `getPendingReceivablesEur`.

There is **no** “layoff pressure” copy on the first pre-season onboarding surface. **Layoff pressure** (`hasLayoffPressure`) can appear on **post-season hub**, **post-season results**, **season summary**, and **pre-season 2+** whenever **`liquidityEur`** is negative — which requires **payables** to include upcoming wages (see §5).

### 4.1 Follow-up tranches (Season 2+ narrative)

For clients you **accepted** in a prior season, the model stores a **Season 2 budget tranche** (`budgetSeason2`) on their client record. That money is **guaranteed** for the follow-up phase of the engagement.

| When | What you see |
|------|----------------|
| **Post-season** of year *Y* and **pre-season *Y*+1** (before **Start season *Y*+1**) | Receivables sum **all** `budgetSeason2` from **accepted** runs in the **completed** season *Y* loop (`getReceivableLoopKey` → season *Y*). They count toward **liquidity** (resource strip, hiring, layoff checks) **before** you roll the new year’s client queue or open any new-season case. |
| **Immediately after Start season *Y*+1** | **Settlement** runs: that receivable total is **credited to cash** together with payables settlement (`settlePreseasonAndEnterSeason`). Pending receivables for that tranche go to **zero** on the books because the loop key for receivables is now the **new** in-season loop (*Y*+1), which starts empty until you accept work. |
| **During season *Y*+1** | New receivable lines accrue from the **current** season’s queue: each client’s `budgetSeason2` enters the receivable total **once you commit a non-reject solution** (a run is stored). Opening the case screen alone does **not** add receivables—only **acceptance** does. |

So: **last year’s follow-up money** is in receivables (or becomes cash at the door) **before** you tackle this year’s scenarios; **this year’s** follow-up tranches build up as you **complete** each accepted campaign, not when you merely open the brief.

---

## 5. Boundaries: settlement, receivables, wage payables, carryover

### 5.1 Start season (pre-season → in-season)

On **Start season** (`settlePreseasonAndEnterSeason`), **every** season:

1. **Cash:** `resources.eur + getPendingReceivablesEur − totalPayables` (floored at 0).
2. **`payablesLines`:** cleared to `[]` — all listed wages and severance for that transition are **paid from liquidity** (cash + receivables), not as a separate cash-only path.

Receivables in pre-season are whatever `getPendingReceivablesEur` returns (typically **0** in pre-season 1 before any accepted work).

### 5.2 Employee wage payables (when `payablesLines` is filled)

After settlement, **`payablesLines` is empty during in-season play** — no wages accrue mid-season from client work.

**Wage lines are written back** so the next year’s payroll obligation is visible and included in **`liquidityEur`**:

| Moment | What happens |
|--------|----------------|
| **Hire** (pre-season, `HiringScreen`) | One **wage** line per hire (`wage-{employeeId}`). |
| **Enter post-season** (`SeasonHubScreen` → **Continue to post-season**) | **Rebuild** wage lines for every surviving employee **except interns** (same rule as pre-season: interns have no wage payable line). |
| **Enter next pre-season** (`enterNextPreseason` after season *Y* post-season) | **Rebuild** wage lines for surviving **non-intern** staff. Idempotent re-entry **merges** any missing rollover wage lines without wiping lines added if the player already hired in that pre-season. |

| **Pre-season 3 salary raise (accept)** | **Increase** employee salary and the matching wage line by 5k/10k/15k (tier); no cash moves until Start season. Accept only if liquidityEur is at least the raise amount. Refuse uses mandatory-fire rules (no severance, no reputation penalty). See web/lib/preseasonSalaryNegotiation.ts. |

So: **post-season *Y*** and **pre-season *Y*+1** both show **upcoming wages** in payables (and severance after a voluntary fire), and **`liquidityEur` / `hasLayoffPressure`** match the player’s expectations (e.g. cash 1k + receivables 13k − payables 15k &lt; 0 → mandatory layoff path in pre-season 2).

### 5.3 In-season receivables

During **`phase === "season"`**, guaranteed receivables from **accepted** clients (non-reject) use the **current** season’s loop. Receivables update when a campaign is **committed**. Operating cash still moves with Season 1 tranches per client case (`SeasonClientCaseScreen`).

### 5.4 Rollover / carryover (Season 2+)

`applySeason2CarryoverChoice` spends **only** **`resources.eur`** (and capacity). It does **not** re-credit **`budgetSeason1`** or touch **`budgetSeason2`** again (already settled at **Start season**).

---

## 6. Hiring

- Hiring **does not** deduct a full annual salary from cash up front.
- Adding an employee adds a **wage** payable line (and updates roster/capacity as today).
- A hire is allowed only if **liquidity after the hire** remains sufficient—practically, the candidate’s salary must be coverable within the liquidity rules enforced in `HiringScreen` (`liquidityEur` vs salary).
- **Employee quality (hidden skill at hire)** is separate from liquidity: it scales with **reputation** and **effective** competence/visibility for that pre-season’s **season number**, via `hiringAttractChannels` (`benchmarkHiringAttract.ts`) and role-specific mixing in `resolveSkill` (`hiring.ts`). Full detail: `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §3.

**Pre-season 3 salary negotiations** (mid-preseason, not at hire): some employees may request a raise; accepting increases wage payables and salary under the same liquidity rules. See **§5.2** table row and `docs/COMPARTMENT_TALENT_AND_WORKFORCE_MATH.md` §6.

---

## 7. Firing and layoffs

**Voluntary layoff** (pre-season, not in liquidity crisis):

- **Reputation:** −10 (fixed).
- **Severance:** 20% of salary, rounded down—modeled as **replacing** that employee’s **wage** payable with a **severance** payable (cash is not paid immediately; it settles at **Start season** with other payables).
- **Limit:** One voluntary layoff per season (`voluntaryLayoffsBySeason`).
- **Protection:** Cannot voluntarily fire someone **hired in the same pre-season** (`seasonHired`).

**Mandatory layoff** (layoff pressure—liquidity negative):

- **No** severance payable and **no** reputation penalty.
- Removes the employee and their **wage** payable only.

**Cannot start season** while layoff pressure exists: the player must use **Employees** (highlighted when blocked) and fire until liquidity is non-negative. There is **no** separate mandatory payroll screen.

---

## 8. Starting a season (settlement)

Same as **§5.1**. **`payrollPaidBySeason[season]`** is set to `true` when **season ≥ 2** after settlement (route guard: season hub / client case require pre-season completed for that year).

---

## 9. Route guards

- **Season ≥ 2:** If that season’s payroll flag is false, **Season hub** and **client case** redirect to **main pre-season** (`/game/preseason/[season]`) until the player completes pre-season and starts the season.
- **Legacy URL:** `/game/preseason/[season]/payroll` **redirects** to `/game/preseason/[season]` (bookmark-safe; no second UX flow).

---

## 10. Interns

On **post-season → next pre-season** (`enterNextPreseason`), interns whose season matches the completed year are **removed** from the roster and their stat contributions are reversed. They do not roll into the next year’s wage payables.

---

## 11. Save fields (relevant)

- `payablesLines`: `{ id, label, amount }[]` — wage lines, severance lines, future types.
- `payrollPaidBySeason`: season keys → `true` after **Start season** settlement for that season (season ≥ 2).
- `voluntaryLayoffsBySeason`: counts voluntary fires per pre-season season.
- `seasonCashAdjustmentsBySeason`: cash-flow-only season-start adjustments currently used for **voluntary-layoff severance** in summary screens.

Older saves without `payablesLines` are migrated in `saveGameStorage.ts` (wage lines reconstructed; legacy “deduct salary at hire” cash is adjusted for consistency).

---

## 12. Related code (quick map)

| Area | File(s) |
|------|---------|
| Liquidity, receivables, settlement | `web/lib/payablesReceivables.ts` |
| Fire voluntary / mandatory | `web/lib/employeeActions.ts` |
| Pre-season UX, **Start season**, PS3 salary modal | `web/components/PreSeasonScreen.tsx` |
| Hiring and affordability | `web/components/HiringScreen.tsx`, `web/lib/hiring.ts`, `web/lib/benchmarkHiringAttract.ts` |
| PS3 raise math / payables updates | `web/lib/preseasonSalaryNegotiation.ts` |
| Resource strip (P / R / L) | `web/components/AgencyResourceStrip.tsx` |
| Post-season entry (rebuild wages) | `web/components/SeasonHubScreen.tsx` |
| Post-season / summary liquidity copy | `PostSeasonHubScreen.tsx`, `SeasonSummaryScreen.tsx` |
| Post-season → next pre-season (spouse, interns, **rollover wages**) | `web/lib/preseasonTransition.ts` |
| Season summary cash bridge / future receivables footnote | `web/lib/seasonFinancials.ts` |
| In-season solution affordability (Season 1 tranche) | `SeasonClientCaseScreen.tsx` (main queue); carryover uses **cash only** (see §5) |
| Metrics / breakdown | `web/lib/metricBreakdown.ts` |

See **§0** for which of these are authoritative vs display-only. **`computePayrollHeadsUp`** is unused in the app (§0.5).

---

## 13. Logical consistency (audit checklist)

These properties are what the implementation is designed to satisfy; if you change one area, re-check the others.

1. **Single recognition of follow-up cash:** `budgetSeason2` is counted as a **receivable** only via `sumReceivablesFromLoop` / `getPendingReceivablesEur`. After **Start season**, that tranche is **credited to cash** and the receivable total for the **prior** loop is no longer used (`getReceivableLoopKey` moves to the new season). The old client rows in `seasonLoopBySeason` are **not** double-counted as both cash and receivable in the same phase.

2. **Wage payables timing:** `payablesLines` are cleared at every **Start season**. During **in-season**, they stay empty (no wage accrual from client work). Wages reappear for the **next** year’s obligation via **Continue to post-season** (`SeasonHubScreen`), **`enterNextPreseason`**, and new **hires** / **fires** (severance) in pre-season — see **§5.2**.

3. **Liquidity invariant:** `liquidityEur = cash + pendingReceivables − payables`. Hiring and **Start season** both respect this; you cannot **Start season** with negative liquidity (`hasLayoffPressure`).

4. **Spouse and client cash:** Spouse grants are **cash only**, never receivables. In-season **Season 1** client liquid uses existing `seasonClientLoop` cash rules; that is separate from the **receivable** total (which uses `budgetSeason2` on accepted runs).

5. **Season summary vs strip:** Summary cash flow is **reconstructive narrative** (§0.4). **Authoritative** solvency is **`liquidityEur` + `payablesLines` + `settlePreseasonAndEnterSeason`** (§0). If summary copy or implied “wages” disagree with the resource strip, trust §0.

6. **Interns:** Expire on year transition; they do not leave orphan payables into the next year.

7. **Receivable line items:** `getReceivableLineItems` mirrors the same loop key and acceptance rules as the totals; breakdown modals stay aligned with the strip.
