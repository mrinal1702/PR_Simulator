"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { ResourceSymbol } from "@/components/resourceSymbols";
import { getPendingReceivablesEur, totalPayables } from "@/lib/payablesReceivables";
import { useEffect, useRef, useState } from "react";

type StripStatId =
  | "eur"
  | "payables"
  | "receivables"
  | "competence"
  | "visibility"
  | "capacity"
  | "reputation";

const FLASH_MS = 620;

/** Sticky symbol + value bar (desktop hover titles). Reused on pre-season, Talent Bazaar, etc. */
export function AgencyResourceStrip({ save }: { save: NewGamePayload }) {
  const r = save.resources;
  const rep = save.reputation ?? 5;
  const pay = totalPayables(save);
  const rec = getPendingReceivablesEur(save);
  const [flashIds, setFlashIds] = useState<StripStatId[]>([]);
  const prevNumsRef = useRef<Record<StripStatId, number> | null>(null);
  const clearFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next: Record<StripStatId, number> = {
      eur: r.eur,
      payables: pay,
      receivables: rec,
      competence: r.competence,
      visibility: r.visibility,
      capacity: r.firmCapacity,
      reputation: rep,
    };

    if (prevNumsRef.current === null) {
      prevNumsRef.current = next;
      return;
    }

    const prev = prevNumsRef.current;
    prevNumsRef.current = next;

    const changed = (Object.keys(next) as StripStatId[]).filter((id) => prev[id] !== next[id]);
    if (!changed.length) return;

    if (clearFlashTimerRef.current !== null) {
      clearTimeout(clearFlashTimerRef.current);
      clearFlashTimerRef.current = null;
    }

    setFlashIds(changed);
    clearFlashTimerRef.current = setTimeout(() => {
      setFlashIds([]);
      clearFlashTimerRef.current = null;
    }, FLASH_MS);

    return () => {
      if (clearFlashTimerRef.current !== null) {
        clearTimeout(clearFlashTimerRef.current);
        clearFlashTimerRef.current = null;
      }
    };
  }, [r.eur, pay, rec, r.competence, r.visibility, r.firmCapacity, rep]);

  const flashing = new Set(flashIds);

  const items: Array<{
    id: StripStatId;
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
        <span
          key={item.id}
          className={`preseason-resource-strip__pair${flashing.has(item.id) ? " preseason-resource-strip__pair--value-flash" : ""}`}
          title={item.title}
        >
          <ResourceSymbol id={item.id} size={17} />
          <span className={`preseason-resource-strip__val${item.valClass ? ` ${item.valClass}` : ""}`}>{item.value}</span>
        </span>
      ))}
    </div>
  );
}
