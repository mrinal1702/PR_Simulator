import { AgencyProfitFlashcardScreen } from "@/components/AgencyProfitFlashcardScreen";

export function EndSeasonAgencyProfitScreen({ season }: { season: number }) {
  return <AgencyProfitFlashcardScreen throughSeason={season} />;
}
