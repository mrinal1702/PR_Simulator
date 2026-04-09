"use client";

import type { NewGamePayload } from "@/components/NewGameWizard";
import { MetricBreakdownModalBody } from "@/components/MetricBreakdownModalBody";
import type { BreakdownMetric } from "@/lib/metricBreakdown";

export function AgencyFinanceBreakdownHost({
  save,
  metric,
  onClose,
}: {
  save: NewGamePayload;
  metric: BreakdownMetric;
  onClose: () => void;
}) {
  return (
    <div className="game-modal-overlay" role="dialog" aria-modal="true" aria-label="Metric breakdown">
      <div className="game-modal">
        <MetricBreakdownModalBody metric={metric} save={save} />
        <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
