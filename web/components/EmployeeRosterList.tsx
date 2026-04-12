"use client";

import type { CSSProperties, ReactNode } from "react";
import { ResourceSymbol, type ResourceSymbolId } from "@/components/resourceSymbols";
import { employeeTotalCapacityContribution, type EmployeeRecord } from "@/lib/tenureCapacity";

const BAND_LABEL_STYLE: Record<0 | 1 | 2 | 3, CSSProperties> = {
  0: { color: "#b91c1c", fontWeight: 600 },
  1: { color: "#ca8a04", fontWeight: 600 },
  2: { color: "#65a30d", fontWeight: 600 },
  3: { color: "#14532d", fontWeight: 600 },
};

function bandTierFromPct(pct: number): 0 | 1 | 2 | 3 {
  if (pct <= 25) return 0;
  if (pct <= 50) return 1;
  if (pct <= 75) return 2;
  return 3;
}

function productivityBandLabel(productivityPct: number): string {
  if (productivityPct <= 25) return "Slacker";
  if (productivityPct <= 50) return "Okay-ish";
  if (productivityPct <= 75) return "Workhorse";
  return "Machine";
}

function skillBandLabel(skillPct: number): string {
  if (skillPct <= 25) return "Still learning";
  if (skillPct <= 50) return "Capable enough";
  if (skillPct <= 75) return "Sharp";
  return "Elite";
}

function inferSkillPct(employee: EmployeeRecord): number | null {
  if (employee.role === "Intern") return null;
  const tierMax = employee.salary < 40_000 ? 20 : employee.salary < 65_000 ? 40 : 80;
  const totalSkill =
    employee.role === "Data Analyst"
      ? employee.competenceGain
      : employee.role === "Sales Representative"
        ? employee.visibilityGain
        : employee.competenceGain + employee.visibilityGain;
  if (totalSkill <= 0) return 0;
  return Math.round((totalSkill / tierMax) * 100);
}

function EmployeeBand({ label, pct }: { label: string; pct: number }) {
  return <span style={BAND_LABEL_STYLE[bandTierFromPct(pct)]}>{label}</span>;
}

function EmployeeStat({
  symbol,
  label,
  value,
  suffix,
}: {
  symbol: ResourceSymbolId;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.22rem 0.5rem",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "rgba(255, 255, 255, 0.03)",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--accent)" }} aria-hidden>
        <ResourceSymbol id={symbol} size={14} />
      </span>
      <span>
        {label}: +{value}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </span>
  );
}

export function EmployeeRosterList({
  employees,
  renderActions,
  renderFooter,
}: {
  employees: EmployeeRecord[];
  renderActions?: (employee: EmployeeRecord) => ReactNode;
  renderFooter?: (employee: EmployeeRecord) => ReactNode;
}) {
  if (employees.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        No employees hired yet.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {[...employees]
        .sort((a, b) => b.salary - a.salary)
        .map((employee) => {
          const skillPct = inferSkillPct(employee);
          const totalCapacity = employeeTotalCapacityContribution(employee);
          const tenureBonus = employee.tenureCapacityBonus ?? 0;

          return (
            <div
              key={employee.id}
              style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "0.7rem 0.8rem" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {employee.name} · {employee.role}
                  </p>
                  <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                    Salary: EUR {employee.salary.toLocaleString("en-GB")}
                  </p>
                  {employee.productivityPct != null || skillPct != null ? (
                    <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                      {employee.productivityPct != null ? (
                        <>
                          Productivity:{" "}
                          <EmployeeBand
                            label={productivityBandLabel(employee.productivityPct)}
                            pct={employee.productivityPct}
                          />
                        </>
                      ) : null}
                      {employee.productivityPct != null && skillPct != null ? " · " : null}
                      {skillPct != null ? (
                        <>
                          Skill: <EmployeeBand label={skillBandLabel(skillPct)} pct={skillPct} />
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {renderActions ? renderActions(employee) : null}
              </div>

              <div
                className="muted"
                style={{
                  marginTop: "0.45rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  fontSize: "0.88rem",
                }}
              >
                {employee.visibilityGain > 0 ? (
                  <EmployeeStat symbol="visibility" label="Visibility" value={employee.visibilityGain} />
                ) : null}
                {employee.competenceGain > 0 ? (
                  <EmployeeStat symbol="competence" label="Competence" value={employee.competenceGain} />
                ) : null}
                {totalCapacity > 0 ? (
                  <EmployeeStat
                    symbol="capacity"
                    label="Capacity"
                    value={totalCapacity}
                    suffix={tenureBonus > 0 ? `(${tenureBonus} tenure)` : undefined}
                  />
                ) : null}
              </div>

              {renderFooter ? renderFooter(employee) : null}
            </div>
          );
        })}
    </div>
  );
}
