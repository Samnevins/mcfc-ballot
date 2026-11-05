import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { getSettings } from "@/lib/service";
import { fmt } from "@/lib/time";
import { deleteGroupAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { GroupMembers } from "@/components/GroupMembers";

export default async function AdminGroups() {
  await requireAdmin();
  const cfg = await getSettings();
  const groups = await db.group.findMany({
    orderBy: { name: "asc" },
    include: { leader: { select: { name: true } }, members: { include: { user: true }, orderBy: { joinedAt: "asc" } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Groups ({groups.length})</h1>
        <Link href="/admin/users" className="btn-secondary">Users</Link>
      </div>
      {groups.length === 0 && <p className="card text-sm text-slate-500">No groups yet. Supporters create groups from “My group”.</p>}
      {groups.map((g) => (
        <section key={g.id} className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2>{g.name}</h2>
              <p className="text-xs text-slate-500">
                Leader {g.leader.name} · code <code className="font-bold">{g.code}</code> · created {fmt(g.createdAt, { dateStyle: "medium" })}
              </p>
            </div>
            <ActionButton action={deleteGroupAction.bind(null, g.id)} className="btn-danger !px-2 !py-1 text-xs"
              confirm={`Delete ${g.name}? Its applications for open games are withdrawn; closed ones still go into the draw.`}>
              Delete group
            </ActionButton>
          </div>
          <GroupMembers groupId={g.id} leaderId={g.leaderId} members={g.members} cfg={cfg} manage />
        </section>
      ))}
    </div>
  );
}
