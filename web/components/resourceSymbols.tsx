import type { CSSProperties } from "react";
import type { BuildId, SpouseType } from "@/lib/gameEconomy";

const base: CSSProperties = {
  display: "inline-block",
  verticalAlign: "middle",
  flexShrink: 0,
};

const svgSize = (size: number): CSSProperties => ({
  ...base,
  width: size,
  height: size,
});

type IconProps = {
  size?: number;
  className?: string;
  /** Shown on hover / accessible name */
  label: string;
  title?: string;
};

/** Money — intuitive text label */
export function SymbolEur({ size = 14, className, label, title }: IconProps) {
  return (
    <abbr
      className={className}
      title={title ?? label}
      style={{
        ...base,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.02em",
        textDecoration: "none",
        cursor: "help",
      }}
    >
      EUR
    </abbr>
  );
}

export function SymbolEye({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        <path
          d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12.5" r="3.25" fill="currentColor" />
      </svg>
    </span>
  );
}

export function SymbolGear({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.49 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.49-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.49 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.84 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.49 1Z"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function SymbolGrid({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    </span>
  );
}

export function SymbolStarFilled({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        role="img"
        aria-label={label}
      >
        <title>{label}</title>
        <path
          d="M12 2.5l2.85 5.78 6.37.93-4.61 4.49 1.09 6.35L12 17.77l-5.7 3.28 1.09-6.35L2.78 9.21l6.37-.93L12 2.5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Document + arrow out — obligations owed (payables). Red arrow. */
export function SymbolPayablesDoc({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" role="img" aria-label={label}>
        <title>{label}</title>
        <path
          d="M6 3.5h8l4 4V20.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path
          d="M19.5 12.5h-6M12.5 12.5l2.5-2.5M12.5 12.5l2.5 2.5"
          stroke="#ef4444"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Document + arrow in — guaranteed inflows (receivables). Green arrow. */
export function SymbolReceivablesDoc({ size = 18, className, label, title }: IconProps) {
  return (
    <span title={title ?? label} className={className} style={svgSize(size)} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" role="img" aria-label={label}>
        <title>{label}</title>
        <path
          d="M6 3.5h8l4 4V20.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path
          d="M4.5 12.5h6M10.5 12.5l-2.5-2.5M10.5 12.5l-2.5 2.5"
          stroke="#22c55e"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export type ResourceSymbolId =
  | "eur"
  | "payables"
  | "receivables"
  | "visibility"
  | "competence"
  | "capacity"
  | "reputation";

const LABELS: Record<ResourceSymbolId, string> = {
  eur: "Wealth (EUR)",
  payables: "Payables",
  receivables: "Receivables",
  visibility: "Visibility",
  competence: "Competence",
  capacity: "Firm capacity",
  reputation: "Reputation",
};

export function ResourceSymbol({
  id,
  size = 18,
  className,
}: {
  id: ResourceSymbolId;
  size?: number;
  className?: string;
}) {
  const label = LABELS[id];
  switch (id) {
    case "eur":
      return <SymbolEur size={size} label={label} title={label} className={className} />;
    case "payables":
      return <SymbolPayablesDoc size={size} label={label} title={label} className={className} />;
    case "receivables":
      return <SymbolReceivablesDoc size={size} label={label} title={label} className={className} />;
    case "visibility":
      return <SymbolEye size={size} label={label} title={label} className={className} />;
    case "competence":
      return <SymbolGear size={size} label={label} title={label} className={className} />;
    case "capacity":
      return <SymbolGrid size={size} label={label} title={label} className={className} />;
    case "reputation":
      return <SymbolStarFilled size={size} label={label} title={label} className={className} />;
    default:
      return null;
  }
}

/** One primary specialty icon per starting build (matches copy: visibility / competence / wealth). */
export const BUILD_SPECIALTY_SYMBOLS: Record<BuildId, ResourceSymbolId[]> = {
  velvet_rolodex: ["visibility"],
  summa_cum_basement: ["competence"],
  portfolio_pivot: ["eur"],
};

/** Spouse row: icon matches mechanical specialty (capacity for solo). */
export const SPOUSE_SPECIALTY_SYMBOL: Record<SpouseType, ResourceSymbolId> = {
  supportive: "competence",
  influential: "visibility",
  rich: "eur",
  none: "capacity",
};
