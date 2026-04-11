/** Shown once on the matching pre-season screen after post-season → pre-season transition; then cleared. */
export type PreseasonEntryRevealPending = {
  preseasonSeasonKey: string;
  /** Whether the seasonal spouse EUR / competence / visibility grant was applied this transition. */
  spouseGrantApplied: boolean;
  /** Flavor text only; stats rendered separately with symbols. */
  spouseFlavorLine: string | null;
  /** Copy of spouse grant for display (zeros when none / skipped). */
  spouseGrantStats: { eur: number; competence: number; visibility: number } | null;
  employeeCapacityChanges: Array<{ employeeId: string; name: string; before: number; after: number }>;
};
