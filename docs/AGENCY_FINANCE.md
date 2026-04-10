# Agency finance (authoritative)

This document describes how **cash**, **payables**, **receivables**, and **liquidity** work in the web app. It is the single reference for contributors and agents—there is no separate “legacy payroll” model documented elsewhere.

**Implementation:** `web/lib/payablesReceivables.ts` (math and settlement), `web/lib/employeeActions.ts` (fire), `web/components/PreSeasonScreen.tsx` (start season, warnings), `web/components/HiringScreen.tsx` (hire), `web/lib/saveGameStorage.ts` (migrations).

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

### 0.2 Derived values (single implementation)

All of the following are defined only in **`payablesReceivables.ts`**:

- **`totalPayables(save)`** — sum of `payablesLines`.
- **`getPendingReceivablesEur(save)`** — follow-up tranches (`budgetSeason2`) for the active receivable loop (phase-dependent).
- **`liquidityEur(save)`** — `resources.eur + getPendingReceivablesEur(save) − totalPayables(save)`.
- **`hasLayoffPressure(save)`** — `liquidityEur(save) < 0`.
- **`settlePreseasonAndEnterSeason`** — the **only** settlement primitive for pre-season → season: updates `resources.eur`, clears `payablesLines`, sets phase/season, sets `payrollPaidBySeason` when applicable.

**Consumers that should stay aligned:** `PreSeasonScreen`, `HiringScreen`, `AgencyResourceStrip`, `AgencyFinanceStatsRows`, `PostSeasonHubScreen`, `SeasonSummaryScreen` (liquidity line), `metricBreakdown.ts` (breakdown totals).

### 0.3 In-season scenario spend (separate from agency liquidity)

**`web/components/SeasonClientCaseScreen.tsx`** resolves **affordability of a solution** using **per-campaign** Season 1 budget: effectively **`resources.eur + currentClient.budgetSeason1`** against the solution’s EUR cost. That path does **not** substitute for **`liquidityEur`** when deciding hiring, layoffs, or whether you can **Start season**—those use §0.2.

### 0.4 Season summary / cash-bridge screens (display narrative)

**`computeSeasonCashBridge` / `computeSeasonCashFlow`** in **`web/lib/seasonFinancials.ts`** rebuild a **P&amp;L-style story** (opening → “wages paid” → operating cash) for **`SeasonSummaryScreen`**. Closing cash in the bridge is **`save.resources.eur`** at render time. The “wages paid” line uses **hire-time salaries and `payrollPaidBySeason`**, which can diverge from **`payablesLines`** (already cleared after settlement). Treat this block as **explanatory UI**, not a second solvency engine.

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

There is **no** “layoff pressure” copy on the first pre-season onboarding surface; **post-season hub** and **season summary** are where that language appears when relevant.

### 4.1 Follow-up tranches (Season 2+ narrative)

For clients you **accepted** in a prior season, the model stores a **Season 2 budget tranche** (`budgetSeason2`) on their client record. That money is **guaranteed** for the follow-up phase of the engagement.

| When | What you see |
|------|----------------|
| **Post-season** of year *Y* and **pre-season *Y*+1** (before **Start season *Y*+1**) | Receivables sum **all** `budgetSeason2` from **accepted** runs in the **completed** season *Y* loop (`getReceivableLoopKey` → season *Y*). They count toward **liquidity** (resource strip, hiring, layoff checks) **before** you roll the new year’s client queue or open any new-season case. |
| **Immediately after Start season *Y*+1** | **Settlement** runs: that receivable total is **credited to cash** together with payables settlement (`settlePreseasonAndEnterSeason`). Pending receivables for that tranche go to **zero** on the books because the loop key for receivables is now the **new** in-season loop (*Y*+1), which starts empty until you accept work. |
| **During season *Y*+1** | New receivable lines accrue from the **current** season’s queue: each client’s `budgetSeason2` enters the receivable total **once you commit a non-reject solution** (a run is stored). Opening the case screen alone does **not** add receivables—only **acceptance** does. |

So: **last year’s follow-up money** is in receivables (or becomes cash at the door) **before** you tackle this year’s scenarios; **this year’s** follow-up tranches build up as you **complete** each accepted campaign, not when you merely open the brief.

---

## 5. In-season vs pre-season accrual

