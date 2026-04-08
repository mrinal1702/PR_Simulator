import { SeasonClientCaseScreen } from "@/components/SeasonClientCaseScreen";

export default async function SeasonClientCasePage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  return <SeasonClientCaseScreen season={Number.isFinite(seasonNumber) ? seasonNumber : 1} />;
}
