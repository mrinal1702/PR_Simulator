import type { NewGamePayload } from "@/components/NewGameWizard";
import { getHireAdjustmentMultipliers } from "@/lib/shoppingCenter";
import {
  getHiringNamePoolStrings,
  HIRING_NAME_ROWS,
  type HiringNameSeniority,
} from "@/lib/hiringNamesPool";

export type HiringRole = "data_analyst" | "campaign_manager" | "sales_representative";
export type HiringTier = "intern" | "junior" | "mid" | "senior";

export type Candidate = {
  id: string;
  name: string;
  role: HiringRole;
  tier: HiringTier;
  salary: number;
  description: string;
  hiddenProductivityPct: number;
  hiddenSkillScore: number;
};

/** Roster blurb for this exact role + tier + name (optional per row in `HIRING_NAME_ROWS`). */
function getHireBlurbForCandidate(
  role: HiringRole,
  tier: HiringTier,
  fullName: string
): string | undefined {
  const seniority: HiringNameSeniority = tier === "intern" ? "intern" : tier;
  const row = HIRING_NAME_ROWS.find(
    (r) => r.employeeType === role && r.seniority === seniority && r.fullName === fullName
  );
  return row?.hireBlurb;
}

const ROLE_LABELS: Record<HiringRole, string> = {
  data_analyst: "Data Analyst",
  campaign_manager: "Campaign Manager",
  sales_representative: "Sales Representative",
};

const TIER_BANDS: Record<
  Exclude<HiringTier, "intern">,
  { minSalary: number; maxSalary: number; anchors: number[]; minSkill: number; maxSkill: number }
> = {
  junior: { minSalary: 15_000, maxSalary: 39_000, anchors: [15, 20, 25, 30, 35], minSkill: 10, maxSkill: 20 },
  mid: { minSalary: 40_000, maxSalary: 64_000, anchors: [40, 45, 50, 55, 60], minSkill: 25, maxSkill: 40 },
  senior: { minSalary: 65_000, maxSalary: 89_000, anchors: [65, 70, 75, 80, 85], minSkill: 50, maxSkill: 80 },
};

const JUNIOR_BAND_SKILL_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 10, max: 14 },
  2: { min: 11, max: 15 },
  3: { min: 12, max: 17 },
  4: { min: 14, max: 18 },
  5: { min: 15, max: 20 },
};

export function roleLabel(role: HiringRole): string {
  return ROLE_LABELS[role];
}

export function getHireCapForSeason(season: number): number {
  return Math.max(2, season + 1);
}

/**
 * Agency-wide employee headcount cap by season.
 * All seasons are currently hard-capped to 5 total employees.
 * Future office purchase upgrades can raise this cap.
 */
export function getAgencyHeadcountCapForSeason(season: number): number {
  return 5;
}

export function getSalaryBands(tier: HiringTier): Array<{ index: number; label: string; anchor: number }> {
  if (tier === "intern") return [{ index: 1, label: "10k fixed", anchor: 10 }];
  const cfg = TIER_BANDS[tier];
  return cfg.anchors.map((a, i) => ({
    index: i + 1,
    label: `${a}k-${a + 4}k (salary ${a}k)`,
    anchor: a,
  }));
}

export function normalizeSalary(tier: HiringTier, salaryInput: number): number {
  if (tier === "intern") return 10_000;
  const cfg = TIER_BANDS[tier];
  const clamped = Math.min(cfg.maxSalary, Math.max(cfg.minSalary, salaryInput));
  return Math.floor(clamped / 5000) * 5000;
}

/** Talent Bazaar cards per tier: 3 interns / 3 juniors / 2 mid / 1 senior. */
export function talentBazaarSlotCount(tier: HiringTier): number {
  switch (tier) {
    case "intern":
      return 3;
    case "junior":
      return 3;
    case "mid":
      return 2;
    case "senior":
      return 1;
  }
}

/**
 * Names that must not appear as Talent Bazaar candidates: banned (fired / hired intern),
 * current payroll, and (for junior only) names already shown in any junior salary band.
 */
