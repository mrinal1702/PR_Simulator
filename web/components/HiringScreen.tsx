"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { NewGamePayload } from "@/components/NewGameWizard";
import { GAME_TITLE } from "@/lib/onboardingContent";
import {
  banTalentBazaarName,
  capacityGainFromProductivity,
  generateCandidates,
  getAgencyHeadcountCap,
  getHireCapForSeason,
  getSalaryBands,
  getTalentBazaarExcludedNames,
  mergeTalentBazaarJuniorConsumed,
  roleLabel,
  splitBalancedSkill,
  type Candidate,
  type HiringRole,
  type HiringTier,
} from "@/lib/hiring";
import { loadSave, persistSave } from "@/lib/saveGameStorage";
import { getEffectiveCompetenceForAgency, getEffectiveVisibilityForAgency } from "@/lib/agencyStatsEffective";
import { liquidityEur, wageLineId } from "@/lib/payablesReceivables";
import { hasUnresolvedSalaryNegotiationV3 } from "@/lib/preseasonSalaryNegotiation";
import { AgencyResourceStrip } from "@/components/AgencyResourceStrip";
import { AgencyFinanceBreakdownHost } from "@/components/AgencyFinanceBreakdownHost";
import { AgencyFinanceSnapshot } from "@/components/AgencyFinanceSnapshot";
import { ResourceSymbol } from "@/components/resourceSymbols";
import type { BreakdownMetric } from "@/lib/metricBreakdown";

const HIRING_ROLE_OPTIONS: {
  id: HiringRole;
  title: string;
  focusLabel: string;
  symbols: Array<"competence" | "visibility">;
}[] = [
  { id: "data_analyst", title: "Data Analyst", focusLabel: "Competence Focus", symbols: ["competence"] },
  {
    id: "sales_representative",
    title: "Sales Representative",
    focusLabel: "Visibility Focus",
    symbols: ["visibility"],
  },
  {
    id: "campaign_manager",
    title: "Campaign Manager",
    focusLabel: "Balanced Focus",
    symbols: ["competence", "visibility"],
  },
];

/**
 * Hire modal: band labels instead of raw % (same label for every role and seniority).
 * Clarity first, light humor.
 */
function hiringReportProductivityBandLabel(productivityPct: number): string {
  if (productivityPct <= 25) return "Slacker";
  if (productivityPct <= 50) return "Okay-ish";
  if (productivityPct <= 75) return "Workhorse";
  return "Machine";
}

function hiringReportSkillBandLabel(skillPct: number): string {
  if (skillPct <= 25) return "Still learning";
  if (skillPct <= 50) return "Capable enough";
  if (skillPct <= 75) return "Sharp";
  return "Elite";
}

/** 0–3 worst→best; same breakpoints as labels (hire modal colors only, no effect on hire math). */
type HiringReportBandTier = 0 | 1 | 2 | 3;

function hiringReportBandTierFromPct(pct: number): HiringReportBandTier {
  if (pct <= 25) return 0;
  if (pct <= 50) return 1;
  if (pct <= 75) return 2;
  return 3;
}

/** Red → yellow → light green → dark green (worse → better). */
const HIRING_REPORT_BAND_LABEL_STYLE: Record<HiringReportBandTier, CSSProperties> = {
  0: { color: "#b91c1c", fontWeight: 600 },
  1: { color: "#ca8a04", fontWeight: 600 },
  2: { color: "#65a30d", fontWeight: 600 },
  3: { color: "#14532d", fontWeight: 600 },
};

/** 0–25% productivity (name-interpolated): tier flavor — intern vs junior vs mid vs senior. */
function hiringReportLowProductivityIntern(name: string): string {
  return `${name} has optimized the reaction-emoji pipeline and filed the real work under "Phase 2 (TBD)."`;
}

function hiringReportLowProductivityJunior(name: string): string {
  return `${name} is still in the "how to look busy without a body double" bootcamp—capacity exists, output is in beta.`;
}

function hiringReportLowProductivityMid(name: string): string {
  return `${name} has enough years on the badge to calendar-block "deep work" and still spend it in a meeting about meetings.`;
}

