"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { ResourceSymbol } from "@/components/resourceSymbols";

/** Sticky symbol + value bar (desktop hover titles). Reused on pre-season, Talent Bazaar, etc. */
export function AgencyResourceStrip({ save }: { save: NewGamePayload }) {
  const r = save.resources;
  const rep = save.reputation ?? 5;
  const items: Array<{
    id: "eur" | "competence" | "visibility" | "capacity" | "reputation";
    value: string;
    title: string;
  }> = [
    { id: "eur", value: r.eur.toLocaleString("en-GB"), title: "Wealth (EUR)" },
    { id: "competence", value: String(r.competence), title: "Competence" },
    { id: "visibility", value: String(r.visibility), title: "Visibility" },
    { id: "capacity", value: String(r.firmCapacity), title: "Firm capacity" },
    { id: "reputation", value: String(rep), title: "Reputation" },
  ];
  return (
    <div className="preseason-resource-strip" role="region" aria-label="Agency resources">
      {items.map((item) => (
        <span key={item.id} className="preseason-resource-strip__pair" title={item.title}>
          <ResourceSymbol id={item.id} size={17} />
          <span className="preseason-resource-strip__val">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
