/** Copy and IDs for onboarding UI. IDs match DB / gameEconomy. */

import type { SpouseType } from "@/lib/gameEconomy";

export type { SpouseType };

export const GAME_TITLE = "Disaster Management Agency Simulator" as const;

export const GAME_TAGLINE =
  "Clients will panic in public. You get paid to make it look intentional—spin the mess, bill the hours, and try not to become the headline yourself.";

/** Persist these values in saves and analytics; do not rename lightly. */
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]["value"];

export type BuildId = "velvet_rolodex" | "summa_cum_basement" | "portfolio_pivot";

export const BUILDS: {
  id: BuildId;
  name: string;
  tagline: string;
  bio: string;
  statsSummary: string;
}[] = [
  {
    id: "velvet_rolodex",
    name: "The Velvet Rolodex",
    tagline: "Famous faces save your DMs. Spreadsheets do not.",
    bio: "You live in the overlap between plus-one and plus-ten—launch parties, group chats, and favors you can almost invoice. School was optional; charm is not. Dad and a few friends funded the dream before the receipts arrived. Execution? Tomorrow’s problem.",
    statsSummary: "Low wealth · Low competence · High visibility",
  },
  {
    id: "summa_cum_basement",
    name: "Summa Cum Basement",
    tagline: "You wrote the syllabus. You did not write the guest list.",
    bio: "You graduated like a sport, then opened a firm with footnotes. Your Rolodex is mostly PDFs and one cousin in compliance. Headquarters is your parents’ basement—and the echo agrees. Brilliant at the craft; still introducing yourself to the world.",
    statsSummary: "Low wealth · High competence · Low visibility",
  },
  {
    id: "portfolio_pivot",
    name: "The Portfolio Pivot",
    tagline: "You can buy reach. You are still buying vocabulary.",
    bio: "Your accountant has an accountant. PR is the new diversification hobby. You’re fuzzy on narrative strategy but sharp on hiring people who swear they aren’t. Pay for reach, delegate the rest, and try not to confuse headline with strategy more than twice a quarter.",
    statsSummary: "High wealth · Low competence · Low visibility",
  },
];

export const SPOUSE_OPTIONS: {
  type: SpouseType;
  title: string;
  blurb: string;
  perk: string;
}[] = [
  {
    type: "supportive",
    title: "Supportive spouse",
    blurb: "They proofread your life—and occasionally stop you from emailing while mad.",
    perk: "+25 competence at start and each season end",
  },
  {
    type: "influential",
    title: "Influential spouse",
    blurb: "They know someone who knows someone, and suddenly you’re on the list.",
    perk: "+25 visibility at start and each season end",
  },
  {
    type: "rich",
    title: "Rich spouse",
    blurb: "Date night sometimes feels like a soft round of funding with dessert.",
    perk: "+€25,000 at start and each season end",
  },
  {
    type: "none",
    title: "No spouse",
    blurb: "No merge conflicts on the calendar—and more cash stays in the firm piggy bank.",
    perk: "100 firm capacity at start; no recurring capacity bonus",
  },
];
