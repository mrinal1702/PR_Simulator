import { EndSeasonAgencyProfitScreen } from "@/components/EndSeasonAgencyProfitScreen";

export default async function EndSeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 1;
  return <EndSeasonAgencyProfitScreen season={seasonNumber} />;
}
