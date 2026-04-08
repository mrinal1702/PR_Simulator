/**
 * 10-run Season 1 client slot distribution (2 vs 3) by visibility at roll.
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-slot-runs.ts
 */

import { plannedClientCountForSeason, season1ThirdClientProbability } from "../lib/clientEconomyMath";

const SEASON = 1;
const seeds = Array.from({ length: 10 }, (_, i) => `20260408T120000Z|run-${i}`);

type Row = { build: string; vis: number; note: string };

const scenarios: { name: string; rows: Row[] }[] = [
  {
    name: "MAX visibility (influential + network + max affordable interns)",
    rows: [
      { build: "Velvet Rolodex", vis: 80 + 20 + 10 + 3, note: "1 intern (second intern unaffordable at 16k after 10k hire)" },
      { build: "Summa Cum Basement", vis: 30 + 20 + 10 + 3, note: "1 intern" },
      {
        build: "Portfolio Pivot",
        vis: 24 + 20 + 10 + 3 + 3,
        note: "2 interns (80k cash; higher vis possible with Sales Rep instead — not counted here)",
      },
    ],
  },
  {
    name: "MID visibility (~anchor 60 where possible)",
    rows: [
      { build: "Velvet Rolodex", vis: 80, note: "supportive + workshop; no network (floor 80)" },
      { build: "Summa Cum Basement", vis: 30 + 20 + 10, note: "influential + network, no hires → 60" },
      { build: "Portfolio Pivot", vis: 24 + 20 + 10 + 3, note: "influential + network + 1 intern → 57" },
    ],
  },
  {
    name: "MIN visibility",
    rows: [
      { build: "Velvet Rolodex", vis: 80, note: "supportive + workshop (floor 80)" },
      { build: "Summa Cum Basement", vis: 30, note: "rich + workshop" },
      { build: "Portfolio Pivot", vis: 22, note: "rich + workshop" },
    ],
  },
];

function summarize(vis: number) {
  const p3 = season1ThirdClientProbability(vis);
  const two = seeds.filter((s) => plannedClientCountForSeason(SEASON, vis, s) === 2).length;
  return { p3, two, three: 10 - two };
}

for (const sc of scenarios) {
  console.log("\n" + "=".repeat(72));
  console.log(sc.name);
  for (const r of sc.rows) {
    const { p3, two, three } = summarize(r.vis);
    console.log(
      `  ${r.build}: visibility=${r.vis}  P(3rd slot)=${p3.toFixed(3)}  →  2 clients ${two}/10  |  3 clients ${three}/10`
    );
    console.log(`    (${r.note})`);
  }
}
