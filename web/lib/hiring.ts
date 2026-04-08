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

const MALE_NAMES = [
  "Liam Carter",
  "Arjun Rao",
  "Mateo Alvarez",
  "Noah Kim",
  "Omar Rahman",
  "Nikolai Sokolov",
  "Kwame Boateng",
  "Thiago Lima",
  "Haruto Sato",
  "Tariq Khalil",
];
const FEMALE_NAMES = [
  "Ava Nguyen",
  "Mia Chen",
  "Ananya Rao",
  "Fatima Diallo",
  "Lucia Vega",
  "Elena Bianchi",
  "Thandi Moyo",
  "Yuna Sato",
  "Camila Cruz",
  "Noor Siddiqui",
];

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

export function roleLabel(role: HiringRole): string {
  return ROLE_LABELS[role];
}

export function getHireCapForSeason(season: number): number {
  return Math.max(2, season + 1);
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

export function generateCandidates(args: {
  seedBase: string;
  season: number;
  role: HiringRole;
  tier: HiringTier;
  salary: number;
  reputation: number;
  visibility: number;
}): Candidate[] {
  const bucketSeed = `${args.seedBase}|s${args.season}|${args.role}|${args.tier}|${args.salary}`;
  return [0, 1, 2].map((idx) => {
    const seed = `${bucketSeed}|c${idx}`;
    const name = pickName(seed);
    const productivity = resolveProductivity(seed);
    const skill = resolveSkill({
      seed,
      tier: args.tier,
      salary: args.salary,
      reputation: args.reputation,
      visibility: args.visibility,
      role: args.role,
    });
    return {
      id: `cand-${hash32(seed)}`,
      name,
      role: args.role,
      tier: args.tier,
      salary: args.salary,
      description: makeDescription(args.role, args.tier, args.salary, seed),
      hiddenProductivityPct: productivity,
      hiddenSkillScore: skill,
    };
  });
}

function resolveProductivity(seed: string): number {
  return Math.round(25 + rand01(`${seed}|prod`) * 75);
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
  return Math.max(cfg.minSkill, Math.min(cfg.maxSkill, Math.round(finalSkill)));
}

function makeDescription(role: HiringRole, tier: HiringTier, salary: number, seed: string): string {
  if (tier === "intern") return "Fast learner, brave with chaos, and excellent at emergency checklists.";
  const flavor = Math.floor(rand01(`${seed}|desc`) * 3);
  const tone =
    flavor === 0
      ? "Gets things done before panic becomes policy."
      : flavor === 1
      ? "Brings structure, grit, and suspiciously good timing."
      : "Handles pressure well and misses fewer obvious traps.";
  return `${roleLabel(role)} at ${Math.round(salary / 1000)}k band. ${tone}`;
}

function pickName(seed: string): string {
  const all = [...MALE_NAMES, ...FEMALE_NAMES];
  return all[Math.floor(rand01(`${seed}|name`) * all.length)];
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

