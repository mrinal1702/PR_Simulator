import { PreSeasonScreen } from "@/components/PreSeasonScreen";

export default async function PreSeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  return <PreSeasonScreen season={Number.isFinite(seasonNumber) ? seasonNumber : 1} />;
}

