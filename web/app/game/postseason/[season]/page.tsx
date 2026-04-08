import Link from "next/link";
import { GAME_TITLE } from "@/lib/onboardingContent";

export default async function PostSeasonPage({
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
      <h1>Post-season {season}</h1>
      <p className="muted">Post-season screen is next in the roadmap.</p>
      <Link href={`/game/preseason/${Math.min(Number(season) + 1 || 2, 7)}`} className="btn btn-secondary" style={{ width: "fit-content", textDecoration: "none" }}>
        Go to next pre-season
      </Link>
    </div>
  );
}

