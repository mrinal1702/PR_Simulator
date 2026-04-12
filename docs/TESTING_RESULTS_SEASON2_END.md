# Testing Results Season 2 End

This file stores the current automated test benchmark for the game state at the **end of Season 2**.

## Checkpoint definition

These values are measured at the **final Season 2 post-season save state**, **before entering pre-season 3**.

That means:
- Season 2 main scenarios are complete
- Season 2 post-season is complete
- Season 1 -> Season 2 carryover resolutions are complete
- The player has **not** yet advanced into pre-season 3

This checkpoint matters because it is the handoff state into Season 3 balancing and testing.

## Test setup

- Total runs: `240`
- Matrix: `3 builds x 4 spouses x 20 runs each`
- Seasons completed per run: `2`
- Bot strategy: multi-KPI baseline from `web/scripts/strategies/test-bot-kpi-framework.json`
- Variant logic: each run slightly boosts one KPI and proportionally reduces the others while keeping total weight at `1.0`

## Overall results

Stat order below is:

`min / q1 / median / mean / q3 / max / std dev`

### Raw competence

`22 / 55 / 80 / 83.23 / 105 / 185 / 36.37`

### Raw visibility

`40 / 79 / 107 / 112.75 / 141 / 257 / 45.90`

### Reputation

`-49 / 24 / 37 / 47.20 / 67.25 / 168 / 39.89`

### Client satisfaction

`16.67 / 45.13 / 50.71 / 50.44 / 57.25 / 74.25 / 10.69`

### Current cash (going into Season 3)

`42350 / 91178.75 / 111612.5 / 116591.79 / 134150 / 234100 / 39362.99`

### Current liquidity (going into Season 3)

Definition: `cash + receivables - payables`

`70350 / 131101.25 / 153150 / 157254.29 / 182732.5 / 283100 / 42259.94`

## Source of truth

The full machine-readable dataset, including:
- per-combination summaries
- overall summaries
- raw run rows

is stored at:

`web/scripts/results/two-season-build-spouse-kpi-matrix.json`

The script that generated it is:

`web/scripts/simulate-build-spouse-kpi-matrix.ts`

## Notes for future Season 3 testing

- Treat this file as the benchmark reference for the game state right before `pre-season 3`
- When Season 3 is implemented or rebalanced, compare new results against this checkpoint first
- If the checkpoint definition changes, update this file explicitly rather than silently reusing the old label
- Raw visibility and reputation were updated after Season 1 -> 2 carryover resolutions began crediting their season-close soft-stat gains into the final Season 2 save state
