import { AgencyProfitFlashcardScreen } from "@/components/AgencyProfitFlashcardScreen";

export default async function AgencyProfitPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 1;
  return <AgencyProfitFlashcardScreen throughSeason={seasonNumber} />;
}
