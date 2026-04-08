import Link from "next/link";
import { GAME_TITLE } from "@/lib/onboardingContent";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  return (
    <div className="shell">
      <p className="muted">
        <Link href="/">← {GAME_TITLE}</Link>
      </p>
      <h1>Season {season}</h1>
      <p className="muted">Season gameplay screen is next in the roadmap.</p>
      <Link href={`/game/preseason/${season}`} className="btn btn-secondary" style={{ width: "fit-content", textDecoration: "none" }}>
        Back to pre-season
      </Link>
    </div>
  );
}

