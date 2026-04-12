import type { NewGamePayload } from "@/components/NewGameWizard";
import { seasonSpouseGrants } from "@/lib/gameEconomy";
import { METRIC_SCALES, clampToScale } from "@/lib/metricScales";
import { collectPostSeasonLedger } from "@/lib/postSeasonResults";
import { computePreseasonFocusTotals } from "@/lib/preseasonFocus";

export type AgencyCoreStatAudit = {
  expected: {
    rawCompetence: number;
    rawVisibility: number;
    reputation: number;
  };
  actual: {
    rawCompetence: number;
    rawVisibility: number;
    reputation: number;
  };
  deltas: {
    rawCompetence: number;
    rawVisibility: number;
    reputation: number;
  };
};

export function auditAgencyCoreStatTallies(save: NewGamePayload): AgencyCoreStatAudit {
  const initialResources = save.initialResources ?? save.resources;
  const initialReputation = save.initialReputation ?? 5;
  const focusTotals = computePreseasonFocusTotals(save);
  const spouseGrant = seasonSpouseGrants(save.spouseType);
  const spouseGrantCount = (save.preseasonEntrySpouseGrantSeasons ?? []).length;
  const roster = save.employees ?? [];
  const employeeCompetence = roster.reduce((sum, employee) => sum + employee.competenceGain, 0);
  const employeeVisibility = roster.reduce((sum, employee) => sum + employee.visibilityGain, 0);
  const postSeasonLedger = collectPostSeasonLedger(save);
  const totalReputationGain = postSeasonLedger.reduce((sum, entry) => sum + entry.reputationDelta, 0);
  const totalVisibilityGain = postSeasonLedger.reduce((sum, entry) => sum + entry.visibilityGain, 0);

  const expected = {
    rawCompetence: clampToScale(
      initialResources.competence +
        focusTotals.competence +
        employeeCompetence +
        spouseGrant.competence * spouseGrantCount,
      METRIC_SCALES.competence
    ),
    rawVisibility: clampToScale(
      initialResources.visibility +
        focusTotals.visibility +
        employeeVisibility +
        spouseGrant.visibility * spouseGrantCount +
        totalVisibilityGain,
      METRIC_SCALES.visibility
    ),
    reputation: clampToScale(initialReputation + totalReputationGain, METRIC_SCALES.reputation),
  };

  const actual = {
    rawCompetence: save.resources.competence,
    rawVisibility: save.resources.visibility,
    reputation: save.reputation ?? 5,
  };

  return {
    expected,
    actual,
    deltas: {
      rawCompetence: actual.rawCompetence - expected.rawCompetence,
      rawVisibility: actual.rawVisibility - expected.rawVisibility,
      reputation: actual.reputation - expected.reputation,
    },
  };
}
