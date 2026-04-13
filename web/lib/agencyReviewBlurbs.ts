import agencyReviewBlurbsJson from "../data/agency_review_blurbs.json";
import type { ClientKind } from "./clientEconomyMath";

/** Half-star ratings present in `agency_review_blurbs.json`, low → high. */
export const AGENCY_REVIEW_STAR_KEYS = [
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "4.5",
  "5",
] as const;

export type AgencyReviewStarKey = (typeof AGENCY_REVIEW_STAR_KEYS)[number];

export const agencyReviewBlurbsData = agencyReviewBlurbsJson;

export type AgencyReviewBlurbRow = {
  individual: string;
  small_business: string;
  corporate: string;
};

/**
 * Map 0–100 satisfaction % to star key (10 bands → 10 half-star tiers).
 * Bands: 0–10% → 0.5⭐, 11–20% → 1⭐, …, 91–100% → 5⭐ (aligned with design: first band includes 10%).
 */
export function satisfactionPercentToStarKey(satisfactionPercent: number): AgencyReviewStarKey {
  const p = Math.max(0, Math.min(100, satisfactionPercent));
  const band = p <= 10 ? 0 : Math.min(9, Math.floor((p - 1) / 10));
  return AGENCY_REVIEW_STAR_KEYS[band];
}

/** Normalize a star value (e.g. from UI) to the nearest half-star key in the table. */
export function clampToAgencyReviewStarKey(stars: number): AgencyReviewStarKey | undefined {
  const x = Math.round(Math.max(0.5, Math.min(5, stars)) * 2) / 2;
  const key = Number.isInteger(x) ? String(x) : x.toFixed(1);
  return (AGENCY_REVIEW_STAR_KEYS as readonly string[]).includes(key)
    ? (key as AgencyReviewStarKey)
    : undefined;
}

export function getAgencyReviewBlurbTemplate(
  starKey: AgencyReviewStarKey,
  clientKind: ClientKind
): string {
  const row = agencyReviewBlurbsJson.blurbs[starKey] as AgencyReviewBlurbRow | undefined;
  if (!row) return "";
  return row[clientKind] ?? "";
}

export function formatAgencyReviewBlurb(template: string, agencyName: string): string {
  return template.replaceAll("{agency}", agencyName);
}

export function getAgencyReviewBlurb(
  starKey: AgencyReviewStarKey,
  clientKind: ClientKind,
  agencyName: string
): string {
  return formatAgencyReviewBlurb(getAgencyReviewBlurbTemplate(starKey, clientKind), agencyName);
}
