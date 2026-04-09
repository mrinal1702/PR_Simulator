import { SeasonSummaryScreen } from "@/components/SeasonSummaryScreen";

export default async function SeasonSummaryPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 1;
  return <SeasonSummaryScreen season={seasonNumber} />;
}
