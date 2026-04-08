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
      <p className="muted">
        Season client work is finished for this year. Deeper post-season events and rewards are on the roadmap — for now
        this is a milestone screen after you used <strong>Continue to post-season</strong> from the season hub.
      </p>
      <Link href={`/game/preseason/${Math.min(Number(season) + 1 || 2, 7)}`} className="btn btn-secondary" style={{ width: "fit-content", textDecoration: "none" }}>
        Go to next pre-season
      </Link>
    </div>
  );
}

