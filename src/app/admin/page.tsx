import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { settle } from "@/lib/service";
import { gameStatus, STATUS_LABEL } from "@/lib/status";
import { fmt } from "@/lib/time";
import { Badge } from "@/components/Badge";
import { GameTags } from "@/components/GameTags";
import { ticketsLabel } from "@/lib/fixture";

export default async function AdminGames() {
  await requireAdmin();
  await settle();
  const games = await db.game.findMany({
    orderBy: { kickoff: "desc" },
    include: { _count: { select: { applications: true, draws: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Games</h1>
        <Link href="/admin/games/new" className="btn">New game</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Opponent</th><th>Match</th><th>Kickoff</th><th>Deadline</th><th>Tickets</th><th>Applicants</th><th>Status</th></tr></thead>
          <tbody>
            {games.map((g) => {
              const s = gameStatus(g, g._count.draws > 0);
              return (
                <tr key={g.id}>
                  <td><Link href={`/admin/games/${g.id}`} className="font-medium text-navy hover:underline">{g.opponent}</Link></td>
                  <td><GameTags game={g} /></td>
                  <td className="whitespace-nowrap">{fmt(g.kickoff)}</td>
                  <td className="whitespace-nowrap">{fmt(g.applicationDeadline)}</td>
                  <td>{ticketsLabel(g.ticketsAvailable)}</td>
                  <td>{g._count.applications}</td>
                  <td><Badge value={s}>{STATUS_LABEL[s]}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
