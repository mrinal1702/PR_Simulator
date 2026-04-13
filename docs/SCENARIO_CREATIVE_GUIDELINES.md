# Scenario Creative Guidelines

How to write and maintain PR Simulator scenario copy.

## Data pipeline

- **Creative rows** live in `web/data/scenarios_individual.json`, `web/data/scenarios_small_company.json`, and `web/data/scenarios_corporate.json`. `web/lib/scenarios.ts` merges the three `scenarios` arrays at build/runtime (paths stay under `web/data/` so Vercel **Root Directory = `web`** resolves imports).
- **`web/data/scenario_database.json`** holds only **metadata + glossary** (`schema_version`, `description`, `glossary` keys `solution_options` / `resolution_grid`). It does **not** contain scenario rows.
- **`pickScenarioForClient`** picks a row matching **client type** and **budget tier band**, deterministically from a seed, and skips any `scenario_id` in the save’s `usedScenarioIds` until the pool is exhausted (then throws with `SCENARIO_POOL_EXHAUSTED_MESSAGE`).
- **EUR amounts are never authored in scenario JSON.** Budgets come from `clientEconomyMath` / `splitBudgetBySeason`; solution **prices** come from `seasonClientLoop` archetype shares. Scenarios supply **copy** only: titles, problem text, solution names/briefs, arcs.

## Purpose

- Memorable, replayable client crises for a PR / reputation sim.
- Compatible with downstream economy and stat tuning.
- **Fixed solution architecture** (four archetypes); flavor varies via names and framing.

## Client identity (names and voice)

- **`client_name`**: required. **Individuals**: first name only. **Small company / corporate**: company or brand name.
- **Do not repeat first names** for new people (co-founders, execs, named staff). Track them in **`docs/SCENARIO_NAMES_USED.md`** whenever you add a speaking name.
- **Naming**: vary across scenarios; influencer-style individuals can use familiar Western first names, but rotate styles so the pool does not feel cloned.
- **Opening intake**: after facts are clear, add a human beat (stress, embarrassment, how they reached you). Length is flexible; **clarity is not**.

## Clarity first (`problem_summary`)

1. **State the wrong thing early.** In the first few sentences the reader should grasp *what happened or leaked* and *why it hurts*.
2. **Sentence rhythm:** shorter than endless witty paragraphs; not a staccato of fragments. Split when a line buries the scandal.
3. **Concrete anchors** (platform, object, place) before pure metaphor.
4. **Voice after the spine** — never the reverse.
5. **Self-check:** one plain-sentence summary of the crisis without guessing; if that fails, rewrite before polishing jokes.

## Arc copy (`arc_1`, `arc_2`, `arc_resolution`)

- **Lead with the outcome or turn**, then color. Sim code maps visibility × effectiveness; prose should still read as “what happened next.”
- **`poor` cells** can be funnier but must stay **parseable** (who did what, what got worse).
- **`arc_1` (Season 1 post-season results):** short lines; light recycling across scenarios is fine.
- **`arc_2` (Season 2 carry-over follow-up):** a bit more detail; show the client helping or sabotaging the plan. Slightly absurder than Arc 1 is OK (game-safe: no cruelty-as-punchline, no graphic shock).
- **`arc_resolution`:** clear strategic outcome plus **one short personal coda**. `poor` effectiveness can lean slightly more comedic than `good` / `convincing`.

## Scenario JSON (required shape)

Each scenario is one object in the correct file’s `scenarios` array.

| Area | Fields |
|------|--------|
| **Identity** | `scenario_id` (stable kebab-case), `client_name`, `client_type` (`Individual` \| `Small Company` \| `Corporate`), `budget_tier` (see below), `client_subtype` |
| **Intake** | `scenario_title`, `problem_summary`, optional `flavor_tone_note` (recommended) |
| **Solutions** | `solutions`: **exactly 4** objects, each `solution_archetype_id` **1–4** once, plus `solution_name`, `solution_brief` |
| **`arc_1`** | Four strings: `low_visibility_low_effectiveness`, `low_visibility_high_effectiveness`, `high_visibility_low_effectiveness`, `high_visibility_high_effectiveness` |
| **`arc_2`** | `options`: **five** strings — four named approaches plus **`do nothing`** — plus the same four visibility × effectiveness outcome keys as `arc_1`. The `options` copy is kept for authoring/reference; current gameplay does **not** render those strings as button labels. |
| **`arc_resolution`** | Nested `low` \| `medium` \| `high` → `poor` \| `good` \| `convincing` (**3×3 = 9** endings). Not the same as the four solution cards. |

**Player read order (current game flow):** main brief → Season 1 generic solution card (with scenario-specific name/brief) → Season 1 post-season results text from `arc_1` → Season 2 carry-over follow-up text from `arc_2` → generic carry-over option card → `arc_resolution`.

**Important:** the live UI uses the fixed solution archetype cards from game code for both Season 1 and carry-over choices. Do not assume `arc_2.options` will appear as literal button text in the current build.

Glossary text for authors lives under `scenario_database.json` → **`glossary.solution_options`** vs **`glossary.resolution_grid`**.

## Fixed solution archetypes (do not remap)

Creative names/briefs only; IDs are fixed for economy code:

1. Low resources, low spread, low effectiveness  
2. Medium resources, low spread, high effectiveness (capacity-heavy)  
3. Medium resources, high spread, low effectiveness (budget-heavy)  
4. High resources, high spread, high effectiveness  

