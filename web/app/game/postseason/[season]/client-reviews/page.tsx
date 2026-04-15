import { ClientReviewsScreen } from "@/components/ClientReviewsScreen";
import { redirect } from "next/navigation";

export default async function ClientReviewsPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.isFinite(Number(season)) ? Number(season) : 3;
  if (seasonNumber < 3) {
    redirect(`/game/postseason/${seasonNumber}/agency-profit`);
  }
  return <ClientReviewsScreen season={seasonNumber} />;
}
