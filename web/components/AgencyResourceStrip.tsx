"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { ResourceSymbol } from "@/components/resourceSymbols";
import { getPendingReceivablesEur, totalPayables } from "@/lib/payablesReceivables";

/** Sticky symbol + value bar (desktop hover titles). Reused on pre-season, Talent Bazaar, etc. */
export function AgencyResourceStrip({ save }: { save: NewGamePayload }) {
  const r = save.resources;
  const rep = save.reputation ?? 5;
  const pay = totalPayables(save);
  const rec = getPendingReceivablesEur(save);
  const items: Array<{
    id: "eur" | "payables" | "receivables" | "competence" | "visibility" | "capacity" | "reputation";
    value: string;
    title: string;
    valClass?: string;
  }> = [
    { id: "eur", value: r.eur.toLocaleString("en-GB"), title: "Cash (EUR)" },
    { id: "payables", value: pay.toLocaleString("en-GB"), title: "Payables (owed)", valClass: "preseason-resource-strip__val--payables" },
    { id: "receivables", value: rec.toLocaleString("en-GB"), title: "Receivables (guaranteed)", valClass: "preseason-resource-strip__val--receivables" },
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
          <span className={`preseason-resource-strip__val${item.valClass ? ` ${item.valClass}` : ""}`}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}