### `solution_brief`

Keep each brief **short** (usually one or two sentences). Prefer **specific tactics** (what gets posted, filmed, or promised) over vague strategy labels (“high reach,” “visibility run”) unless the action is spelled out.

## Creative tone

- Witty, playful, lightly absurd — **after** the situation is easy to summarize.
- **Never trade clarity for cleverness** in the intake blurb.
- Social/professional stakes, not traumatic stakes; no extreme politics, intense crime, hate, tragedy, or shock-for-shock.

## Variety

- Rotate subtypes, crisis types, and joke **structures** so back-to-back clients do not read like one template.
- The **four solution names** should feel stylistically distinct.

## Budget tier fit

Tier signals **scale and profile**, not exact numbers.

- `Very Low` / `Low`: local or niche.
- `Lower-Mid` / `Mid`: regional or rising profile.
- `Upper-Mid` / `High`: established names, broader reach.
- `Very High`: top-tier personalities, category leaders, multinationals.

*(The live pool today mostly uses `Very Low`, `Low`, and a little `Mid`; the full ladder remains valid for new rows.)*

## Solution naming

- Prefer specific, thematic names over generic ones (“Quick Fix,” “Rebrand,” “Distract,” “Long-Term Repair”).
- Keep names short, vivid, and tied to the scenario.

## Repo workflow

- Append new scenarios to the correct JSON file’s `scenarios` array.
- Update **`docs/SCENARIO_NAMES_USED.md`** when you add speaking names.
- Do not rewrite existing scenarios unless asked.
- Use stable kebab-case `scenario_id` values.

## Overly repeated phrases (audit — rotate or avoid)

**Last refreshed against the full pool: 40 scenarios (19 Individual, 13 Small Company, 8 Corporate), Apr 2026.** When the pool grows, re-grep for these templates and add new repeats if they show up.

Patterns that appear **often**. New work should **vary** closers and beats so clients do not sound copy-pasted.

### Sentence templates / beats

- **“begged you to take his / her / their case”** — rotate (hired you, cold-DMed, intake form, voice notes, etc.).
- **“…and you schedule a very long silence.”** — often `arc_resolution` low / poor.
- **“…which is the most professional [he/she/they] has ever sounded.”** — repeated `arc_2` high / high closer.
- **“The roast is huge / city-wide / industry-wide…”** — high-visibility success openers.
- **“[They] posts one honest joke, kills the [X] fantasy, and pivots to boring, verifiable…”** — many `arc_2` high / high rows.
- **“Strangers still meme [X], but [fans/customers] start defending…”**
- **“Reach stays modest, but [client] follows the boring plan…”** — `arc_2` low / high staple.
- **“The clip keeps resurfacing on [category] meme pages…”** — `arc_resolution` medium / poor opener.
- **“…refreshes [likes/dislikes/mentions] like a heartbeat monitor…”**
- **“…so often [X] should invoice [them/them].”**
- **“They / She / He is famous for the wrong [noun], but platforms / sponsors only tighten… —mostly.”** — `arc_resolution` good pattern.
- **“…signs new [rules] without reading because [they] ‘trust the journey/process’…”** plus **sticky note** punchline — common good-cell pair.
- **“In a small corner of the internet / neighborhood / niche they become…”** — low / convincing opener.
- **“…cringe, honest, oddly trustworthy.”** — convincing tagline.
- **“They / She mails you [swag] that says ‘…(VERIFIED)’…”** — convincing closer.
- **“The internet immortalizes [X] as a global meme for…”** — high / poor opener.
- **“…a few commenters write ‘okay that is how you fix a [noun].’”** — corporate recovery beat.

### Newer patterns (still easy to overuse)

- **Inbox / queue** phrasing for how they reach you — same slot as “begged you”; vary (calendar invite, forwarded thread, vendor intro).
- **“The story spikes / blows up”** — high-visibility recovery.
- **“Outsiders still joke about [X], but…”**
- **“They narrow into [dull/boring/safe]…”** — credible second act.
- **“For a season they are shorthand for…”** — meme-status summary.

### Words and phrases

- **Receipts / proof** — fine; not every ending.
- **Boring** (boring plan, boring FAQ) — intentional anti-hype; easy crutch.
- **Reformed**, **main character**, **fantasy** (kill the X fantasy), **bingo card**, **voice memo admitting…** — watch density.

### Small-business clustering

**Small Company** rows skew **food, beverage, kitchen, packaging, pets, juice, candles**. New ideas should **branch out** (services, B2B, non-food retail, civic) so the file does not read as only edible brands.

### Bracket gags

**(VERIFIED)**, **(REAL)**, **(CONFIRMED)**, **(OFFICIAL)**, **(MOSTLY)** — rotate with other formats (wrong reply, OOO auto-reply, headline parody, etc.).

## Quality checklist

- Client type and budget tier match the design brief.
- Subtype plausibly matches tier and type.
- Tone playful, not dark; problem passes **one-sentence test**.
- Readable rhythm in `problem_summary`.
- Four solutions: thematic, non-generic, **each archetype id once**.
- `arc_1`, `arc_2`, and full **`arc_resolution`** 3×3 grid are present and keyed correctly.
- `arc_2.options` still includes **`do nothing`** and all five entries for authoring completeness, even though current gameplay uses generic option cards instead of these labels.
