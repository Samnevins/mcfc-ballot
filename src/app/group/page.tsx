import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { getSettings } from "@/lib/service";
import { fmt } from "@/lib/time";
import {
  createGroupAction, deleteGroupAction, joinGroupAction, leaveGroupAction, renameGroupAction, resetCodeAction,
} from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { GroupMembers } from "@/components/GroupMembers";
import { GameTags } from "@/components/GameTags";

export default async function GroupPage() {
  const user = await requireUser();
  const cfg = await getSettings();
  const membership = await db.groupMember.findUnique({
    where: { userId: user.id },
    include: { group: { include: { members: { include: { user: true }, orderBy: { joinedAt: "asc" } } } } },
  });

  if (!membership) {
    return (
      <div className="space-y-4">
        <h1>My group</h1>
        <p className="text-sm text-slate-600">
          Apply for tickets together with friends. A group enters the draw as one entry, with the average of its members&apos; weights,
          and only if enough tickets are left for everyone. If the group wins, every member&apos;s weight resets to 1.0, and each member
          accepts or returns their own ticket.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card">
            <h2 className="mb-3">Create a group</h2>
            <ActionButton action={createGroupAction}
              fields={<div className="w-full"><label className="label" htmlFor="name">Group name</label><input id="name" name="name" className="input" required /></div>}>
              Create group
            </ActionButton>
          </section>
          <section className="card">
            <h2 className="mb-3">Join a group</h2>
            <ActionButton action={joinGroupAction}
              fields={<div className="w-full"><label className="label" htmlFor="code">Join code from the group leader</label><input id="code" name="code" className="input uppercase" required maxLength={6} /></div>}>
              Join group
            </ActionButton>
          </section>
        </div>
      </div>
    );
  }

  const g = membership.group;
  const isLeader = g.leaderId === user.id;
  const now = new Date();
  const apps = await db.application.findMany({
    where: { groupId: g.id, userId: user.id, game: { kickoff: { gt: now } } },
    include: { game: true },
    orderBy: { game: { kickoff: "asc" } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>{g.name}</h1>
        <ActionButton action={leaveGroupAction} className="btn-secondary"
          confirm={isLeader && g.members.length > 1 ? "Leave the group? Leadership passes to the longest-standing member." : "Leave this group?"}>
          Leave group
        </ActionButton>
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">Join code:</span>
          <code className="rounded bg-slate-100 px-3 py-1 text-lg font-bold tracking-widest text-navy">{g.code}</code>
          {isLeader && <ActionButton action={resetCodeAction.bind(null, g.id)} className="btn-secondary !px-2 !py-1 text-xs"
            confirm="Generate a new code? The old one stops working.">New code</ActionButton>}
        </div>
        <GroupMembers groupId={g.id} leaderId={g.leaderId} members={g.members} cfg={cfg} manage={isLeader} />
      </section>

      <section className="card">
        <h2 className="mb-2">Group applications</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming group applications. {isLeader ? "Apply from a game's page." : "Your leader applies from a game's page."}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {apps.map((a) => (
              <li key={a.id} className="py-2"><Link href={`/games/${a.gameId}`} className="font-medium hover:underline">v {a.game.opponent}</Link> <GameTags game={a.game} /> · {fmt(a.game.kickoff)}</li>
            ))}
          </ul>
        )}
      </section>

      {isLeader && (
        <section className="card space-y-4">
          <h2>Leader settings</h2>
          <ActionButton action={renameGroupAction.bind(null, g.id)} className="btn-secondary"
            fields={<div><label className="label" htmlFor="name">Group name</label><input id="name" name="name" defaultValue={g.name} className="input" required /></div>}>
            Rename
          </ActionButton>
          <div>
            <ActionButton action={deleteGroupAction.bind(null, g.id)} className="btn-danger"
              confirm="Disband the group? Applications for open games are withdrawn.">Disband group</ActionButton>
          </div>
        </section>
      )}
    </div>
  );
}
