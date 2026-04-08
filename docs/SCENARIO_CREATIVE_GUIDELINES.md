# Scenario Creative Guidelines

This document defines how scenario writing should work for PR Simulator.

**Data pipeline**: Author scenarios in the per–client-type JSON files under the Next app: `web/data/scenarios_individual.json`, `web/data/scenarios_small_company.json`, `web/data/scenarios_corporate.json`. Metadata and glossary live in `web/data/scenario_database.json`; `web/lib/scenarios.ts` merges the three arrays at runtime (paths live under `web/data/` so Vercel builds with **Root Directory = `web`** can resolve imports). `pickScenarioForClient` picks a record that matches **client type** and **budget tier band**, deterministically from a seed, and **never reuses** a `scenario_id` already stored in the save’s `usedScenarioIds` for that playthrough (pool widens by type / globally before failing). **EUR amounts are never authored in JSON** — budgets come from `clientEconomyMath` + `splitBudgetBySeason`; solution **prices** come from `seasonClientLoop` archetype shares. Only **copy** (title, problem, solution names/briefs) is scenario-driven.

## Purpose

- Create memorable, replayable client scenarios for a PR/reputation management game.
- Keep output compatible with downstream systems that handle economics and stat tuning.
- Preserve fixed solution architecture while varying flavor, names, and scenario framing.

## Client identity (names and voice)

- **`client_name`**: required in the database. **Individuals**: first name only. **Small companies / corporates**: company or brand name.
- **Names**: vary across scenarios; for influencer-style individuals you may lean on common Western / familiar first-name vibes (e.g. Greg, Sarah, Matthew) without making every client identical—rotate naming styles elsewhere for diversity.
- **Personality in the opening**: After the facts are clear, add a **human beat**—stress, embarrassment, or how they reached you—so the briefing feels like a real intake. Length is optional; **clarity is not**.

## Clarity first (creative direction)

**The player should understand the scandal in one pass.** Witty language is welcome; it must not hide **what happened**, **why it spread**, or **who got hurt**.

### `problem_summary`

1. **State the wrong thing early.** In the first two or three sentences, a reader should be able to answer: *What did they do (or what leaked)?* and *Why is that a problem?*
2. **Prefer several short sentences over one long sentence.** If a sentence has more than one comma chain or multiple unrelated ideas, split it.
3. **One beat per sentence where possible.** Setup → incident → evidence → spread → stakes can be separate sentences instead of one dense paragraph.
4. **Name concrete anchors** (platform, object, place) before jokes: e.g. “business Instagram Reel,” “cup holder,” “PTA thread,” not only metaphor.
5. **Add voice after the spine.** Once the fact pattern is clear, layer adjectives, humor, or character—never the reverse.
6. **Self-check:** Can someone summarize the crisis in **one plain sentence** without guessing? If not, rewrite before polishing jokes.
7. **Quirk is welcome once the spine is clear.** After the one-sentence test passes, lean harder into voice, metaphors, and odd details—clarity is the floor, not a cap on personality.

### Arcs (`arc_1`, `arc_2`, `arc_resolution`)

- **Lead with the outcome or turn**, then add color. The sim may map cells by visibility/effectiveness; the text should still read as a clear “what happened next.”
- **Arc 1** stays short; **arc 2** can be richer, but the same rule applies: no burying the lead under style.
- **`poor` cells** can still be funnier; they should remain **parseable** (who did what, what got worse).

## Arc effort levels (general rule)

- **`arc_1` (post–season 1)**: keep lines **short**; light recycling across scenarios is fine.
- **`arc_2` (season 2)**: **slightly more detail**; weave in **personal** client behavior (helping or sabotaging the plan). Discipline and “client bottles it” moments belong here. **Tone:** Arc 2 can be a **bit funnier** than Arc 1 and the opening brief—take **light liberties** with slightly absurd beats (still game-safe: no cruelty-as-punchline, no graphic shock). This is where a stuck mic, wrong soundboard, or doomed live can shine.
- **`arc_resolution` (final outcome)**: keep the **strategic outcome** clear; add **one short personal coda** (how the client is seen or how they cope). **`poor` effectiveness** rows can lean **slightly funnier** than `good` / `convincing`—bittersweet punchlines, awkward coping, one absurd image—without turning the ending into pure gag reel.

## Scenario Requirements

Every scenario should include:

