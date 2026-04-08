import { SeasonScreen } from "@/components/SeasonScreen";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  return <SeasonScreen season={Number.isFinite(seasonNumber) ? seasonNumber : 1} />;
}

