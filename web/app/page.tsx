import { applySpouseAtStart, totalV, type SpouseType } from "@/lib/gameEconomy";

const BUILDS = [
  {
    id: "velvet_rolodex",
    name: "The Velvet Rolodex",
    base: { eur: 16_000, competence: 30, visibility: 80, firmCapacity: 50 },
  },
  {
    id: "summa_cum_basement",
    name: "Summa Cum Basement",
    base: { eur: 16_000, competence: 80, visibility: 30, firmCapacity: 50 },
  },
  {
    id: "portfolio_pivot",
    name: "The Portfolio Pivot",
    base: { eur: 80_000, competence: 22, visibility: 24, firmCapacity: 50 },
  },
] as const;

export default function HomePage() {
  return (
    <main>
      <h1>Reputation Recovery Simulator</h1>
      <p>
        Placeholder shell. Connect Supabase env vars on Vercel, run the SQL migration,
        then wire auth + onboarding.
      </p>
      <h2 style={{ marginTop: "2rem" }}>Build preview (equal Total_V before spouse)</h2>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Build</th>
            <th>EUR</th>
            <th>Comp</th>
            <th>Vis</th>
            <th>Cap</th>
            <th>Total_V</th>
          </tr>
        </thead>
        <tbody>
          {BUILDS.map((b) => {
            const v = totalV(b.base);
            return (
              <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{b.name}</td>
                <td>{b.base.eur.toLocaleString("de-DE")}</td>
                <td>{b.base.competence}</td>
                <td>{b.base.visibility}</td>
                <td>{b.base.firmCapacity}</td>
                <td>{v.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h2 style={{ marginTop: "2rem" }}>Example: rich spouse on Pivot</h2>
      <pre style={{ background: "#f5f5f5", padding: 12, overflow: "auto" }}>
        {JSON.stringify(
          applySpouseAtStart(BUILDS[2].base, "rich" as SpouseType),
          null,
          2
        )}
      </pre>
    </main>
  );
}