- `scenario_id`: stable kebab-case id (already standard)
- `client_name`: see Client identity above
- `client_type`: `Individual`, `Small Company`, or `Corporate`
- `budget_tier`: one of `Very Low`, `Low`, `Lower-Mid`, `Mid`, `Upper-Mid`, `High`, `Very High`
- `client_subtype`: role that fits client type and budget tier
- `scenario_title`: short and punchy
- `problem_summary`: reputation issue with **clear facts first**, then **personal intake** flavor (see **Clarity first**); still game-length
- `flavor_tone_note` (optional but recommended)
- `solutions`: exactly 4 entries, each with:
  - `solution_archetype_id` (1, 2, 3, 4)
  - `solution_name`
  - `solution_brief` (1 line)

## Fixed Solution Architecture

Solution names and briefs are creative, but IDs must map to fixed archetypes:

1. Low resources, low spread, low effectiveness
2. Medium resources, low spread, high effectiveness (capacity-heavy)
3. Medium resources, high spread, low effectiveness (budget-heavy)
4. High resources, high spread, high effectiveness

Never change this mapping.

## Creative Tone

- Witty, playful, lightly absurd, game-like—**after** the situation is easy to summarize
- **Never trade clarity for cleverness** in the intake blurb; if a line is funny but opaque, rewrite or move the joke later in the paragraph
- Social/professional stakes, not traumatic stakes
- Believable enough to feel grounded, strange enough to be memorable
- Avoid extreme politics, intense criminal content, hate content, tragedy, or dark shock material

## Variety Principles

- Rotate client subtypes to avoid repetition
- Rotate problem types (hypocrisy, product mismatch, leaked messages, clumsy campaigns, overpromises, tone-deaf posts, etc.)
- Avoid repeating the same joke structure across consecutive scenarios
- Ensure each of the 4 solutions feels stylistically distinct

## Budget Tier Fit

Budget tier should influence scale and profile, not exact numbers.

- `Very Low` / `Low`: local or niche visibility
- `Lower-Mid` / `Mid`: regional relevance or rising profile
- `Upper-Mid` / `High`: established names, broader visibility
- `Very High`: top-tier personalities, category-leading brands, multinationals

## Naming Rules

- Prefer specific, thematic solution names over generic labels
- Avoid names like "Quick Fix", "Rebrand", "Distract", "Long-Term Repair"
- Keep names short, vivid, and scenario-linked

## Database Workflow

- Primary store: split by `client_type` — `web/data/scenarios_individual.json`, `web/data/scenarios_small_company.json`, `web/data/scenarios_corporate.json`
- Glossary (`solution_options` vs `resolution_grid`): `web/data/scenario_database.json`
- Append new scenarios to the correct file’s `scenarios` array
- Keep existing scenarios immutable unless explicitly requested to revise
- Use stable `scenario_id` values in kebab-case for easy reference (already present on each record)
- Store **`client_name`** alongside `scenario_id` for display and tooling

## Resolution outcomes (`arc_resolution`)

- **3×3 grid** (9 endings per scenario when fully authored), not 4×4.
- **Visibility** bands: `low` | `medium` | `high`.
- **Effectiveness** bands: `poor` | `good` | `convincing`.
- Store as nested JSON: `arc_resolution[visibility][effectiveness]` (e.g. `arc_resolution.low.poor`).
- Each ending: strategic outcome + **short personal coda** about the client (see Arc effort levels). The **`poor`** column is allowed to be a touch more comedic than the other two.

## Scenario architecture (modernized) — quick reference

Each scenario is one JSON object with:

| Piece | Role |
|--------|------|
| **Intake** | `scenario_title`, `client_subtype`, `problem_summary`, optional `flavor_tone_note` |
| **`solutions`** (×4) | **Solution options**: strategic PR choices in Season 1 and again in Season 2. Each row has `solution_archetype_id` **1–4** (fixed economics elsewhere). |
| **`arc_1`** | **Post–Season 1** outcomes: four short lines (`low_visibility_low_effectiveness`, …). |
| **`arc_2`** | **Season 2**: `options` (four named approaches + **`do nothing`**) plus four outcome lines for Season 2’s visibility × effectiveness mix. |
| **`arc_resolution`** | **Resolution grid** (not the four options): **9** endings = 3 visibility bands × 3 effectiveness levels (`low` / `medium` / `high` × `poor` / `good` / `convincing`). Final narrative after Season 2. |