export function getTalentBazaarExcludedNames(
  save: Pick<
    NewGamePayload,
    "talentBazaarBannedNames" | "talentBazaarJuniorNamesUsed" | "employees"
  >,
  tier: HiringTier
): string[] {
  const banned = new Set(save.talentBazaarBannedNames ?? []);
  const payroll = new Set((save.employees ?? []).map((e) => e.name));
  const juniorUsed = new Set(save.talentBazaarJuniorNamesUsed ?? []);
  const out = new Set<string>();
  for (const n of banned) out.add(n);
  for (const n of payroll) out.add(n);
  if (tier === "junior") {
    for (const n of juniorUsed) out.add(n);
  }
  return [...out];
}

/** After showing a junior candidate list, those names cannot appear again at another junior salary band. */
export function mergeTalentBazaarJuniorConsumed(save: NewGamePayload, displayedNames: string[]): NewGamePayload {
  if (displayedNames.length === 0) return save;
  const prev = new Set(save.talentBazaarJuniorNamesUsed ?? []);
  for (const n of displayedNames) prev.add(n);
  return { ...save, talentBazaarJuniorNamesUsed: [...prev] };
}

/** Fired employees and hired interns never return to the Bazaar. */
export function banTalentBazaarName(save: NewGamePayload, name: string): NewGamePayload {
  const prev = new Set(save.talentBazaarBannedNames ?? []);
  if (prev.has(name)) return save;
  prev.add(name);
  return { ...save, talentBazaarBannedNames: [...prev] };
}

export function generateCandidates(args: {
  seedBase: string;
  season: number;
  role: HiringRole;
  tier: HiringTier;
  salary: number;
  reputation: number;
  visibility: number;
  /** Full names to skip (payroll, bans, junior cross-band consumption, etc.). */
  excludedNames?: string[];
  /** When set, applies shopping-center HR multipliers (skills test / reference checks). */
  save?: NewGamePayload;
}): Candidate[] {
  const bucketSeed = `${args.seedBase}|s${args.season}|${args.role}|${args.tier}|${args.salary}`;
  // Names: pool is role + seniority only; pick seed excludes salary so anchors do not swap which roster names appear.
  const namePickSeed = `${args.seedBase}|s${args.season}|${args.role}|${args.tier}`;
  const allNames = getHiringNamePoolStrings(args.role, args.tier);
  const excluded = new Set(args.excludedNames ?? []);
  const pool = allNames.filter((n) => !excluded.has(n));
  const slotCount = talentBazaarSlotCount(args.tier);
  const uniqueNames = deterministicPickUnique(pool, slotCount, `${namePickSeed}|names`);
  const descriptionPool = getDescriptionPool(args.role, args.tier, args.salary);
  const uniqueDescriptions = deterministicPickUnique(
    descriptionPool,
    uniqueNames.length,
    `${bucketSeed}|descriptions`
  );
  return uniqueNames.map((name, idx) => {
    const seed = `${bucketSeed}|c${idx}`;
    let productivity = resolveProductivity(seed);
    let skill = resolveSkill({
      seed,
      tier: args.tier,
      salary: args.salary,
      reputation: args.reputation,
      visibility: args.visibility,
      role: args.role,
    });
    if (args.save) {
      const m = getHireAdjustmentMultipliers(args.save);
      productivity = Math.min(80, Math.round(productivity * m.productivityMultiplier));
      skill = Math.round(skill * m.skillMultiplier);
    }
    const fixedHireBlurb = getHireBlurbForCandidate(args.role, args.tier, name);
    return {
      id: `cand-${hash32(seed)}`,
      name,
      role: args.role,
      tier: args.tier,
      salary: args.salary,
      description: fixedHireBlurb ?? uniqueDescriptions[idx]!,
      hiddenProductivityPct: productivity,
      hiddenSkillScore: skill,
    };
  });
}

function resolveProductivity(seed: string): number {
  // Hiring-time productivity roll is intentionally capped at 80%.
  return Math.round(rand01(`${seed}|prod`) * 80);
}

