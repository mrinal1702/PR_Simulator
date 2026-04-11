import { ScenarioHistoryDetailScreen } from "@/components/ScenarioHistoryDetailScreen";

export default async function ScenarioHistoryDetailPage({
  params,
}: {
  params: Promise<{ season: string; clientId: string }>;
}) {
  const { season, clientId } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 2;
  return <ScenarioHistoryDetailScreen season={seasonNumber} clientId={clientId} />;
}
