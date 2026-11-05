import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { settle } from "@/lib/service";
import { allocationStatus, gameStatus, STATUS_LABEL } from "@/lib/status";
import { fmt } from "@/lib/time";
import { applyAction, applyGroupAction, respondAction, withdrawAction, withdrawGroupAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/Badge";
import { Results } from "@/components/Results";
import { GameTags } from "@/components/GameTags";
import { fixtureTitle, ticketsLabel } from "@/lib/fixture";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  await settle();
  const game = await db.game.findUnique({
    where: { id },
    include: {
      draws: { orderBy: { round: "asc" }, include: { allocations: { include: { user: { select: { name: true } } } } } },
      _count: { select: { applications: true } },
    },
  });
  if (!game) notFound();

  const now = new Date();
  const status = gameStatus(game, game.draws.length > 0, now);
  const app = await db.application.findUnique({ where: { userId_gameId: { userId: user.id, gameId: id } } });
  const applied = !!app;
  const membership = await db.groupMember.findUnique({
    where: { userId: user.id },
    include: { group: { include: { _count: { select: { members: true } } } } },
  });
  const group = membership?.group;
  const isLeader = group?.leaderId === user.id;
  const groupSize = group?._count.members ?? 0;
  const appliedWithGroup = !!app?.groupId;
  const mine = game.draws.flatMap((d) => d.allocations).find((a) => a.userId === user.id);
  const mineStatus = mine && allocationStatus(mine, now);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1>{fixtureTitle(game)}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-600"><GameTags game={game} /> {game.venue}</p>
          </div>
          <Badge value={status}>{STATUS_LABEL[status]}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">Kickoff</dt><dd className="font-medium">{fmt(game.kickoff)}</dd></div>
          <div><dt className="text-slate-500">Application deadline</dt><dd className="font-medium">{fmt(game.applicationDeadline)}</dd></div>
          <div><dt className="text-slate-500">Draw</dt><dd className="font-medium">{fmt(game.drawAt)}</dd></div>
          <div><dt className="text-slate-500">Tickets / applicants</dt><dd className="font-medium">{ticketsLabel(game.ticketsAvailable)} / {game._count.applications}</dd></div>
        </dl>
        {user.role === "ADMIN" && (
          <Link href={`/admin/games/${game.id}`} className="btn-secondary mt-4">Manage game</Link>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2">Your application</h2>
        {status === "open" ? (
          <div className="space-y-3">
            {appliedWithGroup ? (
              <p className="text-sm text-green-700">
                You are applying with your group{group && app?.groupId === group.id ? <> <strong>{group.name}</strong></> : ""}.
                {!isLeader && " Only the group leader can withdraw the group; leaving the group removes you."}
              </p>
            ) : applied ? (
              <p className="text-sm text-green-700">You have registered interest on your own. You can withdraw until the deadline.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!applied && <ActionButton action={applyAction.bind(null, game.id)}>Register interest (just me)</ActionButton>}
              {applied && !appliedWithGroup && (
                <ActionButton action={withdrawAction.bind(null, game.id)} className="btn-secondary">Withdraw</ActionButton>
              )}
              {isLeader && group && !appliedWithGroup && (
                game.ticketsAvailable == null || groupSize <= game.ticketsAvailable ? (
                  <ActionButton action={applyGroupAction.bind(null, game.id)}
                    confirm={`Apply for ${groupSize} ticket(s) as ${group.name}? Any individual applications by members are replaced.${
                      game.ticketsAvailable == null ? " Tickets are TBC: the group can only win if enough are released." : ""}`}>
                    Apply as group {group.name} ({groupSize})
                  </ActionButton>
                ) : (
                  <p className="text-sm text-amber-700">Your group has {groupSize} members but only {game.ticketsAvailable} tickets are available, so it can&apos;t apply as a group.</p>
                )
              )}
              {isLeader && appliedWithGroup && (
                <ActionButton action={withdrawGroupAction.bind(null, game.id)} className="btn-secondary"
                  confirm="Withdraw the whole group's application?">Withdraw group</ActionButton>
              )}
            </div>
            {group && !isLeader && !appliedWithGroup && (
              <p className="text-xs text-slate-500">You&apos;re in <strong>{group.name}</strong>. Your leader can apply for the whole group, which replaces any application you make on your own.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {applied ? `You applied for this game${appliedWithGroup ? " with your group" : ""}.` : "You did not apply for this game."} Applications are closed.
          </p>
        )}

        {mine && (
          <div className="mt-4 rounded-lg border border-sky bg-sky/10 p-4">
            <p className="font-medium text-navy">You were drawn for a ticket! <Badge value={mineStatus!} /></p>
            {mineStatus === "PENDING" && (
              <>
                <p className="mt-1 text-sm">Accept or return by <strong>{fmt(mine.respondBy)}</strong>. Returning, or not responding in time, means a ban from the next game and reduced weight for the two after.</p>
                <div className="mt-3 flex gap-2">
                  <ActionButton action={respondAction.bind(null, mine.id, true)}>Accept ticket</ActionButton>
                  <ActionButton action={respondAction.bind(null, mine.id, false)} className="btn-danger"
                    confirm="Return this ticket? You will be banned from the next game.">Return ticket</ActionButton>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3">Results</h2>
        <Results draws={game.draws} />
      </section>
    </div>
  );
}