export function capacityGainFromProductivity(productivityPct: number): number {
  const clamped = Math.max(0, Math.min(100, productivityPct));
  // Capacity maps from 10..25 where 25 is theoretical at 100%.
  return Math.round(10 + (clamped / 100) * 15);
}

export function splitBalancedSkill(
  totalSkill: number,
  seed: string
): { competence: number; visibility: number } {
  const total = Math.max(0, Math.round(totalSkill));
  if (total === 0) return { competence: 0, visibility: 0 };
  const baseCompetence = Math.floor(total / 2);
  // Small randomized tilt: -2..+2, clamped so both channels stay >= 0.
  const rawTilt = Math.floor(rand01(`${seed}|split`) * 5) - 2;
  const minComp = Math.max(0, total - 20);
  const maxComp = Math.min(total, 20);
  const competence = Math.max(minComp, Math.min(maxComp, baseCompetence + rawTilt));
  return { competence, visibility: total - competence };
}

function resolveSkill(args: {
  seed: string;
  tier: HiringTier;
  salary: number;
  reputation: number;
  visibility: number;
  role: HiringRole;
}): number {
  if (args.tier === "intern") return 6;
  const cfg = TIER_BANDS[args.tier];
  const anchorK = args.salary / 1000;
  const bandIndex = Math.max(1, cfg.anchors.findIndex((a) => a === anchorK) + 1);
  const progress = (bandIndex - 1) / Math.max(1, cfg.anchors.length - 1);
  const base = cfg.minSkill + (cfg.maxSkill - cfg.minSkill) * progress;
  const repN = Math.max(0, Math.min(1, args.reputation / 100));
  const visN = Math.max(0, Math.min(1, args.visibility / 300));
  const weighted =
    args.role === "data_analyst"
      ? repN * 0.65 + visN * 0.35
      : args.role === "sales_representative"
      ? repN * 0.35 + visN * 0.65
      : repN * 0.5 + visN * 0.5;
  const attract = Math.sqrt(weighted);
  const variance = (rand01(`${args.seed}|skill`) - 0.5) * 0.18;
  const finalSkill = base * (0.92 + attract * 0.14 + variance);
  const rounded = Math.round(finalSkill);
  if (args.tier === "junior") {
    const bandRange = JUNIOR_BAND_SKILL_RANGES[bandIndex] ?? JUNIOR_BAND_SKILL_RANGES[1];
    return Math.max(bandRange.min, Math.min(bandRange.max, rounded));
  }
  return Math.max(cfg.minSkill, Math.min(cfg.maxSkill, rounded));
}

function getDescriptionPool(role: HiringRole, tier: HiringTier, salary: number): string[] {
  if (tier === "intern") {
    return [
      "Fast learner, brave with chaos, and excellent at emergency checklists.",
      "Shows up early, asks sharp questions, and survives feedback storms.",
      "Quick on admin, quick on notes, quicker than expected under pressure.",
      "Still learning the playbook but already useful in messy situations.",
      "Low ego, high hustle, and unreasonably calm around deadlines.",
    ];
  }
  const prefix = `${roleLabel(role)} at ${Math.round(salary / 1000)}k band.`;
  return [
    `${prefix} Gets things done before panic becomes policy.`,
    `${prefix} Brings structure, grit, and suspiciously good timing.`,
    `${prefix} Handles pressure well and misses fewer obvious traps.`,
    `${prefix} Stays on message while everything else is on fire.`,
    `${prefix} Practical, adaptable, and rarely needs the same note twice.`,
  ];
}

function deterministicPickUnique(pool: string[], count: number, seed: string): string[] {
  const withScores = pool.map((item, idx) => ({
    item,
    score: hash32(`${seed}|${idx}|${item}`),
  }));
  withScores.sort((a, b) => a.score - b.score);
  return withScores.slice(0, Math.min(count, pool.length)).map((x) => x.item);
}

function rand01(seed: string): number {
  return (hash32(seed) >>> 0) / 4294967295;
}

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