- **Pre-season N → season N (golden rule):** On **Start season**, **always** settle: **cash** becomes `cash + receivables − payables`, then **`payablesLines` are cleared** (receivables for that settlement are whatever `getPendingReceivablesEur` returns in pre-season—typically **0** in pre-season 1). This applies to **season 1 and every later season**; there is no separate “cash-only” path for season 1. After settlement, new wage accruals only appear when you hire again in a **future** pre-season.
- **During the season (`phase === "season"`):** Guaranteed receivables from **accepted** clients (non-reject) accrue against the **current season’s** client loop. The resource strip and liquidity use that total so receivables update as soon as a campaign is committed. Operating cash still moves with Season 1 tranches per client case.
- **Rollover / carryover (Season 2+):** The “prior-season client follow-up” choices (`applySeason2CarryoverChoice` in `seasonCarryover.ts`) spend **only** **`resources.eur`** (and capacity). They **must not** re-add the prior run’s **`budgetSeason1`**—that tranche was already credited when the original campaign was executed; **`budgetSeason2`** was already converted to cash at **Start season** for this year. Otherwise cash would double-count contract money.

---

## 6. Hiring

- Hiring **does not** deduct a full annual salary from cash up front.
- Adding an employee adds a **wage** payable line (and updates roster/capacity as today).
- A hire is allowed only if **liquidity after the hire** remains sufficient—practically, the candidate’s salary must be coverable within the liquidity rules enforced in `HiringScreen` (`liquidityEur` vs salary).

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

`settlePreseasonAndEnterSeason` (in `payablesReceivables.ts`) is invoked from **Pre-season** when the player confirms **Start season** — **every** season number:

1. **Cash:** `resources.eur + getPendingReceivablesEur − sum(payablesLines)` (floored at 0).
2. **`payablesLines`:** cleared to `[]`.
3. **`payrollPaidBySeason[season]`:** set to `true` when **season ≥ 2** (route guard: season hub requires pre-season completed before play).

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

Older saves without `payablesLines` are migrated in `saveGameStorage.ts` (wage lines reconstructed; legacy “deduct salary at hire” cash is adjusted for consistency).

---

## 12. Related code (quick map)

| Area | File(s) |
|------|---------|
| Liquidity, receivables, settlement | `web/lib/payablesReceivables.ts` |
| Fire voluntary / mandatory | `web/lib/employeeActions.ts` |
| Pre-season UX, **Start season** | `web/components/PreSeasonScreen.tsx` |
| Hiring and affordability | `web/components/HiringScreen.tsx` |
| Resource strip (P / R / L) | `web/components/AgencyResourceStrip.tsx` |
| Post-season / summary liquidity copy | `PostSeasonHubScreen.tsx`, `SeasonSummaryScreen.tsx` |
| Season summary cash bridge / future receivables footnote | `web/lib/seasonFinancials.ts` |
| In-season solution affordability (Season 1 tranche) | `SeasonClientCaseScreen.tsx` (main queue); carryover uses **cash only** (see §5) |
| Metrics / breakdown | `web/lib/metricBreakdown.ts` |

See **§0** for which of these are authoritative vs display-only. **`computePayrollHeadsUp`** is unused in the app (§0.5).

---

## 13. Logical consistency (audit checklist)

These properties are what the implementation is designed to satisfy; if you change one area, re-check the others.

1. **Single recognition of follow-up cash:** `budgetSeason2` is counted as a **receivable** only via `sumReceivablesFromLoop` / `getPendingReceivablesEur`. After **Start season**, that tranche is **credited to cash** and the receivable total for the **prior** loop is no longer used (`getReceivableLoopKey` moves to the new season). The old client rows in `seasonLoopBySeason` are **not** double-counted as both cash and receivable in the same phase.

2. **No mid-season payables accrual:** `payablesLines` are cleared at every pre-season → season transition. New wage lines appear only from **hiring** (or severance from **fire**) in pre-season—not from operating client work.

3. **Liquidity invariant:** `liquidityEur = cash + pendingReceivables − payables`. Hiring and **Start season** both respect this; you cannot **Start season** with negative liquidity (`hasLayoffPressure`).

4. **Spouse and client cash:** Spouse grants are **cash only**, never receivables. In-season **Season 1** client liquid uses existing `seasonClientLoop` cash rules; that is separate from the **receivable** total (which uses `budgetSeason2` on accepted runs).

5. **Season summary vs strip:** Summary cash flow is **reconstructive narrative** (§0.4). **Authoritative** solvency is **`liquidityEur` + `payablesLines` + `settlePreseasonAndEnterSeason`** (§0). If summary copy or implied “wages” disagree with the resource strip, trust §0.

6. **Interns:** Expire on year transition; they do not leave orphan payables into the next year.

7. **Receivable line items:** `getReceivableLineItems` mirrors the same loop key and acceptance rules as the totals; breakdown modals stay aligned with the strip.