function hiringReportLowProductivitySenior(name: string): string {
  return `${name} has ascended to strategic presence: the deck is mostly implied, like a pension you can feel.`;
}

type FTNonInternTier = Exclude<HiringTier, "intern">;

function hiringReportLowProductivityForTier(tier: FTNonInternTier, name: string): string {
  switch (tier) {
    case "junior":
      return hiringReportLowProductivityJunior(name);
    case "mid":
      return hiringReportLowProductivityMid(name);
    case "senior":
      return hiringReportLowProductivitySenior(name);
  }
}

/** Lowest skill tier (≤25% of band), full-time — by role and by seniority tier. */
const HIRING_LOW_SKILL_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} thinks a heat map is weather and "clean the data" means alphabetizing the tab names.`,
  sales_representative: (name) =>
    `${name} could circle back to a circle back—closing is mostly a season-finale cliffhanger.`,
  campaign_manager: (name) =>
    `${name} thinks the brief is a vibe check and the RACI chart is modern art.`,
};

const HIRING_LOW_SKILL_MID: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} hides columns instead of fixing them—mid-level Excel, junior-level courage, veteran-level denial.`,
  sales_representative: (name) =>
    `${name} calls it "relationship farming" when the pipeline is last year's leads wearing a new LinkedIn banner.`,
  campaign_manager: (name) =>
    `${name} says "alignment" on slide 47 and still hasn't admitted what the product is called.`,
};

const HIRING_LOW_SKILL_SENIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} cites "industry benchmarks" while the model is mostly gut feel in a tie.`,
  sales_representative: (name) =>
    `${name} could filibuster a forecast—closing moved to "when the stars align (FY27)."`,
  campaign_manager: (name) =>
    `${name} holds the wheel on the brand wagon; the roadmap is a mood board and the GPS is prayer.`,
};

function hiringReportLowSkillLineForTier(
  tier: FTNonInternTier,
  role: HiringRole,
  name: string
): string {
  const table =
    tier === "junior"
      ? HIRING_LOW_SKILL_JUNIOR
      : tier === "mid"
        ? HIRING_LOW_SKILL_MID
        : HIRING_LOW_SKILL_SENIOR;
  return table[role](name);
}

/**
 * Hire report — productivity lines by band (name-interpolated where marked “custom”).
 *
 * | Band   | Intern           | Junior FT        | Mid FT           | Senior FT        |
 * |--------|------------------|------------------|------------------|------------------|
 * | 0–25   | custom           | custom           | custom           | custom           |
 * | 26–50  | custom (w/ jnr)  | same as intern   | custom           | custom           |
 * | 51–75  | custom           | custom           | custom           | custom           |
 * | 76–100 | custom           | custom           | custom           | custom           |
 */
function hiringReportProductivity26to50InternJunior(name: string): string {
  return `${name} still treats "tomorrow" like a renewable resource, but work actually ships—late, loud, and eventually labeled final_final.`;
}

function hiringReportProductivity26to50Mid(name: string): string {
  return `${name} can look fully booked all week—then real work still slips through: uneven, last-minute, but not imaginary.`;
}

function hiringReportProductivity26to50Senior(name: string): string {
  return `${name} could have floated the cycle on hand-wavy updates, but something solid still hit your inbox—rough, behind schedule, and not a paragraph you have to invent yourself.`;
}

/** 51–75%: strong output, but one persistent annoyance — tier flavor. */
function hiringReportProductivity51to75Intern(name: string): string {
  return `${name} throws real energy at whatever you point at—then misses the small polish: the file saved where nobody looks, or half the context in the wrong thread.`;
}

function hiringReportProductivity51to75Junior(name: string): string {
  return `${name} hits real deadlines, does the actual work, and takes direction well—but every status note reads like a chapter and the one-line ask hides under three friendly paragraphs.`;
}

function hiringReportProductivity51to75Mid(name: string): string {
  return `${name} carries the heavy lifting without drama on quality—but still banks half the calls for a meeting, including the bits everyone already nodded to in writing.`;
}

function hiringReportProductivity51to75Senior(name: string): string {
  return `${name} pulls weight when it matters and keeps pointless churn off the team—then burns a little of that time back reopening settled questions "for clarity," or narrating a doc you already signed off.`;
}

function hiringReportProductivity51to75ForTier(tier: FTNonInternTier, name: string): string {
  switch (tier) {
    case "junior":
      return hiringReportProductivity51to75Junior(name);
    case "mid":
      return hiringReportProductivity51to75Mid(name);
    case "senior":
      return hiringReportProductivity51to75Senior(name);
  }
}

/** 76–100%: star output + classic high-performer annoyance (short lines). */
function hiringReportProductivity76to100Intern(name: string): string {
  return `${name} ships scary-fast—and still skips the pub because "this tab is almost done."`;
}

function hiringReportProductivity76to100Junior(name: string): string {
  return `${name} is a workhorse all cycle—and treats Sunday Slack like bonus points nobody signed up for.`;
}

function hiringReportProductivity76to100Mid(name: string): string {
  return `${name} blasts through the heavy lifting—then books a Friday "quick sync" nobody asked for.`;
}

function hiringReportProductivity76to100Senior(name: string): string {
  return `${name} quietly saves the quarter—then drops "one tiny thing" in the thread after dinner.`;
}

function hiringReportProductivity76to100ForTier(tier: FTNonInternTier, name: string): string {
  switch (tier) {
    case "junior":
      return hiringReportProductivity76to100Junior(name);
    case "mid":
      return hiringReportProductivity76to100Mid(name);
    case "senior":
      return hiringReportProductivity76to100Senior(name);
  }
}

/** Skill 26–50% of band: full-time by role + tier — roast, then "but" competence. */
const HIRING_SKILL_26_50_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} is not winning a forecasting Nobel yet, but the joins line up, totals reconcile, and obvious junk gets flagged before it reaches a slide deck.`,
  sales_representative: (name) =>
    `${name} still says "circling back" like a catchphrase, but people answer, notes exist, and the pipeline has more reality than vibes.`,
  campaign_manager: (name) =>
    `${name} color-codes chaos first and the plan second, but stakeholders get answers, creatives get a brief, and launch day shows up on the calendar.`,
};

