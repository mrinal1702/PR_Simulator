import type { SpouseType } from "@/lib/gameEconomy";

/**
 * Humorous rollover lines when entering a new pre-season after post-season.
 * `{name}` is replaced with the spouse’s first name (or a fallback).
 *
 * `primary` is the default for pre-season 2; `alternates` rotate on later seasons
 * so copy does not repeat every year (see `pickPreseasonEntrySpouseFlavorLine`).
 */
export const PRESEASON_ENTRY_SPOUSE_LINE_POOLS: Record<
  Exclude<SpouseType, "none">,
  { primary: string; alternates: string[] }
> = {
  influential: {
    primary: "{name} knows a guy who knows a guy who knows a newsletter.",
    alternates: [
      "{name} is already three coffees deep at a “visibility breakfast.”",
      '{name} “accidentally” became the story.',
      "{name} turned small talk into earned media energy.",
      "{name} is networking like it’s billable.",
      "{name} held eye contact until the room believed you.",
    ],
  },
  supportive: {
    primary: '{name} talked you out of sending that 2 a.m. “per my last email.”',
    alternates: [
      "{name} stopped you from replying-all with feelings.",
      "{name} deleted the draft titled FINAL_FINAL_v9_ACTUALLY_FINAL.",
      '{name} suggested “one more pass” and saved your reputation.',
      '{name} made you sleep instead of “quickly fixing the deck.”',
      "{name} prevented a strategic meltdown over font kerning.",
    ],
  },
  rich: {
    primary: '{name} said “we can afford competence” and meant cash.',
    alternates: [
      "{name} monetized a vibe (legally-ish).",
      '{name} called it “runway” so the bank wouldn’t laugh.',
      '{name} “found” money the way agencies find billable hours.',
      "{name} got an inheritance and didn’t spend it on merch.",
      "{name} diversified your panic into liquidity.",
    ],
  },
};

/** Which line in [primary, ...alternates] to use for this pre-season season number. */
export function preseasonEntrySpouseLineIndex(preseasonSeasonNumber: number, poolLength: number): number {
  if (poolLength <= 0) return 0;
  if (preseasonSeasonNumber < 2) return 0;
  return (preseasonSeasonNumber - 2) % poolLength;
}

/**
 * One flavor line for the rollover modal (no stat suffix — UI adds EUR / competence / visibility).
 */
export function pickPreseasonEntrySpouseFlavorLine(
  spouseType: SpouseType,
  preseasonSeasonNumber: number,
  spouseDisplayName: string
): string | null {
  if (spouseType === "none") return null;
  const pool = PRESEASON_ENTRY_SPOUSE_LINE_POOLS[spouseType];
  const lines = [pool.primary, ...pool.alternates];
  const idx = preseasonEntrySpouseLineIndex(preseasonSeasonNumber, lines.length);
  const raw = lines[idx] ?? pool.primary;
  return raw.replace(/\{name\}/g, spouseDisplayName.trim() || "Your spouse");
}
