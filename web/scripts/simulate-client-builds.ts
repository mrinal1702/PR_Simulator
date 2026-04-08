/**
 * One-off simulation: three visibility profiles → client rolls (season 1).
 * Run: npx tsx --tsconfig tsconfig.json scripts/simulate-client-builds.ts
 */

import { buildSeasonClients } from "../lib/seasonClientLoop";
import {
  CLIENT_BUDGET_TIER_RANGES,
  computeBudgetTierDeterministic,
  plannedClientCountForSeason,
} from "../lib/clientEconomyMath";
import type { ClientKind } from "../lib/clientEconomyMath";

const SEED_BASE = "sim-player";
const SEASON = 1;
const REP = 5;

function inferTier(kind: ClientKind, total: number): 1 | 2 {
  const r = CLIENT_BUDGET_TIER_RANGES[kind];
  const t1 = r[1];
  const t2 = r[2];
  if (total >= t2.min && total <= t2.max) return 2;
  if (total >= t1.min && total <= t1.max) return 1;
  return total >= (t1.max + t2.min) / 2 ? 2 : 1;
}

const scenarios: { label: string; visibility: number; note: string }[] = [
  {
    label: "Max visibility",
    visibility: 116,
    note: "Velvet Rolodex 80 + Influential spouse +20 + Network +10 + two interns +6",
  },
  {
    label: "Min visibility",
    visibility: 24,
    note: "Portfolio Pivot 24, no network, no visibility from spouse/hires",
  },
  {
    label: "Mid visibility",
    visibility: 60,
    note: "Summa Cum Basement 30 + Network +10 + junior Sales Representative +20 visibility",
  },
];

for (const s of scenarios) {
  const count = plannedClientCountForSeason(SEASON, s.visibility, SEED_BASE);
  const clients = buildSeasonClients(SEED_BASE, SEASON, count, {
    reputation: REP,
    visibility: s.visibility,
  });

  console.log("\n" + "=".repeat(60));
  console.log(s.label);
  console.log(s.note);
  console.log(
    `→ Visibility ${s.visibility} · Reputation ${REP} · Season ${SEASON} client slots: ${count}`
  );
  clients.forEach((c, i) => {
    const tier = inferTier(c.clientKind, c.budgetTotal);
    const tierCheck = computeBudgetTierDeterministic(
      `${SEED_BASE}|s${SEASON}|c${i}|${REP}|${s.visibility}|tier`,
      SEASON,
      s.visibility,
      REP
    );
    console.log(
      `   ${i + 1}. ${c.clientKind.padEnd(14)} tier ${tier} (code tier ${tierCheck}) · EUR ${c.budgetTotal.toLocaleString("en-GB")} (S1 ${c.budgetSeason1.toLocaleString("en-GB")} / S2 ${c.budgetSeason2.toLocaleString("en-GB")})`
    );
  });
}

console.log("\n");
