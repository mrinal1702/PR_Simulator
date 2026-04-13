import type { NewGamePayload } from "@/components/NewGameWizard";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";

/** Multiplier on raw agency competence when Tech Overhaul is purchased (not stored in resources). */
export const TECH_OVERHAUL_COMPETENCE_MULT = 0.1;
/** Multiplier on raw agency visibility when Soft Launch Buzz is purchased. */
export const SOFT_LAUNCH_VISIBILITY_MULT = 0.05;

export function getRawAgencyCompetence(save: NewGamePayload): number {
  return save.resources.competence;
}

export function getRawAgencyVisibility(save: NewGamePayload): number {
  return save.resources.visibility;
}

/**
 * Competence used for variance / entry scores and UI: raw × (1 + 10%) when Tech Overhaul is owned, then clamped.
 */
export function getEffectiveCompetenceForAgency(save: NewGamePayload): number {
  const raw = getRawAgencyCompetence(save);
  if (!save.shoppingCenterPurchases?.techOverhaul) return raw;
  return clampToScale(Math.round(raw * (1 + TECH_OVERHAUL_COMPETENCE_MULT)), METRIC_SCALES.competence);
}

export function getTechOverhaulCompetenceBonus(save: NewGamePayload): number {
  return getEffectiveCompetenceForAgency(save) - getRawAgencyCompetence(save);
}

/**
 * Visibility used for variance / entry scores and UI: raw × (1 + 5%) when Soft Launch Buzz is owned, then clamped.
 */
export function getEffectiveVisibilityForAgency(save: NewGamePayload): number {
  const raw = getRawAgencyVisibility(save);
  if (!save.shoppingCenterPurchases?.softLaunchBuzz) return raw;
  return clampToScale(Math.round(raw * (1 + SOFT_LAUNCH_VISIBILITY_MULT)), METRIC_SCALES.visibility);
}

export function getSoftLaunchVisibilityBonus(save: NewGamePayload): number {
  return getEffectiveVisibilityForAgency(save) - getRawAgencyVisibility(save);
}
