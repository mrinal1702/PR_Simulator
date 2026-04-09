import { redirect } from "next/navigation";

/** Mandatory payroll checkpoint removed — resolve roster on main pre-season screen. */
export default async function PreSeasonPayrollPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  redirect(`/game/preseason/${season}`);
}
