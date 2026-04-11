import { PostSeasonResolutionScreen } from "@/components/PostSeasonResolutionScreen";

export default async function PostSeasonResolutionsPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 2;
  return <PostSeasonResolutionScreen season={seasonNumber} />;
}
