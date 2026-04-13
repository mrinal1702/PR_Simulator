# Compartment: talent and workforce math

Use for all hiring, employee quality, capacity contribution, tenure growth, and layoffs.

---

## Scope

- Candidate generation and deterministic Talent Bazaar rolls
- Hidden employee productivity and hidden skill calculations
- Salary anchors, season hire caps, and candidate slot counts
- Capacity at hire plus tenure-based annual growth
- Workforce removal math (voluntary and mandatory layoff paths)
- Shopping center effects that modify talent quality
- Roster **skill %** display (derived from stored stat gains vs tier max; shared with salary-ask eligibility)
- **Pre-season 3** optional salary negotiations (raise asks, pay/leave, liquidity gates)

---

## Canonical references

- `docs/AGENCY_FINANCE.md` (payables/liquidity interactions)
- `docs/AGENT_CONTEXT.md` (save shape pointers)

---

## Code anchors

- `web/lib/hiring.ts`
- `web/lib/tenureCapacity.ts`
- `web/lib/employeeActions.ts`
- `web/lib/shoppingCenter.ts`
- `web/lib/employeeSkillDisplay.ts` (roster skill %: `inferSkillPct`)
- `web/lib/preseasonSalaryNegotiation.ts` (pre-season 3 raise rolls, `applyPayRaise`, resolve helpers)
- `web/lib/preseasonTransition.ts` (seeds `preseasonSalaryNegotiationV3` when entering pre-season 3)
- `web/components/HiringScreen.tsx`
- `web/components/EmployeeRosterList.tsx`
- `web/components/PreSeasonScreen.tsx` (salary modal, blocks Start season / hiring until resolved)
- `web/components/PreseasonSalaryNegotiationModal.tsx`

---

## 1) Hiring structure and bands

### Roles and tiers

- Roles: `data_analyst`, `campaign_manager`, `sales_representative`
- Tiers: `intern`, `junior`, `mid`, `senior`

### Salary bands by tier

From `TIER_BANDS` in `web/lib/hiring.ts`:

| Tier | Salary range | Anchors | Skill range |
|---|---:|---|---:|
| junior | 15k-39k | 15,20,25,30,35 | 10-20 |
| mid | 40k-64k | 40,45,50,55,60 | 25-40 |
| senior | 65k-89k | 65,70,75,80,85 | 50-80 |
| intern | fixed 10k | one option | fixed skill baseline path |

### Slot counts

- `talentBazaarSlotCount(intern) = 3`
- `talentBazaarSlotCount(junior) = 3`
- `talentBazaarSlotCount(mid) = 2`
- `talentBazaarSlotCount(senior) = 1`

### Hire cap by season

- `getHireCapForSeason(season) = max(2, season + 1)`

---

## 2) Deterministic candidate generation

All candidate generation is deterministic from seed strings.

- Bucket seed: `seedBase|s{season}|{role}|{tier}|{salary}`
- Name-pick seed: `seedBase|s{season}|{role}|{tier}` (intentionally excludes salary)
- Candidate id: `cand-{hash32(seed)}`

Name exclusion set is built from:

- `talentBazaarBannedNames`
- current payroll names (`save.employees`)
- `talentBazaarJuniorNamesUsed` (junior only, cross-band lockout)

---

## 3) Productivity and skill math

### Productivity roll

`resolveProductivity(seed)`:

- deterministic random in `[0, 1]`
- scaled to integer `0..80`
- explicitly capped at 80 by design

### Capacity gain at hire

`capacityGainFromProductivity(productivityPct)`:

- clamp productivity to `0..100`
- formula: `round(10 + (productivityPct / 100) * 15)`
- practical range with current productivity cap (`0..80`): about `10..22`

### Hidden skill score

`resolveSkill(...)` combines:

1. **Salary anchor progress in tier band** -> base skill in tier min/max
2. **Attract factor** from rep/visibility by role:
   - data analyst: `0.65*rep + 0.35*vis`
   - sales representative: `0.35*rep + 0.65*vis`
   - campaign manager: `0.5*rep + 0.5*vis`
3. **Nonlinear attract transform**: `sqrt(weighted)`
4. **Random variance**: `(rand - 0.5) * 0.18`
5. **Multiplier**: `base * (0.92 + attract*0.14 + variance)`
6. **Tier clamps**:
   - juniors clamp by band-specific min/max (`JUNIOR_BAND_SKILL_RANGES`)
   - other tiers clamp to tier min/max

### Skill split into stat channels

`splitBalancedSkill(totalSkill, seed)`:

- starts near 50/50 competence-visibility split
- tilt in `[-2, +2]`
- additional clamps preserve valid non-negative split

### Roster skill % (UI and PS3 eligibility)

Persisted employees do **not** store raw hidden skill; the roster shows **skill %** via `inferSkillPct` in `web/lib/employeeSkillDisplay.ts`:

- tier max by salary band: **20** (&lt; 40k), **40** (40k–64k), **80** (≥ 65k)
- **Data Analyst:** `competenceGain / tierMax × 100`
- **Sales Representative:** `visibilityGain / tierMax × 100`
- **Campaign Manager:** `(competenceGain + visibilityGain) / tierMax × 100`
- **Interns:** no skill row

