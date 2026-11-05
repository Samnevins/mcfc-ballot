import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { effectiveWeight, type DrawInputRow } from "@/lib/ballot";
import { getSettings, openTickets, settle } from "@/lib/service";
import { gameStatus, STATUS_LABEL } from "@/lib/status";
import { fmt, toLondonInput } from "@/lib/time";
import { deleteGameAction, drawAction, redrawAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/Badge";
import { GameForm } from "@/components/GameForm";
import { Results } from "@/components/Results";

export default async function AdminGame({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  await settle();
  const game = await db.game.findUnique({
    where: { id },
    include: {
      applications: { include: { user: true }, orderBy: { createdAt: "asc" } },
      draws: {
        orderBy: { round: "asc" },
        include: { ranBy: { select: { name: true } }, allocations: { include: { user: { select: { name: true } } } } },
      },
    },
  });
  if (!game) notFound();
  const cfg = await getSettings();
  const now = new Date();
  const status = gameStatus(game, game.draws.length > 0, now);
  const canDraw = game.draws.length === 0 && now >= game.applicationDeadline && now < game.kickoff;
  const { open, pool } = await openTickets(id);
  const names = new Map(game.applications.map((a) => [a.userId, a.user.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>v {game.opponent}</h1>
        <div className="flex items-center gap-2">
          <Badge value={status}>{STATUS_LABEL[status]}</Badge>
          <Link href={`/games/${id}`} className="btn-secondary">Public page</Link>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3">Details</h2>
        <GameForm
          id={id}
          values={{
            opponent: game.opponent,
            venue: game.venue,
            kickoff: toLondonInput(game.kickoff),
            applicationDeadline: toLondonInput(game.applicationDeadline),
            drawAt: toLondonInput(game.drawAt),
            ticketsAvailable: game.ticketsAvailable,
          }}
        />
        {game.draws.length === 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ActionButton action={deleteGameAction.bind(null, id)} className="btn-danger" confirm="Delete this game and its applications?">
              Delete game
            </ActionButton>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3">Draw</h2>
        {game.draws.length === 0 ? (
          canDraw ? (
            <ActionButton
              action={drawAction.bind(null, id)}
              confirm="Run the draw now? This cannot be undone."
              fields={
                <div>
                  <label className="label" htmlFor="tickets">Tickets to draw</label>
                  <input id="tickets" name="tickets" type="number" min={0} defaultValue={game.ticketsAvailable} className="input w-32" />
                </div>
              }
            >
              Run draw ({game.applications.length} applicants)
            </ActionButton>
          ) : (
            <p className="text-sm text-slate-500">
              {now < game.applicationDeadline ? `The draw can be run after the deadline (${fmt(game.applicationDeadline)}).` : "Game has kicked off."}
            </p>
          )
        ) : (
          <div className="space-y-4">
            <Results draws={game.draws} />
            <div className="border-t border-slate-100 pt-4 text-sm">
              <p className="mb-2">Unclaimed tickets: <strong>{open}</strong> · Remaining eligible applicants: <strong>{pool}</strong></p>
              {open > 0 && pool > 0 && now < game.kickoff && (
                <ActionButton action={redrawAction.bind(null, id)} confirm={`Redraw ${Math.min(open, pool)} ticket(s)?`}>
                  Redraw {Math.min(open, pool)} ticket(s)
                </ActionButton>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3">Applicants ({game.applications.length})</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Applied</th><th>Weight</th><th>Weight in draw now</th></tr></thead>
            <tbody>
              {game.applications.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/users/${a.userId}`} className="hover:underline">{a.user.name}</Link></td>
                  <td>{a.user.email}</td>
                  <td className="whitespace-nowrap">{fmt(a.createdAt)}</td>
                  <td>{a.user.weight}</td>
                  <td>{effectiveWeight(a.user, cfg) || "Banned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {game.draws.length > 0 && (
        <section className="card">
          <h2 className="mb-3">Audit</h2>
          <div className="space-y-6">
            {game.draws.map((d) => {
              const input = JSON.parse(d.inputJson) as DrawInputRow[];
              const order = JSON.parse(d.orderJson) as string[];
              return (
                <div key={d.id} className="text-sm">
                  <p className="font-medium">
                    Round {d.round} · {fmt(d.ranAt)} · by {d.ranBy.name} · seed <code className="rounded bg-slate-100 px-1">{d.seed}</code> · {d.ticketCount} ticket(s)
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Rank</th><th>Applicant</th><th>Base weight</th><th>Draw weight</th><th>Outcome</th></tr></thead>
                      <tbody>
                        {[...order.map((u) => input.find((r) => r.userId === u)!), ...input.filter((r) => r.excluded)].map((r) => {
                          const rank = order.indexOf(r.userId);
                          return (
                            <tr key={r.userId}>
                              <td>{rank >= 0 ? rank + 1 : "—"}</td>
                              <td>{names.get(r.userId) ?? r.userId}</td>
                              <td>{r.weight}</td>
                              <td>{r.effectiveWeight}</td>
                              <td>{r.excluded ? "Excluded (ban)" : rank < d.ticketCount ? "Won" : "Unsuccessful"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Results are reproducible: <code>drawOrder(input, seed)</code> in <code>src/lib/ballot.ts</code> with the stored input and seed returns the stored order.
          </p>
        </section>
      )}
    </div>
  );
}
