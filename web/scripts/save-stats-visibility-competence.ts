/**
 * Max visibility/competence (pre-season + up to 2 hires, best-of-3 candidates each),
 * plus 100 randomized saves — distribution stats.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/save-stats-visibility-competence.ts
 */

import { applySpouseAtStart, STARTING_BUILD_STATS, type BuildId, type SpouseType } from "../lib/gameEconomy";
import {
  generateCandidates,
  getSalaryBands,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "../lib/hiring";

const REP = 5;
const SEASON = 1;
const HIRE_CAP = 2; // getHireCapForSeason(1)

type Activity = "network" | "workshop" | "none";

type Stats = { eur: number; competence: number; visibility: number; firmCapacity: number };

function applyActivity(base: Stats, activity: Activity): Stats {
  if (activity === "network") return { ...base, visibility: base.visibility + 10 };
  if (activity === "workshop") return { ...base, competence: base.competence + 10 };
  return base;
}

function applyHire(stats: Stats, c: Candidate, mode: "intern" | "full_time"): Stats {
  const productivity = Math.round(c.hiddenProductivityPct);
  const skill = Math.round(c.hiddenSkillScore);
  let competenceGain = 0;
  let visibilityGain = 0;
  if (mode === "intern") {
    competenceGain = 3;
    visibilityGain = 3;
  } else if (c.role === "data_analyst") {
    competenceGain = skill;
  } else if (c.role === "sales_representative") {
    visibilityGain = skill;
  } else {
    const split = splitBalancedSkill(skill, `${c.id}|split`);
    competenceGain = split.competence;
    visibilityGain = split.visibility;
  }
  return {
    eur: stats.eur - c.salary,
    competence: stats.competence + competenceGain,
    visibility: stats.visibility + visibilityGain,
    firmCapacity: stats.firmCapacity,
  };
}

function bestCandidate(seedBase: string, cands: Candidate[]): Candidate {
  return cands.reduce((a, b) => (a.hiddenSkillScore >= b.hiddenSkillScore ? a : b));
}

type HireChoice =
  | { kind: "intern" }
  | { kind: "full_time"; role: HiringRole; tier: Exclude<HiringTier, "intern">; salary: number };

function listAffordableFullTime(eur: number): HireChoice[] {
  const out: HireChoice[] = [];
  const tiers: Exclude<HiringTier, "intern">[] = ["junior", "mid", "senior"];
  const roles: HiringRole[] = ["data_analyst", "sales_representative", "campaign_manager"];
  for (const tier of tiers) {
    for (const anchor of getSalaryBands(tier).map((b) => b.anchor * 1000)) {
      if (anchor > eur) continue;
      for (const role of roles) {
        out.push({ kind: "full_time", role, tier, salary: anchor });
      }
    }
  }
  return out;
}

function dfsMaxVisibility(
  stats: Stats,
  seedBase: string,
  depth: number,
  path: string
): number {
  let best = stats.visibility;
  if (depth >= HIRE_CAP) return best;

  const choices: HireChoice[] = [];
  if (stats.eur >= 10_000) choices.push({ kind: "intern" });
  choices.push(...listAffordableFullTime(stats.eur));

  for (const ch of choices) {
    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP,
        visibility: stats.visibility,
      });
    }
    const pick = bestCandidate(seedBase, cands);
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    const next = applyHire(stats, pick, mode);
    const v = dfsMaxVisibility(next, seedBase, depth + 1, `${path}|${depth}`);
    if (v > best) best = v;
  }
  return best;
}

function dfsMaxCompetence(stats: Stats, seedBase: string, depth: number): number {
  let best = stats.competence;
  if (depth >= HIRE_CAP) return best;

  const choices: HireChoice[] = [];
  if (stats.eur >= 10_000) choices.push({ kind: "intern" });
  choices.push(...listAffordableFullTime(stats.eur));

  for (const ch of choices) {
    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP,
        visibility: stats.visibility,
      });
    }
    const pick = bestCandidate(seedBase, cands);
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    const next = applyHire(stats, pick, mode);
    const c = dfsMaxCompetence(next, seedBase, depth + 1);
    if (c > best) best = c;
  }
  return best;
}

// --- Max stats: search all build × spouse × (network or workshop) with DFS, seed fixed for candidate pools
const builds: BuildId[] = ["velvet_rolodex", "summa_cum_basement", "portfolio_pivot"];
const spouses: SpouseType[] = ["supportive", "influential", "rich", "none"];

let globalMaxVis = 0;
let globalMaxVisDesc = "";
let globalMaxComp = 0;
let globalMaxCompDesc = "";

for (const b of builds) {
  for (const sp of spouses) {
    const base = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[b], sp), "network");
    const seedV = `max-vis|${b}|${sp}`;
    const v = dfsMaxVisibility(base, seedV, 0, "");
    if (v > globalMaxVis) {
      globalMaxVis = v;
      globalMaxVisDesc = `build=${b} spouse=${sp} activity=network (best-of-3 per hire, DFS over hire types/order)`;
    }

    const baseC = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[b], sp), "workshop");
    const seedC = `max-comp|${b}|${sp}`;
    const c = dfsMaxCompetence(baseC, seedC, 0);
    if (c > globalMaxComp) {
      globalMaxComp = c;
      globalMaxCompDesc = `build=${b} spouse=${sp} activity=workshop`;
    }
  }
}

console.log("=== THEORETICAL MAX (implemented rules, best-of-3 candidates, hire cap 2) ===\n");
console.log(`MAX visibility (after pre-season Network +10): ${globalMaxVis}`);
console.log(`  ${globalMaxVisDesc}\n`);
console.log(`MAX competence (after pre-season Workshop +10): ${globalMaxComp}`);
console.log(`  ${globalMaxCompDesc}\n`);

