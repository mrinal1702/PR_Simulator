import { PostSeasonResultsScreen } from "@/components/PostSeasonResultsScreen";

export default async function PostSeasonResultsPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 1;
  return <PostSeasonResultsScreen season={seasonNumber} />;
}
