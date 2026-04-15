/**
 * Player-facing mood line from a 0–100 client satisfaction score (weighted reach + effectiveness).
 * Used on Season 2+ rollover resolution/history screens and on the Season 3+ post-season client reviews digest.
 */
export function formatClientSatisfactionMood(clientDisplayName: string, satisfactionPercent: number): string {
  const s = Math.max(0, Math.min(100, Math.round(Number(satisfactionPercent) || 0)));
  const name = clientDisplayName.trim() || "Your client";
  if (s <= 20) return `${name} is fuming at you 😤`;
  if (s <= 40) return `${name} is not pleased 😕`;
  if (s <= 60) return `${name} is satisfied 🙂`;
  if (s <= 80) return `${name} is pleased 😊`;
  return `${name} is absolutely thrilled 🎉`;
}
