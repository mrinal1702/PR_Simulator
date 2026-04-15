import { ClientReviewsScreen } from "@/components/ClientReviewsScreen";

export default async function ClientReviewsPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 3;
  return <ClientReviewsScreen season={seasonNumber} />;
}