Glossary keys in `web/data/scenario_database.json`: **`solution_options`** vs **`resolution_grid`**.

**Player read order (design intent):** main scenario → Season 1 solution pick → `arc_1` → Season 2 setup → Season 2 solution pick (`arc_2.options`) → final ending from `arc_resolution`.

## Overly repeated phrases (audit — rotate or avoid)

Patterns that show up **often** across the current pool. New scenarios should **vary** closers, metaphors, and joke templates so back-to-back clients do not sound like the same writer.

### Sentence templates / beats

- **“begged you to take his / her / their case”** — Repeated `problem_summary` intake line; rotate (e.g. hired you, cold-DMed you, showed up on your intake form, sent three voice notes, etc.).
- **“…and you schedule a very long silence.”** — Used several times (often in `arc_resolution` **low** / **poor**).
- **“…which is the most professional [he/she/they] has ever sounded.”** — Repeated **arc_2** high-visibility / high-effectiveness closer.
- **“The roast is huge / city-wide / industry-wide…”** — Default opener for high-visibility success beats.
- **“[They] posts one honest joke, kills the [X] fantasy, and pivots to boring, verifiable…”** — Same recovery arc for many **arc_2** high/high rows.
- **“Strangers still meme [X], but [fans/customers] start defending…”** — Repeated middle-of-beat.
- **“Reach stays modest, but [client] follows the boring plan…”** — **arc_2** low/high staple.
- **“The clip keeps resurfacing on [category] meme pages…”** — **arc_resolution** **medium** / **poor** opener (many scenarios).
- **“…refreshes [likes/dislikes/mentions] like a heartbeat monitor…”** — **arc_resolution** **medium** / **poor**.
- **“…so often [X] should invoice [them/them].”** — Personification punchline (repeated).
- **“They / She / He is famous for the wrong [noun], but platforms / sponsors only tighten… —mostly.”** — **arc_resolution** **good** row pattern.
- **“…signs new [rules] without reading because [they] ‘trust the journey/process’…”** — Plus **“you add a sticky note to [surface]: [A] first, [B] second.”** — Very common **good**-cell pair.
- **“In a small corner of the internet / neighborhood / niche they become…”** — **arc_resolution** **low** / **convincing** opening.
- **“…cringe, honest, oddly trustworthy.”** — **convincing** resolution tagline.
- **“They / She mails you [swag] that says ‘…(VERIFIED)’ / ‘…(REAL)’ / ‘…(CONFIRMED)’”** — Bracket punchline on **convincing** endings.
- **“The internet immortalizes [X] as a global meme for…”** — **arc_resolution** **high** / **poor** opener (many scenarios).
- **“…a few commenters write ‘okay that is how you fix a [noun].’”** — Corporate / recovery beat (reused).

### Words and phrases

- **Receipts**, **chose receipts**, **proof** — Core metaphor (fine, but not every ending).
- **Boring** (boring plan, boring FAQ, boring verifiable) — Intentional anti-hype; overused as a crutch.
- **Reformed** (reformed coach, reformed vendor, etc.).
- **Main character**, **fantasy** (kill the X fantasy) — Same meta-joke.
- **Bingo card** — Same metaphor for pile-ons.
- **Voice memo admitting…** — **arc_2** low/high beat repeated across individuals.

### Small-business / food clustering

- **Small Company** scenarios currently skew **food, beverage, kitchen, retail packaging, meal prep, pet treats, juice, candles** — not wrong, but new small-business ideas should **branch out** (services, B2B, non-food retail, civic, etc.) so the category does not read as “another edible brand.”

### Bracket / label gags

- **(VERIFIED)**, **(REAL)**, **(CONFIRMED)**, **(OFFICIAL)**, **(MOSTLY)** — Funny once; **rotate** with other formats (wrong reply, calendar invite, out-of-office, press release headline, etc.).

## Quality Checklist

Before finalizing a scenario:

- Client type and budget tier match requested constraints
- Client subtype plausibly matches tier
- Tone is playful, not dark
- **Problem summary passes the one-sentence test** (see **Clarity first**)
- Problem summary is concise; sentences are short enough that the scandal is obvious
- Solutions are thematic and non-generic
- All four `solution_archetype_id` values are present exactly once
