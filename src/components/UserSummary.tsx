import Link from "next/link";
import { db } from "@/lib/db";
import { effectiveWeight } from "@/lib/ballot";
import { getSettings } from "@/lib/service";
import { allocationStatus, gameStatus } from "@/lib/status";
import { fmt } from "@/lib/time";
import { Badge } from "@/components/Badge";
import { WeightHistory } from "@/components/WeightHistory";

/** Weight, penalties, applications and history for one user. Used by /me and admin. */
export async function UserSummary({ userId }: { userId: string }) {
  const [user, cfg] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        applications: {
          include: { game: { include: { draws: { select: { id: true } } } } },
          orderBy: { game: { kickoff: "desc" } },
        },
        allocations: true,
        weightLogs: { include: { game: { select: { opponent: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getSettings(),
  ]);
  const now = new Date();
  return (
    <div className="space-y-6">
      <section className="card">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">Base weight</dt><dd className="text-2xl font-bold text-navy">{user.weight}</dd></div>
          <div><dt className="text-slate-500">Weight in next draw</dt><dd className="text-2xl font-bold text-navy">{effectiveWeight(user, cfg)}</dd></div>
          <div><dt className="text-slate-500">Banned for next</dt><dd className="text-2xl font-bold">{user.banGamesLeft} game(s)</dd></div>
          <div><dt className="text-slate-500">Reduced weight for</dt><dd className="text-2xl font-bold">{user.reducedGamesLeft} game(s)</dd></div>
        </dl>
      </section>

      <section className="card">
        <h2 className="mb-3">Applications</h2>
        {user.applications.length === 0 && <p className="text-sm text-slate-500">No applications yet.</p>}
        <ul className="divide-y divide-slate-100">
          {user.applications.map(({ game }) => {
            const alloc = user.allocations.find((a) => a.gameId === game.id);
            const drawn = game.draws.length > 0;
            const gs = gameStatus(game, drawn, now);
            return (
              <li key={game.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <Link href={`/games/${game.id}`} className="font-medium hover:underline">v {game.opponent}</Link>
                <span className="text-slate-500">{fmt(game.kickoff)}</span>
                <span className="ml-auto">
                  {alloc ? <Badge value={allocationStatus(alloc, now)}>Won · {allocationStatus(alloc, now)}</Badge>
                    : drawn ? <Badge value="past">Unsuccessful</Badge>
                    : <Badge value={gs}>{gs === "open" ? "Applied" : "Awaiting draw"}</Badge>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3">Weight history</h2>
        <WeightHistory logs={user.weightLogs} />
      </section>
    </div>
  );
}
