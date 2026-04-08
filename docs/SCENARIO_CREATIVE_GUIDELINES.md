# Scenario Creative Guidelines

This document defines how scenario writing should work for PR Simulator.

## Purpose

- Create memorable, replayable client scenarios for a PR/reputation management game.
- Keep output compatible with downstream systems that handle economics and stat tuning.
- Preserve fixed solution architecture while varying flavor, names, and scenario framing.

## Scenario Requirements

Every scenario should include:

- `client_type`: `Individual`, `Small Company`, or `Corporate`
- `budget_tier`: one of `Very Low`, `Low`, `Lower-Mid`, `Mid`, `Upper-Mid`, `High`, `Very High`
- `client_subtype`: role that fits client type and budget tier
- `scenario_title`: short and punchy
- `problem_summary`: concise 1-3 sentence reputation issue
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

- Witty, playful, lightly absurd, game-like
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

- Primary store: `data/scenario_database.json`
- Append new scenarios to the `scenarios` array
- Keep existing scenarios immutable unless explicitly requested to revise
- Use stable `scenario_id` values in kebab-case for easy reference

## Quality Checklist

Before finalizing a scenario:

- Client type and budget tier match requested constraints
- Client subtype plausibly matches tier
- Tone is playful, not dark
- Problem summary is concise and clear
- Solutions are thematic and non-generic
- All four `solution_archetype_id` values are present exactly once
