import { PayrollCheckpointScreen } from "@/components/PayrollCheckpointScreen";

export default async function PreSeasonPayrollPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  const seasonNumber = Number.parseInt(season, 10);
  return <PayrollCheckpointScreen season={Number.isFinite(seasonNumber) ? seasonNumber : 1} />;
}