const HIRING_SKILL_26_50_MID: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} is not anyone's thesis advisor yet, but the numbers tie out, assumptions carry names, and wild spikes get questioned before they become a headline.`,
  sales_representative: (name) =>
    `${name} still smooth-talks a wobbly quarter, but calls get returned, the pipeline isn't mostly ghosts, and a few deals actually close on purpose.`,
  campaign_manager: (name) =>
    `${name} still builds part of the plan mid-air, but owners are clear, deadlines mean something, and legal sees the work before the customer does.`,
};

const HIRING_SKILL_26_50_SENIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} is not publishing methods papers, but executives read one version of the truth, caveats land where they belong, and nobody re-derives the baseline from scratch every Monday.`,
  sales_representative: (name) =>
    `${name} is not clubbing quotas in Q1, but rooms stay calm, stuck deals move, and leadership can repeat the forecast without improvising.`,
  campaign_manager: (name) =>
    `${name} won't trend for the case study, but the client hears one story, spend stays vaguely sane, and someone finally owns the ugly cross-team threads.`,
};

function hiringReportSkill26to50Line(tier: FTNonInternTier, role: HiringRole, name: string): string {
  const table =
    tier === "junior"
      ? HIRING_SKILL_26_50_JUNIOR
      : tier === "mid"
        ? HIRING_SKILL_26_50_MID
        : HIRING_SKILL_26_50_SENIOR;
  return table[role](name);
}

/** Skill 51–75%: solid value + one "but" — shorter lines, by role and tier. */
const HIRING_SKILL_51_75_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} turns messy inputs into calls people act on—but still slides the laptop over for a last-second sanity check.`,
  sales_representative: (name) =>
    `${name} closes real revenue without drama—but every update lands with exclamation points and screenshots.`,
  campaign_manager: (name) =>
    `${name} keeps launches upright without midnight heroics—but the "final" timeline is never quite final.`,
};

const HIRING_SKILL_51_75_MID: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} anchors the numbers execs quote—but "one quick sanity pass" quietly means a deep dive nobody scheduled.`,
  sales_representative: (name) =>
    `${name} patches ugly territories and posts real numbers—but victory laps always need you in the audience.`,
  campaign_manager: (name) =>
    `${name} herds cross-team chaos into shipped work—but "quick clarity" still eats another calendar block.`,
};

