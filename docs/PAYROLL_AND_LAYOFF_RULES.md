# Payroll, layoffs, and progression (design spec — internal)

This document locks **rules and UX intent** for payroll coverage, warnings, forced/voluntary layoffs, and pre-season progression.

**Implementation status (web app):** Mandatory payroll checkpoint (`/game/preseason/[season]/payroll`), pre-season 2+ **Fire** / mandatory layoffs, hiring warnings, **payroll deduction** on **Start season** (season 2+) with `payrollPaidBySeason`, season hub / client-case **route guards**, and **intern expiry** on year transition (`enterNextPreseason`) are wired. Items below marked *(not yet)* are optional polish or future work.

---

## 1) Core rule (payroll)

- **Payroll (UI naming):** refer to what the firm owes **for the upcoming season** (per-season payroll), not ambiguous “annual” unless the UI clearly explains cadence.
- **Rule:** All current employees must be **paid for the upcoming season** before that season’s payroll resolution checkpoint.
- **Copy placement (implemented):** Talent Bazaar uses a **confirm step on Hire** (full-time vs intern messaging) plus inline payroll-risk line on full-time candidate cards.
- **Spouse grants:** Be **explicit** in copy that spouse **season-end / pre-payroll inflows** (per `gameEconomy` + design) arrive **before** payroll resolution, so they can count toward coverage when projecting “can we make payroll?”

---

## 2) Layoff trigger (forced)

- If **cash at payroll resolution** (after all known inflows that apply before that moment, including spouse grants when applicable) **is below total payroll** for retained employees, the firm **cannot retain everyone** → **forced layoffs** until payroll is affordable.
- Resolution is **forced at the checkpoint** (not mid-season unless design later says otherwise).

**Implemented:** Dedicated checkpoint screen; mandatory layoff removes employee with **no severance** and **no reputation penalty**; player must reduce payroll until `cash >= total payroll` before continuing to pre-season. Summary → next pre-season routes here when shortfall exists.

---

## 3) Warnings (when spending money)

**Goal:** Warn when a decision pushes the firm into **payroll risk**, without panicking players who can still **earn in-season** from clients.

- **Hard warning (modal):** When an action would make **payroll unaffordable** under **worst-case or no further in-season recovery** (define precisely in implementation — e.g. if current cash after the action is below payroll and there is no path to cover before the checkpoint without assuming uncertain client income).
- **Soft inline warning:** When **below payroll** but **recovery is possible** (e.g. spouse grant already scheduled, or season still has client income opportunity) — explain briefly so the player doesn’t assume instant game over.
- **Persistent payroll status chip:** Show stable **Cash vs payroll** (and shortfall if any) on a sensible screen — **tone:** informational; **do not** imply “you lose immediately after hire” if season client work can still raise cash. *(Not yet: always-on chip; summary / checkpoint show the numbers.)*

---

## 4) Layoff resolution UI (when multiple employees, shortfall)

- **When:** At a **checkpoint** before entering pre-season when payroll shortfall exists after summary.
- **Route:** `/game/preseason/[season]/payroll` (`PayrollCheckpointScreen`).
- **Behavior:** Player **chooses whom to lay off** (mandatory) until affordable; **no auto-layoff** when only one employee must go *(not yet — optional design tweak)*.

---

## 5) Voluntary layoff (no budget crisis)

- **Allowed** with costs:
  - **Reputation: −10** (fixed for now; high-rep tuning later).
  - **Severance: 20% of that employee’s salary** (cash leaves firm).
- **Warn** on voluntary layoff attempt: severance + reputation hit.
- **Cooldown:** **1 voluntary layoff per season** max.

**Mandatory vs voluntary:** Mandatory checkpoint layoffs **do not** apply −10 rep (voluntary fire still does).

---

## 6) Progression gate (pre-season 2)

- Player **cannot** enter **season** play (hub or client case) for season ≥ 2 until **payroll for that season** has been paid from pre-season — enforced via `payrollPaidBySeason` and route redirects.
- Player **cannot** start the season from pre-season if `cash < total payroll` (must fire or raise cash first).

---

## 7) Employees screen — `Fire` (Season 2+ pre-season)

- **Implemented:** `Fire` on **Employees** in pre-season **2+** for voluntary layoff (severance + rep; modal copy notes salary removed from upcoming payroll). **Same-pre-season protection:** cannot voluntary-fire someone hired in the same pre-season (`seasonHired`). During payroll shortfall, **Mandatory layoff** bypasses severance and same-season protection where applicable.

---

## 8) Spouse income timing (locked)

- **Payroll resolution** happens **after** spouse grant **if** grant is defined to arrive before that resolution — **yes**, per current design intent. Spouse grant is applied in `enterNextPreseason` before the player reaches the payroll checkpoint.

---

## 9) Payroll payment timing (code)

- **Hire:** full salary deducted once at hire (signing bonus style).
- **Season 2+:** total payroll for the roster is deducted when the player confirms **Start season** from pre-season (once per season; `payrollPaidBySeason`).

---

## Implementation note

This file remains the **source of truth** for rules; **implementation status** is summarized in `docs/AGENT_HANDOFF.md` and the README snapshot.