**Pre-season 3 salary asks** reuse the same thresholds as productivity (≥ 51 on the 0–80 productivity roll) and skill % (≥ 51). See `countRaiseRollDimensions` / `computePreseason3SalaryAsks` in `preseasonSalaryNegotiation.ts` and `docs/AGENCY_FINANCE.md` §5.2.

---

## 4) Tenure and long-run capacity growth

`tenureCapacityIncrementFromProductivity(productivityPct, seasonsWithFirm)`:

- if `seasonsWithFirm < 1` -> `0`
- raw tenure increment: `ceil(productivityPct * 20 / 100)`
- first completed season with firm: raw increment
- second+ season with firm: `min(raw, 10)` yearly cap

Total employee capacity contribution:

- `employeeTotalCapacityContribution = capacityGain + tenureCapacityBonus`

---

## 5) Layoff and workforce removal math

### Voluntary layoff (`fireEmployeeVoluntary`)

- constraints:
  - cannot fire employee hired in same pre-season
  - max one voluntary layoff per pre-season
- effects:
  - reputation penalty: `-10`
  - wage payable removed, severance payable added
  - severance amount: `floor(salary * 0.2)`
  - employee competence/visibility/capacity removed from resources
  - name is banned from future Talent Bazaar

### Mandatory payroll-shortfall layoff (`fireEmployeeForPayrollShortfall`)

- no reputation penalty
- no severance payable insertion
- wage payable removed
- employee resource and capacity contributions removed
- name banned from future Talent Bazaar

---

## 6) Pre-season 3 salary negotiations (optional)

**Only** when entering **pre-season 3** (`enterNextPreseason` with `nextSeason === 3`). Documented in detail under economy: `docs/AGENCY_FINANCE.md` (wage payables, liquidity, settlement). Summary:

- **Eligibility:** full-time employees with productivity ≥ 51 and/or roster skill % ≥ 51 (see §3 above); **interns** excluded.
- **Rolls:** deterministic from `createdAt`, `playerName`, employee id; 75% per dimension; if **both** prod and skill high, **at least one** of two Bernoulli trials must succeed (single ask per employee).
- **Raise amounts:** +5k / +10k / +15k by current salary band (junior / mid / senior).
- **Pay:** increase `employee.salary` and the matching **wage** line; **no** cash move until **Start season**; requires `liquidityEur ≥ raise`.
- **Refuse:** same removal path as mandatory payroll layoff (`fireEmployeeForPayrollShortfall`) — no severance, no reputation penalty.
- **Gates:** `PreSeasonScreen` blocks **Start season** and **Talent Bazaar** until every ask is resolved; state cleared in `settlePreseasonAndEnterSeason`. Shopping-center EUR spend before resolving still affects liquidity checks.

---

## 7) Shopping center interactions with talent

Defined in `web/lib/shoppingCenter.ts`:

- `hrSkillsTest` -> `skillMultiplier: 1.15`
- `hrReferenceChecks` -> `productivityMultiplier: 1.15`

Current documentation note:

- multipliers are defined via `getHireAdjustmentMultipliers(save)` and should be explicitly traced in hiring execution paths whenever talent math changes.

---

## Guardrails

- Keep seed string contracts stable to preserve deterministic replays.
- Any change to tier ranges, attract weights, or clamps requires before/after simulation checks.
- Workforce changes should include impact on:
  - immediate resources
  - payables/liquidity pressure
  - medium-term firm capacity

---

## Cross-system synergies

- Workforce stat gains alter both campaign outcome quality and Season 2+ entry score snapshots.
- Wage and severance lines flow into settlement/liquidity and can trigger route-level layoff pressure.
- Hiring quality is influenced by reputation/visibility, so post-season stat changes feed back into hiring.
- Shopping center hiring multipliers must be tracked with both workforce and economy compartments.
- Pre-season 3 salary asks change wage payables and liquidity; coordinate with `docs/AGENCY_FINANCE.md` and `preseasonSalaryNegotiation.ts`.
- Use `docs/SYSTEM_SYNERGY_MAP.md` for multi-compartment edits.

---

## Change checklist (for this compartment)

- If you touch `hiring.ts`, update:
  - salary/skill tables
  - role attract weighting notes
  - seed shape notes
- If you touch `tenureCapacity.ts`, update tenure formula examples
- If you touch `employeeActions.ts`, update layoff effects matrix
- If you touch `shoppingCenter.ts`, update multiplier integration notes
- If you touch `employeeSkillDisplay.ts`, update roster skill % notes (and any feature that shares `inferSkillPct`, e.g. PS3 salary asks)
- If you touch `preseasonSalaryNegotiation.ts` or PS3 gating in `PreSeasonScreen` / `HiringScreen`, update §6 and `docs/AGENCY_FINANCE.md` §5.2

---

## Last updated for

- Pre-season 3 salary negotiations, `employeeSkillDisplay` / roster skill %, and code anchor refresh.