const HIRING_SKILL_51_75_SENIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} sets how truth is counted here—but a "tiny tweak" still rewrites half a workbook after hours.`,
  sales_representative: (name) =>
    `${name} drags bad quarters back with receipts—but the debrief always runs like a friendly interrogation.`,
  campaign_manager: (name) =>
    `${name} calms clients when the room gets hot—but copies half the company just so nobody is surprised.`,
};

function hiringReportSkill51to75Line(tier: FTNonInternTier, role: HiringRole, name: string): string {
  const table =
    tier === "junior"
      ? HIRING_SKILL_51_75_JUNIOR
      : tier === "mid"
        ? HIRING_SKILL_51_75_MID
        : HIRING_SKILL_51_75_SENIOR;
  return table[role](name);
}

/** Skill 76–100%: pure praise, role + tier — no "but". */
const HIRING_SKILL_76_100_JUNIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} pulls signal from messy inputs fast, explains it in plain language, and leaders forward the work without tacking on nervous caveats.`,
  sales_representative: (name) =>
    `${name} builds trust quickly, runs the pipeline like clockwork, and lands wins that quietly lift the whole team's quarter.`,
  campaign_manager: (name) =>
    `${name} turns fuzzy asks into plans the room actually follows, keeps every stream visible, and earns goodwill from creatives and clients alike.`,
};

