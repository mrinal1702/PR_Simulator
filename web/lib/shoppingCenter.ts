import type { NewGamePayload } from "@/components/NewGameWizard";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import { liquidityEur } from "@/lib/payablesReceivables";

export type ShoppingItemId =
  | "vacation_with_spouse"
  | "vacation_solo"
  | "rent_office"
  | "hr_skills_test"
  | "hr_reference_checks"
  | "tech_overhaul"
  | "soft_launch_buzz";

export type ShoppingCenterPurchases = {
  vacationWithSpouse?: boolean;
  vacationSolo?: boolean;
  rentOffice?: boolean;
  hrSkillsTest?: boolean;
  hrReferenceChecks?: boolean;
  soloVacationBoostStat?: "competence" | "visibility";
  /** +10% to agency competence (applied to raw total for scores and display). */
  techOverhaul?: boolean;
  /** +5% to agency visibility (applied to raw total for scores and display). */
  softLaunchBuzz?: boolean;
};

export const SHOPPING_ITEM_COST_EUR: Record<ShoppingItemId, number> = {
  vacation_with_spouse: 3_000,
  vacation_solo: 1_000,
  rent_office: 15_000,
  hr_skills_test: 5_000,
  hr_reference_checks: 5_000,
  tech_overhaul: 10_000,
  soft_launch_buzz: 10_000,
};

export function getShoppingBudgetEur(save: NewGamePayload): {
  cash: number;
  liquidity: number;
  budget: number;
} {
  const cash = save.resources.eur;
  const liquidity = liquidityEur(save);
  return { cash, liquidity, budget: Math.min(cash, liquidity) };
}

export function isShoppingItemPurchased(save: NewGamePayload, itemId: ShoppingItemId): boolean {
  const p = save.shoppingCenterPurchases;
  if (!p) return false;
  if (itemId === "vacation_with_spouse") return p.vacationWithSpouse === true;
  if (itemId === "vacation_solo") return p.vacationSolo === true;
  if (itemId === "rent_office") return p.rentOffice === true;
  if (itemId === "hr_skills_test") return p.hrSkillsTest === true;
  if (itemId === "hr_reference_checks") return p.hrReferenceChecks === true;
  if (itemId === "tech_overhaul") return p.techOverhaul === true;
  return p.softLaunchBuzz === true;
}

function deterministicSoloVacationBoostStat(save: NewGamePayload): "competence" | "visibility" {
  const seed = `${save.createdAt}|${save.playerName}|${save.agencyName}|solo-vacation`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 2 === 0 ? "competence" : "visibility";
}

export function applyShoppingPurchase(save: NewGamePayload, itemId: ShoppingItemId): {
  ok: true;
  save: NewGamePayload;
  message?: string;
} | {
  ok: false;
  error: string;
} {
  if (itemId === "vacation_with_spouse" && save.spouseType === "none") {
    return { ok: false, error: "Vacation with spouse is unavailable for this run." };
  }
  if (itemId === "vacation_solo" && save.spouseType !== "none") {
    return { ok: false, error: "Solo vacation is only available when you chose no spouse." };
  }
  if (isShoppingItemPurchased(save, itemId)) {
    return { ok: false, error: "This item is already purchased." };
  }

  const cost = SHOPPING_ITEM_COST_EUR[itemId];
  const budget = getShoppingBudgetEur(save).budget;
  if (budget < cost || save.resources.eur < cost) {
    return { ok: false, error: "Insufficient budget for this purchase." };
  }

  const p: ShoppingCenterPurchases = { ...(save.shoppingCenterPurchases ?? {}) };
  let next: NewGamePayload = {
    ...save,
    resources: {
      ...save.resources,
      eur: save.resources.eur - cost,
    },
  };

  if (itemId === "vacation_with_spouse") {
    p.vacationWithSpouse = true;
    next = { ...next, shoppingCenterPurchases: p };
    return { ok: true, save: next };
  }

  if (itemId === "vacation_solo") {
    p.vacationSolo = true;
    const stat = p.soloVacationBoostStat ?? deterministicSoloVacationBoostStat(save);
    p.soloVacationBoostStat = stat;
    next = {
      ...next,
      resources: {
        ...next.resources,
        competence:
          stat === "competence"
            ? clampToScale(next.resources.competence + 8, METRIC_SCALES.competence)
            : next.resources.competence,
        visibility:
          stat === "visibility"
            ? clampToScale(next.resources.visibility + 8, METRIC_SCALES.visibility)
            : next.resources.visibility,
      },
      shoppingCenterPurchases: p,
    };
    return { ok: true, save: next, message: `Solo vacation boost applied: +8 ${stat}.` };
  }

  if (itemId === "rent_office") {
    p.rentOffice = true;
    next = { ...next, shoppingCenterPurchases: p };
    return { ok: true, save: next };
  }

  if (itemId === "hr_skills_test") {
    p.hrSkillsTest = true;
    next = { ...next, shoppingCenterPurchases: p };
    return { ok: true, save: next };
  }

  if (itemId === "hr_reference_checks") {
    p.hrReferenceChecks = true;
    next = { ...next, shoppingCenterPurchases: p };
    return { ok: true, save: next };
  }

  if (itemId === "tech_overhaul") {
    p.techOverhaul = true;
    next = { ...next, shoppingCenterPurchases: p };
    return { ok: true, save: next };
  }

  p.softLaunchBuzz = true;
  next = { ...next, shoppingCenterPurchases: p };
  return { ok: true, save: next };
}

export function getSpouseVacationSeasonalBonus(save: NewGamePayload, nextSeason: number): {
  eur: number;
  competence: number;
  visibility: number;
} {
  if (nextSeason < 3) return { eur: 0, competence: 0, visibility: 0 };
  if (!save.shoppingCenterPurchases?.vacationWithSpouse) return { eur: 0, competence: 0, visibility: 0 };
  if (save.spouseType === "supportive") return { eur: 0, competence: 10, visibility: 0 };
  if (save.spouseType === "influential") return { eur: 0, competence: 0, visibility: 10 };
  // Money spouse bonus uses EUR-thousands scale.
  if (save.spouseType === "rich") return { eur: 10_000, competence: 0, visibility: 0 };
  return { eur: 0, competence: 0, visibility: 0 };
}

export function getHireAdjustmentMultipliers(save: NewGamePayload): {
  skillMultiplier: number;
  productivityMultiplier: number;
} {
  return {
    skillMultiplier: save.shoppingCenterPurchases?.hrSkillsTest ? 1.15 : 1,
    productivityMultiplier: save.shoppingCenterPurchases?.hrReferenceChecks ? 1.15 : 1,
  };
}