// --- Refine: print winning path by re-running DFS with trace (only for winner combo)
function traceMaxVis(build: BuildId, spouse: SpouseType): void {
  const base = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[build], spouse), "network");
  const seedBase = `max-vis|${build}|${spouse}`;

  function rec(stats: Stats, depth: number, steps: string[]): { vis: number; steps: string[] } {
    let best: { vis: number; steps: string[] } = { vis: stats.visibility, steps: [...steps] };
    if (depth >= HIRE_CAP) return best;

    const choices: HireChoice[] = [];
    if (stats.eur >= 10_000) choices.push({ kind: "intern" });
    choices.push(...listAffordableFullTime(stats.eur));

    for (const ch of choices) {
      let cands: Candidate[];
      if (ch.kind === "intern") {
        cands = generateCandidates({
          seedBase,
          season: SEASON,
          role: "campaign_manager",
          tier: "intern",
          salary: 10_000,
          reputation: REP,
          visibility: stats.visibility,
        });
      } else {
        cands = generateCandidates({
          seedBase,
          season: SEASON,
          role: ch.role,
          tier: ch.tier,
          salary: ch.salary,
          reputation: REP,
          visibility: stats.visibility,
        });
      }
      const pick = bestCandidate(seedBase, cands);
      const mode = ch.kind === "intern" ? "intern" : "full_time";
      const line =
        ch.kind === "intern"
          ? `intern (best skill ${pick.hiddenSkillScore} → +3/+3 vis)`
          : `${ch.role} ${ch.tier} ${ch.salary}€ (best skill ${pick.hiddenSkillScore} → ${ch.role === "sales_representative" ? "all to vis" : "split"})`;
      const next = applyHire(stats, pick, mode);
      const r = rec(next, depth + 1, [...steps, line]);
      if (r.vis > best.vis) best = r;
    }
    return best;
  }

  const out = rec(base, 0, []);
  console.log(`Trace for max-vis winner (${build} / ${spouse}):`);
  console.log(`  Start: vis=${base.visibility} eur=${base.eur}`);
  out.steps.forEach((s, i) => console.log(`  Hire ${i + 1}: ${s}`));
  console.log(`  Final visibility: ${out.vis}\n`);
}

// Trace only if we know winner from loop - find winner
for (const b of builds) {
  for (const sp of spouses) {
    const base = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[b], sp), "network");
    const v = dfsMaxVisibility(base, `max-vis|${b}|${sp}`, 0, "");
    if (v === globalMaxVis) {
      traceMaxVis(b, sp);
      break;
    }
  }
}

// --- Permutation note
const coarsePermutations =
  builds.length * spouses.length * 3 * Math.pow(1 + 1 + 3 * 3 * 5, 2); // rough lower bound
console.log(
  `Coarse lower bound on distinct (build×spouse×activity×2 hire slots with role/tier variety): ${coarsePermutations} — >> 100, using 100 random samples.\n`
);

// --- Mulberry32 PRNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChoice<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - idx) + sorted[hi]! * (idx - lo);
}

const N = 100;
const rng = mulberry32(0x20260408);

const visSamples: number[] = [];
const compSamples: number[] = [];

for (let i = 0; i < N; i += 1) {
  const b = randomChoice(rng, builds);
  const sp = randomChoice(rng, spouses);
  const activity = randomChoice(rng, ["network", "workshop", "none"] as const);
  let stats = applyActivity(applySpouseAtStart(STARTING_BUILD_STATS[b], sp), activity);
  const seedBase = `rand-save-${i}|${b}|${sp}|${activity}`;

  let hires = 0;
  while (hires < HIRE_CAP) {
    const canIntern = stats.eur >= 10_000;
    const ftOptions = listAffordableFullTime(stats.eur);
    const totalChoices = (canIntern ? 1 : 0) + ftOptions.length;
    if (totalChoices === 0) break;

    let pickIdx = Math.floor(rng() * totalChoices);
    let ch: HireChoice;
    if (canIntern && pickIdx === 0) {
      ch = { kind: "intern" };
    } else {
      if (canIntern) pickIdx -= 1;
      if (pickIdx < 0 || pickIdx >= ftOptions.length) {
        ch = canIntern ? { kind: "intern" } : ftOptions[0]!;
      } else {
        ch = ftOptions[pickIdx]!;
      }
    }

    let cands: Candidate[];
    if (ch.kind === "intern") {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: "campaign_manager",
        tier: "intern",
        salary: 10_000,
        reputation: REP,
        visibility: stats.visibility,
      });
    } else {
      cands = generateCandidates({
        seedBase,
        season: SEASON,
        role: ch.role,
        tier: ch.tier,
        salary: ch.salary,
        reputation: REP,
        visibility: stats.visibility,
      });
    }
    const pickIdxCand = Math.floor(rng() * 3);
    const pick = cands[pickIdxCand]!;
    const mode = ch.kind === "intern" ? "intern" : "full_time";
    stats = applyHire(stats, pick, mode);
    hires += 1;
  }

  visSamples.push(stats.visibility);
  compSamples.push(stats.competence);
}

function summary(name: string, arr: number[]) {
  const s = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  console.log(`${name}:`);
  console.log(`  mean: ${mean.toFixed(2)}`);
  console.log(`  median (p50): ${percentile(s, 0.5).toFixed(2)}`);
  console.log(`  Q1 (p25): ${percentile(s, 0.25).toFixed(2)}`);
  console.log(`  Q3 (p75): ${percentile(s, 0.75).toFixed(2)}`);
}

console.log(`=== ${N} RANDOMIZED SAVES (uniform build/spouse/activity; random hire path & random candidate 0–2) ===\n`);
summary("Visibility", visSamples);
console.log("");
summary("Competence", compSamples);