const HIRING_SKILL_76_100_MID: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} is who the numbers review waits on: forecasts survive scrutiny, edge cases carry labels, and the headline still reads true in daylight.`,
  sales_representative: (name) =>
    `${name} unsticks accounts that have gone cold, steers long cycles with calm notes, and hands off relationships healthier than they arrived.`,
  campaign_manager: (name) =>
    `${name} runs complex programs with runway to spare—partners align early, risks surface before they become drama, and launch lands clean without heroics.`,
};

const HIRING_SKILL_76_100_SENIOR: Record<HiringRole, (name: string) => string> = {
  data_analyst: (name) =>
    `${name} sets the bar for how truth is counted here: frameworks stick, new hires learn from their files, and finance actually relaxes in reviews.`,
  sales_representative: (name) =>
    `${name} moves brutal quarters with calm authority—big rooms listen, stuck elephants shift, and revenue lands on the sheet with real names attached.`,
  campaign_manager: (name) =>
    `${name} is who leadership puts forward when stakes spike: clients steady, teams breathe again, and the work ships with pride intact all around.`,
};

function hiringReportSkill76to100Line(tier: FTNonInternTier, role: HiringRole, name: string): string {
  const table =
    tier === "junior"
      ? HIRING_SKILL_76_100_JUNIOR
      : tier === "mid"
        ? HIRING_SKILL_76_100_MID
        : HIRING_SKILL_76_100_SENIOR;
  return table[role](name);
}

type EmploymentMode = "intern" | "full_time";

/** Interns: productivity narrative only (fixed +3/+3 competence and visibility; no skill copy). */
type HireReport =
  | {
      hireKind: "intern";
      title: string;
      productivityBandLabel: string;
      productivityBandTier: HiringReportBandTier;
      productivityLine: string;
      capGain: number;
      competenceGain: number;
      visibilityGain: number;
    }
  | {
      hireKind: "full_time";
      title: string;
      productivityBandLabel: string;
      productivityBandTier: HiringReportBandTier;
      productivityLine: string;
      skillBandLabel: string;
      skillBandTier: HiringReportBandTier;
      skillLine: string;
      capGain: number;
      competenceGain: number;
      visibilityGain: number;
    };

export function HiringScreen({ season }: { season: number }) {
  const [save, setSave] = useState<NewGamePayload | null>(() => loadSave());
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<EmploymentMode>("intern");
  const [tier, setTier] = useState<Exclude<HiringTier, "intern">>("junior");
  const [role, setRole] = useState<HiringRole | null>(null);
  const [salary, setSalary] = useState<number>(15_000);
  const [stage, setStage] = useState<"home" | "results">("home");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hireReport, setHireReport] = useState<HireReport | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<Candidate | null>(null);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);

  if (!save) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>No active save found</h1>
        <Link href="/game/new" className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          New game
        </Link>
      </div>
    );
  }

  const seasonKey = String(season);
  const hiredThisSeason = save.hiresBySeason?.[seasonKey] ?? 0;
  const cap = getHireCapForSeason(season);
  const capReached = hiredThisSeason >= cap;
  const rosterCount = save.employees?.length ?? 0;
  const rosterCap = getAgencyHeadcountCap(save);
  const rosterAtCap = rosterCount >= rosterCap;
  const salaryOptions = useMemo(() => {
    if (mode === "intern") return [];
    return getSalaryBands(tier)
      .map((b) => b.anchor * 1000)
      .filter((value) => liquidityEur(save) >= value);
  }, [mode, tier, save]);
  const canAffordIntern = liquidityEur(save) >= 10_000;
  const canAffordSelected =
    mode === "intern" ? canAffordIntern : liquidityEur(save) >= salary;

  useEffect(() => {
    if (mode !== "full_time") return;
    if (salaryOptions.length === 0) return;
    if (!salaryOptions.includes(salary)) {
      setSalary(salaryOptions[0]);
    }
  }, [mode, salaryOptions, salary]);

  const salaryNegotiationLocked = season === 3 && hasUnresolvedSalaryNegotiationV3(save);

  const findEmployees = () => {
    if (capReached || rosterAtCap) return;
    if (mode === "full_time" && !role) return;
    if (!canAffordSelected) {
      setNotice("Insufficient budget for this hire.");
      return;
    }
    const selectionTier: HiringTier = mode === "intern" ? "intern" : tier;
    const selectionRole: HiringRole = mode === "intern" ? "campaign_manager" : (role as HiringRole);
    const selectedSalary = mode === "intern" ? 10_000 : salary;
    const excluded = getTalentBazaarExcludedNames(save, selectionTier);
    const next = generateCandidates({
      seedBase: `${save.createdAt}|${save.playerName}`,
      season,
      role: selectionRole,
      tier: selectionTier,
      salary: selectedSalary,
      reputation: save.reputation ?? 5,
      visibility: getEffectiveVisibilityForAgency(save),
      competence: getEffectiveCompetenceForAgency(save),
      excludedNames: excluded,
      save,
    });
    let saveAfterPool = save;
    if (selectionTier === "junior" && next.length > 0) {
      saveAfterPool = mergeTalentBazaarJuniorConsumed(
        save,
        next.map((c) => c.name)
      );
    }
    if (saveAfterPool !== save) {
      setSave(saveAfterPool);
      persistSave(saveAfterPool);
    }
    setCandidates(next);
    setStage("results");
    if (next.length === 0) {
      setNotice("No candidates left in the Talent Bazaar for this role and seniority.");
    } else {
      setNotice("");
    }
  };

  const finalizeHireCandidate = (candidate: Candidate) => {
    if (capReached || rosterAtCap) return;
    if (liquidityEur(save) < candidate.salary) {
      setNotice("Cannot hire: cash and receivables would not cover payables plus this wage.");
      return;
    }
    const productivity = Math.round(candidate.hiddenProductivityPct);
    const skill = Math.round(candidate.hiddenSkillScore);
    const capGain = capacityGainFromProductivity(productivity);
    let competenceGain = 0;
    let visibilityGain = 0;
    if (mode === "intern") {
      competenceGain = 3;
      visibilityGain = 3;
    } else if (candidate.role === "data_analyst") {
      competenceGain = skill;
    } else if (candidate.role === "sales_representative") {
      visibilityGain = skill;
    } else {
      const split = splitBalancedSkill(skill, `${candidate.id}|${seasonKey}`);
      competenceGain = split.competence;
      visibilityGain = split.visibility;
    }

    const newEmployeeId = `${candidate.id}-${season}-${hiredThisSeason + 1}`;
    let baseSave: NewGamePayload = {
      ...save,
      resources: {
        ...save.resources,
        competence: save.resources.competence + competenceGain,
        visibility: save.resources.visibility + visibilityGain,
        firmCapacity: save.resources.firmCapacity + capGain,
      },
      payablesLines: [
        ...(save.payablesLines ?? []),
        {
          id: wageLineId(newEmployeeId),
          label: `${candidate.name} wage`,
          amount: candidate.salary,
        },
      ],
      hiresBySeason: {
        ...(save.hiresBySeason ?? {}),
        [seasonKey]: hiredThisSeason + 1,
      },
      employees: [
        ...(save.employees ?? []),
        {
          id: newEmployeeId,
          name: candidate.name,
          role: mode === "intern" ? "Intern" : roleLabel(candidate.role),
          salary: candidate.salary,
          seasonHired: season,
          competenceGain,
          visibilityGain,
          capacityGain: capGain,
          ...(mode === "full_time" ? { productivityPct: productivity, tenureCapacityBonus: 0 } : {}),
        },
      ],
    };
    if (mode === "intern") {
      baseSave = banTalentBazaarName(baseSave, candidate.name);
    }
    const updated = baseSave;
    setSave(updated);
    persistSave(updated);
    setNotice(`Hired ${candidate.name}. Autosaved.`);

    const prodLine =
      productivity <= 25
        ? mode === "intern"
          ? hiringReportLowProductivityIntern(candidate.name)
          : hiringReportLowProductivityForTier(tier, candidate.name)
        : productivity <= 50
        ? mode === "intern" || tier === "junior"
          ? hiringReportProductivity26to50InternJunior(candidate.name)
          : tier === "mid"
            ? hiringReportProductivity26to50Mid(candidate.name)
            : hiringReportProductivity26to50Senior(candidate.name)
        : productivity <= 75
        ? mode === "intern"
          ? hiringReportProductivity51to75Intern(candidate.name)
          : hiringReportProductivity51to75ForTier(tier, candidate.name)
        : mode === "intern"
          ? hiringReportProductivity76to100Intern(candidate.name)
          : hiringReportProductivity76to100ForTier(tier, candidate.name);

    if (mode === "intern") {
      setHireReport({
        hireKind: "intern",
        title: `${candidate.name} joined the agency`,
        productivityBandLabel: hiringReportProductivityBandLabel(productivity),
        productivityBandTier: hiringReportBandTierFromPct(productivity),
        productivityLine: prodLine,
        capGain,
        competenceGain,
        visibilityGain,
      });
    } else {
      const skillPct = Math.round(
        (skill / (tier === "junior" ? 20 : tier === "mid" ? 40 : 80)) * 100
      );
      const skillLine =
        skillPct <= 25
          ? hiringReportLowSkillLineForTier(tier, candidate.role, candidate.name)
          : skillPct <= 50
          ? hiringReportSkill26to50Line(tier, candidate.role, candidate.name)
          : skillPct <= 75
          ? hiringReportSkill51to75Line(tier, candidate.role, candidate.name)
          : hiringReportSkill76to100Line(tier, candidate.role, candidate.name);

      setHireReport({
        hireKind: "full_time",
        title: `${candidate.name} joined the agency`,
        productivityBandLabel: hiringReportProductivityBandLabel(productivity),
        productivityBandTier: hiringReportBandTierFromPct(productivity),
        productivityLine: prodLine,
        skillBandLabel: hiringReportSkillBandLabel(skillPct),
        skillBandTier: hiringReportBandTierFromPct(skillPct),
        skillLine,
        capGain,
        competenceGain,
        visibilityGain,
      });
    }

    setStage("home");
    setMode("intern");
    setTier("junior");
    setRole(null);
    setSalary(15_000);
    setCandidates([]);
  };

  const openHireWarning = (candidate: Candidate) => {
    setPendingCandidate(candidate);
  };

  const confirmHire = () => {
    if (!pendingCandidate) return;
    const hired = pendingCandidate;
    setPendingCandidate(null);
    finalizeHireCandidate(hired);
  };

  if (salaryNegotiationLocked) {
    return (
      <div className="shell">
        <p className="muted">
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1>Talent Bazaar locked</h1>
        <p style={{ marginTop: "0.5rem" }}>
          Resolve pre-season 3 salary requests on the main pre-season screen first.
        </p>
        <Link href={`/game/preseason/${season}`} className="btn btn-primary" style={{ textDecoration: "none", width: "fit-content" }}>
          Back to pre-season {season}
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="shell shell-wide">
      <header style={{ marginBottom: "1.2rem" }}>
        <p className="muted" style={{ margin: "0 0 0.25rem" }}>
          <Link href="/">← {GAME_TITLE}</Link>
        </p>
        <h1 style={{ margin: 0 }}>Talent Bazaar</h1>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Max hires this pre-season: {cap} · Hired: {hiredThisSeason} · Agency roster: {rosterCount}/{rosterCap}
        </p>
      </header>

      <AgencyResourceStrip save={save} />
      <AgencyFinanceSnapshot save={save} onBreakdown={setBreakdownMetric} />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setStage("home")}
          disabled={stage === "home"}
        >
          Back
        </button>
        <Link href={`/game/preseason/${season}`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Return to agency screen
        </Link>
      </div>

      {notice ? <p>{notice}</p> : null}
      {capReached ? <p>Hire cap reached for this pre-season.</p> : null}
      {rosterAtCap && !capReached ? <p>Agency roster is at capacity ({rosterCap} employees).</p> : null}

      {stage === "home" ? (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>1) Pick intern or full-time employee</h2>
          <div className="card-grid cols-2" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className={`choice-card${mode === "intern" ? " selected" : ""}`}
              onClick={() => {
                setMode("intern");
                setRole(null);
              }}
            >
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>Intern (10k fixed)</h3>
              <p className="muted" style={{ margin: 0 }}>
                Fixed +3 competence and +3 visibility. Interns leave after 1 season.
              </p>
              {!canAffordIntern ? (
                <p className="muted" style={{ marginTop: "0.45rem" }}>
                  Unavailable: not enough budget.
                </p>
              ) : null}
            </button>
            <button type="button" className={`choice-card${mode === "full_time" ? " selected" : ""}`} onClick={() => setMode("full_time")}>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>Full-time employee</h3>
              <p className="muted" style={{ margin: 0 }}>
                Choose seniority, role, and budget band.
              </p>
            </button>
          </div>

          <h2 style={{ marginTop: "1rem", fontSize: "1.15rem" }}>2) Configure hire</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            {mode === "full_time" ? (
              <div className="field" style={{ margin: 0, maxWidth: "32rem" }}>
                <span>Role</span>
                <div className="hiring-role-picker" role="radiogroup" aria-label="Employee role">
                  {HIRING_ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`hiring-role-option${role === opt.id ? " selected" : ""}`}
                      onClick={() => setRole(opt.id)}
                      aria-pressed={role === opt.id}
                    >
                      <span className="hiring-role-option__icons">
                        {opt.symbols.map((sym) => (
                          <ResourceSymbol key={sym} id={sym} size={18} />
                        ))}
                      </span>
                      <span className="hiring-role-option__body">
                        <span className="hiring-role-option__title">{opt.title}</span>
                        <span className="hiring-role-option__focus">{opt.focusLabel}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
              <label className="field" style={{ minWidth: "250px", margin: 0 }}>
                <span>Seniority</span>
                <select
                  disabled={mode === "intern"}
                  value={tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as Exclude<HiringTier, "intern">;
                    setTier(nextTier);
                    const anchors = getSalaryBands(nextTier).map((b) => b.anchor * 1000);
                    const filtered = anchors.filter((value) => liquidityEur(save) >= value);
                    setSalary(filtered[0] ?? anchors[0]);
                  }}
                >
                  <option value="junior">Junior (15k-39k)</option>
                  <option value="mid">Mid (40k-64k)</option>
                  <option value="senior">Senior (65k-89k)</option>
                </select>
              </label>

              <label className="field" style={{ minWidth: "220px", margin: 0 }}>
                <span>Budget (salary)</span>
                <select
                  disabled={mode === "intern"}
                  value={salary}
                  onChange={(e) => setSalary(Number.parseInt(e.target.value, 10))}
                >
                  {salaryOptions.map((value) => (
                    <option key={value} value={value}>
                      EUR {value.toLocaleString("en-GB")}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  capReached ||
                  rosterAtCap ||
                  !canAffordSelected ||
                  (mode === "full_time" && (!role || salaryOptions.length === 0))
                }
                onClick={findEmployees}
              >
                Find employees
              </button>
            </div>
          </div>
          {mode === "intern" ? <p className="muted">Role and budget are fixed for interns.</p> : null}
          {mode === "full_time" && salaryOptions.length === 0 ? (
            <p className="muted">No salary bands are currently affordable.</p>
          ) : null}
        </section>
      ) : (
        <section>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>
            {candidates.length === 0
              ? "No candidates available"
              : candidates.length === 1
                ? "Choose your candidate"
                : `Choose one of ${candidates.length} candidates`}
          </h2>
          {candidates.length === 0 ? (
            <p className="muted">Everyone matching this search is already on your team, excluded, or the roster is exhausted.</p>
          ) : (
          <div
            className={`card-grid${candidates.length >= 3 ? " cols-3" : candidates.length === 2 ? " cols-2" : ""}`}
            style={{ marginTop: "0.75rem" }}
          >
            {candidates.map((c) => (
              <div key={c.id} className="choice-card" style={{ textAlign: "left" }}>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem" }}>{c.name}</h3>
                <p className="muted" style={{ margin: "0 0 0.4rem" }}>
                  {mode === "intern" ? "Intern" : `${roleLabel(c.role)} · ${tier}`} · EUR {c.salary.toLocaleString("en-GB")}
                </p>
                <p style={{ margin: 0 }}>{c.description}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: "0.75rem" }}
                  disabled={capReached || rosterAtCap}
                  onClick={() => openHireWarning(c)}
                >
                  Hire
                </button>
              </div>
            ))}
          </div>
          )}
        </section>
      )}
    </div>
    {hireReport ? (
      <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Hiring result">
        <div className="game-modal">
          <p className="game-modal-kicker">Hiring report</p>
          <h2 style={{ marginTop: 0 }}>{hireReport.title}</h2>
          <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>{hireReport.productivityLine}</p>
          <p className="muted" style={{ marginTop: 0, marginBottom: "0.65rem" }}>
            Productivity:{" "}
            <span style={HIRING_REPORT_BAND_LABEL_STYLE[hireReport.productivityBandTier]}>
              {hireReport.productivityBandLabel}
            </span>
          </p>
          {hireReport.hireKind === "full_time" ? (
            <>
              <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>{hireReport.skillLine}</p>
              <p className="muted" style={{ marginTop: 0, marginBottom: "0.65rem" }}>
                Skill:{" "}
                <span style={HIRING_REPORT_BAND_LABEL_STYLE[hireReport.skillBandTier]}>
                  {hireReport.skillBandLabel}
                </span>
              </p>
            </>
          ) : null}
          <div className="game-modal-stats">
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="capacity" size={15} />
              </span>
              <span>
                Capacity: +{hireReport.capGain}
              </span>
            </span>
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="competence" size={15} />
              </span>
              <span>
                Competence: +{hireReport.competenceGain}
              </span>
            </span>
            <span className="game-modal-stat-with-icon">
              <span className="game-modal-stat-icon" aria-hidden>
                <ResourceSymbol id="visibility" size={15} />
              </span>
              <span>
                Visibility: +{hireReport.visibilityGain}
              </span>
            </span>
          </div>
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-primary" onClick={() => setHireReport(null)}>
              OK
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {pendingCandidate ? (
      <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm hire warning">
        <div className="game-modal">
          <p className="game-modal-kicker">Before you hire</p>
          <h2 style={{ marginTop: 0 }}>Are you sure you want to hire {pendingCandidate.name}?</h2>
          {mode === "intern" ? (
            <p style={{ marginTop: 0 }}>
              Intern reminder: they will leave your agency and will not count toward next season&apos;s payroll.
            </p>
          ) : (
            <p style={{ marginTop: 0 }}>
              Are you sure? If you can&apos;t afford this employee&apos;s salary after the season ends, you will need to lay them off.
            </p>
          )}
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingCandidate(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmHire}>
              Confirm hire
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {breakdownMetric ? (
      <AgencyFinanceBreakdownHost save={save} metric={breakdownMetric} onClose={() => setBreakdownMetric(null)} />
    ) : null}
    </>
  );
}

