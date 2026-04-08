import { PostSeasonHubScreen } from "@/components/PostSeasonHubScreen";

export default async function PostSeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 1;
  return <PostSeasonHubScreen season={seasonNumber} />;
}

