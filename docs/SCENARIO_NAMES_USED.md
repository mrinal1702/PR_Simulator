# Names used in scenarios (do not repeat)

Editor / content checklist — not required reading for pure UI work. See **`docs/README.md`** for the full doc map.

When adding **new** characters (founders, co-owners, executives, named staff), **do not reuse** first names already on this list. **Brand / company** `client_name` values are listed separately—they can sound similar to a person name but are orgs, not people.

**Pool snapshot:** 40 scenarios total (Apr 2026) — 19 Individual, 13 Small Company, 8 Corporate. Source: `web/data/scenarios_*.json`.

Last full pass: scenario JSON in `web/data/scenarios_*.json`. Update this file when you introduce a new **speaking** name in any scenario field.

---

## Individual scenarios — `client_name` (first names)

These are the lead **client** identities; treat as taken for any new individual lead.

- Anika  
- Emma  
- Elodie  
- Greg  
- Iris  
- Jake  
- Kieran  
- Leo  
- Maya  
- Marcus  
- Mila  
- Nathan  
- Nina  
- Ronan  
- Rory  
- Sienna  
- Toby  
- Zoe  

---

## First names already used in scenario **body copy** (any client type)

Includes co-founders, partners, execs, and recurring side characters in `problem_summary`, arcs, and flavor notes.

- Ali  
- Alex  
- Arjun  
- Avery  
- Dana  
- Dean  
- Elodie  
- Elena  
- Jamie  
- Jordan  
- Kieran  
- Jules  
- Kevin *(also used as running gag / agent name)*  
- Marco  
- Marcus *(corporate + individual—same string, two roles)*  
- Maya  
- Miles  
- Morgan  
- Nina *(small-company co-founder + individual travel creator)*  
- Priya  
- Quinn  
- Reese  
- Riley  
- Sam  
- Theo  
- Toby  

**Note:** `Nina` and `Marcus` appear as **different people** in different scenarios—still **do not reuse** those strings for new characters.

---

## Safe workflow

1. Pick **two new names** not on either list (or add a surname-only / title-only reference: “the head of marketing” with no first name).  
2. After merge, append new first names to **body copy** section above.  
3. For **Individual** scenarios, the `client_name` field must also be unique among individual leads (see first list).

---

## `client_name` — organizations (not person names)

Brands and companies currently in the pool (fine to keep as org names; do not create a **second** character with the same first name as a person elsewhere):

- Box & Steam  
- Bright Squeeze  
- ClearCycle Commercial  
- Crestline Office Systems  
- Greystone Office Supply  
- Gridwell  
- Ink Harbor Studio  
- JetVanta Regional  
- LockTight Travelware  
- Northloft Candle Lab  
- Northbridge Health Insurance  
- Peakline Lifestyle Co.  
- PulseForge Nutrition  
- Second Wind Studio  
- SlatePay  
- SummitTrust Financial  
- TipTap Ledger  
- Two Skillet Co.  
- Wild Thyme Pantry  
- Wiggle Spoon  
- Wobble & Whistle Party Co.  

Update the org list when new `client_name` companies ship.
