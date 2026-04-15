import { redirect } from "next/navigation";

export default async function EndSeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  redirect(`/game/postseason/${season}/agency-profit`);
}
