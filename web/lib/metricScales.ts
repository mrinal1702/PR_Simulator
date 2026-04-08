export type MetricId = "reputation" | "visibility" | "competence";

export type MetricBand = {
  min: number;
  max: number;
  label: string;
  color: string;
};

export type MetricScale = {
  id: MetricId;
  min: number;
  max: number;
  bands: MetricBand[];
};

const RED = "#ef4444";
const ORANGE = "#f97316";
const YELLOW = "#eab308";
const LIME = "#84cc16";
const GREEN = "#22c55e";

/**
 * Data-only ranges so balancing can be changed without UI rewrites.
 */
export const METRIC_SCALES: Record<MetricId, MetricScale> = {
  reputation: {
    id: "reputation",
    min: -100,
    max: 200,
    bands: [
      { min: -100, max: -50, label: "Fraud", color: RED },
      { min: -49, max: -25, label: "Untrustworthy", color: ORANGE },
      { min: -24, max: 0, label: "Dicey", color: YELLOW },
      { min: 1, max: 30, label: "Insignificant", color: "#facc15" },
      { min: 31, max: 70, label: "Reputable", color: LIME },
      { min: 71, max: 120, label: "Trustworthy", color: GREEN },
      { min: 121, max: 200, label: "Institutional", color: "#16a34a" },
    ],
  },
  visibility: {
    id: "visibility",
    min: 0,
    max: 1000,
    bands: [
      { min: 0, max: 50, label: "Unknown", color: RED },
      { min: 51, max: 150, label: "Local Buzz", color: ORANGE },
      { min: 151, max: 300, label: "Niche Noticed", color: YELLOW },
      { min: 301, max: 450, label: "Talk of the Feed", color: "#facc15" },
      { min: 451, max: 600, label: "Trending", color: LIME },
      { min: 601, max: 800, label: "Mainstream", color: GREEN },
      { min: 801, max: 1000, label: "Ubiquitous", color: "#16a34a" },
    ],
  },
  competence: {
    id: "competence",
    min: 0,
    max: 1000,
    bands: [
      { min: 0, max: 50, label: "Winging It", color: RED },
      { min: 51, max: 150, label: "Junior Desk", color: ORANGE },
      { min: 151, max: 300, label: "Practitioner", color: YELLOW },
      { min: 301, max: 450, label: "Strategist", color: "#facc15" },
      { min: 451, max: 600, label: "Specialist", color: LIME },
      { min: 601, max: 800, label: "Expert Office", color: GREEN },
      { min: 801, max: 1000, label: "Crisis Authority", color: "#16a34a" },
    ],
  },
};

export function clampToScale(value: number, scale: MetricScale): number {
  return Math.max(scale.min, Math.min(scale.max, value));
}

export function getMetricBand(metricId: MetricId, rawValue: number): MetricBand {
  const scale = METRIC_SCALES[metricId];
  const value = clampToScale(rawValue, scale);
  return (
    scale.bands.find((b) => value >= b.min && value <= b.max) ??
    scale.bands[scale.bands.length - 1]
  );
}

export function metricPercent(metricId: MetricId, rawValue: number): number {
  const scale = METRIC_SCALES[metricId];
  const value = clampToScale(rawValue, scale);
  const span = scale.max - scale.min;
  if (span <= 0) return 0;
  return ((value - scale.min) / span) * 100;
}

