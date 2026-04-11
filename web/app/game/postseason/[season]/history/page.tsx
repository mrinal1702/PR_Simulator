import { ScenarioHistoryListScreen } from "@/components/ScenarioHistoryListScreen";

export default async function ScenarioHistoryListPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 2;
  return <ScenarioHistoryListScreen season={seasonNumber} />;
}
