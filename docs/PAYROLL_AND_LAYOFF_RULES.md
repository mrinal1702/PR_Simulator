# Payroll, layoffs, and progression (design spec — internal)

This document locks **rules and UX intent** for payroll coverage, warnings, forced/voluntary layoffs, and pre-season progression. **Pre-season 2 UI is not built yet**; implement when that screen exists. Do not treat this as deployed gameplay until wired in code.

---

## 1) Core rule (payroll)

- **Payroll (UI naming):** refer to what the firm owes **for the upcoming season** (per-season payroll), not ambiguous “annual” unless the UI clearly explains cadence.
- **Rule:** All current employees must be **paid for the upcoming season** before that season’s payroll resolution checkpoint.
- **Copy placement (when implementing):**
  - Talent Bazaar and/or a **confirm step on Hire** that states employees must be covered for the upcoming season.
- **Spouse grants:** Be **explicit** in copy that spouse **season-end / pre-payroll inflows** (per `gameEconomy` + design) arrive **before** payroll resolution, so they can count toward coverage when projecting “can we make payroll?”

---

## 2) Layoff trigger (forced)

- If **cash at payroll resolution** (after all known inflows that apply before that moment, including spouse grants when applicable) **is below total payroll** for retained employees, the firm **cannot retain everyone** → **forced layoffs** until payroll is affordable.
- Resolution is **forced at the checkpoint** (not mid-season unless design later says otherwise).

---

## 3) Warnings (when spending money)

**Goal:** Warn when a decision pushes the firm into **payroll risk**, without panicking players who can still **earn in-season** from clients.

- **Hard warning (modal):** When an action would make **payroll unaffordable** under **worst-case or no further in-season recovery** (define precisely in implementation — e.g. if current cash after the action is below payroll and there is no path to cover before the checkpoint without assuming uncertain client income).
- **Soft inline warning:** When **below payroll** but **recovery is possible** (e.g. spouse grant already scheduled, or season still has client income opportunity) — explain briefly so the player doesn’t assume instant game over.
- **Persistent payroll status chip:** Show stable **Cash vs payroll** (and shortfall if any) on a sensible screen — **tone:** informational; **do not** imply “you lose immediately after hire” if season client work can still raise cash.

---

## 4) Layoff resolution UI (when multiple employees, shortfall)

- **When:** At a **checkpoint** (e.g. **start of Season 2 pre-season**, or first pre-season where payroll cannot be met — **exact route TBD** when pre-season 2 is built).
- **Behavior:** If multiple employees and **cannot pay full payroll**, player **chooses whom to lay off** until affordable.
- **If only one employee** must be removed to satisfy payroll: **auto-layoff that employee**; notify in a **popup before** the player starts that pre-season (or at checkpoint entry).
- **If multiple employees** and player must choose: **prompt** to open **Employees** (button/panel **highlighted or blink** so it’s conspicuous).

---

## 5) Voluntary layoff (no budget crisis)

- **Allowed** with costs:
  - **Reputation: −10** (fixed for now; high-rep tuning later).
  - **Severance: 20% of that employee’s salary** (cash leaves firm).
- **Warn** on voluntary layoff attempt: severance + reputation hit.
- **Cooldown:** **1 voluntary layoff per season** max.

**Same −10 rep** for forced vs voluntary layoff **for now** (per design decision).

---

## 6) Progression gate (pre-season 2)

- Player **cannot progress** to Season 2 (or from pre-season 2 screen into the next phase) if **they still owe payroll resolution** — i.e. **must resolve layoffs** if cash flow **cannot** cover payroll after accounting for rules above. **Exact “cannot progress” condition** should match: *no negative cash flow past payroll checkpoint* without resolving roster.

*(Tighten wording in code when implementing: `canAdvance` = payroll satisfied OR layoffs resolved.)*

---

## 7) Employees screen — `Fire` (Season 2+ pre-season when implemented)

- On **Employees** in **Season 2 pre-season** (and later as needed), provide a **Fire** action for voluntary layoff with warnings (severance + rep).
- **Same-pre-season protection:** Employees hired from Talent Bazaar in **pre-season N** **cannot** be laid off in **that same pre-season N** (implement via `seasonHired` or equivalent flag).

---

## 8) Spouse income timing (locked)

- **Payroll resolution** happens **after** spouse grant **if** grant is defined to arrive before that resolution — **yes**, per current design intent.

---

## Implementation note

Until **pre-season 2** (and checkpoint resolution) exists in the app, this file is the **source of truth** for the next implementation pass. Link from `docs/AGENT_HANDOFF.md` under “Design locked / upcoming”.
