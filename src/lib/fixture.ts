// Match tags: home/away and competition. Stored as strings on Game.

export const HOME_AWAY = { HOME: "Home", AWAY: "Away" } as const;

export const COMPETITIONS = {
  PREMIER_LEAGUE: "Premier League",
  FA_CUP: "FA Cup",
  CARABAO_CUP: "Carabao Cup",
  CHAMPIONS_LEAGUE: "Champions League",
  OTHER: "Other",
} as const;

export type HomeAway = keyof typeof HOME_AWAY;
export type Competition = keyof typeof COMPETITIONS;

export const HOME_AWAY_KEYS = Object.keys(HOME_AWAY) as [HomeAway, ...HomeAway[]];
export const COMPETITION_KEYS = Object.keys(COMPETITIONS) as [Competition, ...Competition[]];

export const competitionLabel = (c: string) => COMPETITIONS[c as Competition] ?? c;
export const homeAwayLabel = (h: string) => HOME_AWAY[h as HomeAway] ?? h;

/** Ticket count for display: a number, or "TBC" when not yet known. */
export const ticketsLabel = (n: number | null) => (n == null ? "TBC" : String(n));

/** "Manchester City v Arsenal" (home) or "Arsenal v Manchester City" (away). */
export function fixtureTitle(g: { opponent: string; homeAway: string }) {
  return g.homeAway === "AWAY" ? `${g.opponent} v Manchester City` : `Manchester City v ${g.opponent}`;
}
