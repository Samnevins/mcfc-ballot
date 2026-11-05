// Derived statuses — computed from timestamps on read, never stored.

export type GameStatus = "open" | "closed" | "drawn" | "past";

export function gameStatus(
  g: { applicationDeadline: Date; kickoff: Date },
  hasDraw: boolean,
  now = new Date(),
): GameStatus {
  if (now >= g.kickoff) return "past";
  if (hasDraw) return "drawn";
  if (now < g.applicationDeadline) return "open";
  return "closed";
}

export type AllocationStatus = "PENDING" | "ACCEPTED" | "RETURNED" | "EXPIRED";

/** A PENDING allocation past its window is effectively EXPIRED (settle() persists it). */
export function allocationStatus(a: { status: string; respondBy: Date }, now = new Date()): AllocationStatus {
  if (a.status === "PENDING" && now > a.respondBy) return "EXPIRED";
  return a.status as AllocationStatus;
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  open: "Applications open",
  closed: "Awaiting draw",
  drawn: "Drawn",
  past: "Played",
};
