import { HiringScreen } from "@/components/HiringScreen";

export default async function HiringPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  return <HiringScreen season={Number.isFinite(seasonNumber) ? seasonNumber : 1} />;
}

