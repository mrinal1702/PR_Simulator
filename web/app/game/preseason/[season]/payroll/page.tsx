import { redirect } from "next/navigation";

/** Redirect only: roster and settlement live on `/game/preseason/[season]`. See `docs/AGENCY_FINANCE.md`. */
export default async function PreSeasonPayrollPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season } = await params;
  redirect(`/game/preseason/${season}`);
}
