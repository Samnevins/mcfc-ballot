import { competitionLabel, homeAwayLabel } from "@/lib/fixture";

const COMP_STYLE: Record<string, string> = {
  PREMIER_LEAGUE: "bg-purple-100 text-purple-800",
  FA_CUP: "bg-red-100 text-red-800",
  CARABAO_CUP: "bg-emerald-100 text-emerald-800",
  CHAMPIONS_LEAGUE: "bg-blue-900 text-white",
  OTHER: "bg-slate-100 text-slate-700",
};

export function GameTags({ game }: { game: { homeAway: string; competition: string } }) {
  const tag = "inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <span className={`${tag} ${game.homeAway === "HOME" ? "bg-sky text-navy" : "border border-slate-300 text-slate-600"}`}>
        {homeAwayLabel(game.homeAway)}
      </span>
      <span className={`${tag} ${COMP_STYLE[game.competition] ?? COMP_STYLE.OTHER}`}>{competitionLabel(game.competition)}</span>
    </span>
  );
}
