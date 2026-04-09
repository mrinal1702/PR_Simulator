# Agency finance (authoritative)

This document describes how **cash**, **payables**, **receivables**, and **liquidity** work in the web app. It is the single reference for contributors and agents—there is no separate “legacy payroll” model documented elsewhere.

**Implementation:** `web/lib/payablesReceivables.ts` (math and settlement), `web/lib/employeeActions.ts` (fire), `web/components/PreSeasonScreen.tsx` (start season, warnings), `web/components/HiringScreen.tsx` (hire), `web/lib/saveGameStorage.ts` (migrations).

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
| **Liquidity** | `cash + receivables − payables` (see `liquidityEur`). |
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

---

## 5. In-season vs pre-season accrual

- **Pre-season N → season N (golden rule):** On **Start season**, **always** settle: **cash** becomes `cash + receivables − payables`, then **`payablesLines` are cleared** (receivables for that settlement are whatever `getPendingReceivablesEur` returns in pre-season—typically **0** in pre-season 1). This applies to **season 1 and every later season**; there is no separate “cash-only” path for season 1. After settlement, new wage accruals only appear when you hire again in a **future** pre-season.
- **During the season (`phase === "season"`):** Guaranteed receivables from **accepted** clients (non-reject) accrue against the **current season’s** client loop. The resource strip and liquidity use that total so receivables update as soon as a campaign is committed. Operating cash still moves with Season 1 tranches per client case.

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
| Metrics / breakdown | `web/lib/metricBreakdown.ts` |

`computePayrollHeadsUp` in `seasonFinancials.ts` is a **legacy helper** (cash vs sum of salaries) and is **not** used for gating or the main UI; prefer `liquidityEur` / `hasLayoffPressure` for new work.
