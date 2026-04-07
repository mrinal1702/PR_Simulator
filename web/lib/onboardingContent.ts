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
    bio: `You basically live in the overlap between "plus-one" and "plus-ten." Celeb circles, launch parties, group chats that could move markets if anyone took screenshots—you know who to bump into, who owes a favor, and which rumor is fashion versus fact. School was… a phase. You are not pretending to be a policy wonk; you are naturally good at selling the dream, and your dad (and a few friends who should know better) tossed seed money at your firm because you are very convincing before the receipts arrive. Execution? That is a tomorrow problem. Today you have people knowledge, charm, and a phone that never stops buzzing.`,
    statsSummary: "Low wealth · Low competence · High visibility",
  },
  {
    id: "summa_cum_basement",
    name: "Summa Cum Basement",
    tagline: "You wrote the syllabus. You did not write the guest list.",
    bio: `You graduated like it was a competitive sport, then started a firm the way other people start a side project—except yours has footnotes. You can deconstruct a narrative arc before breakfast, but your Rolodex is mostly PDFs and one cousin who works in compliance. You are operating out of your parents' basement (you call it "headquarters"; the echo agrees). Money is thin; contacts are thinner—just enough here and there to prove you are not imaginary. You are very good at the work and slightly haunted by how little of the world has met you yet.`,
    statsSummary: "Low wealth · High competence · Low visibility",
  },
  {
    id: "portfolio_pivot",
    name: "The Portfolio Pivot",
    tagline: "You can buy reach. You are still buying vocabulary.",
    bio: `You already own enough businesses that your accountant has an accountant. Reputation management is the new toy—because diversification is a lifestyle, and you get bored easily. You do not know PR the way you know EBITDA, but you know one or two genuinely influential people, and you know how to hire people who claim they do. Your plan is simple: pay for reach, delegate the rest, and try not to confuse "headline" with "strategy" more than twice a quarter. Confidence is an asset. Denial is… also present.`,
    statsSummary: "High wealth · Low competence · Low visibility",
  },
];

export const SPOUSE_OPTIONS: {
  type: SpouseType;
  title: string;
  blurb: string;
  /** Vague UI hint only—no numbers (economy tuned elsewhere). */
  boost: string;
}[] = [
  {
    type: "supportive",
    title: "Your favorite editor",
    blurb: "They proofread your life—and occasionally stop you from emailing while mad.",
    boost: "Competence boost",
  },
  {
    type: "influential",
    title: "Speed-dial royalty",
    blurb: "They know someone who knows someone, and suddenly you’re on the list.",
    boost: "Visibility boost",
  },
  {
    type: "rich",
    title: "The benefactor",
    blurb: "Date night sometimes feels like a soft round of funding with dessert.",
    boost: "Income boost",
  },
  {
    type: "none",
    title: "Table for one, LLC",
    blurb: "No merge conflicts on the calendar—and more cash stays in the firm piggy bank.",
    boost: "Capacity boost",
  },
];
