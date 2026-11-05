import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { settle } from "@/lib/service";
import { fmt } from "@/lib/time";
import { setStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/Badge";

const FILTERS = ["ALL", "APPROVED", "PENDING", "REJECTED", "SUSPENDED"] as const;

export default async function Users({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  await settle();
  const { status: rawStatus, q = "" } = await searchParams;
  const status = FILTERS.find((f) => f === rawStatus) ?? "ALL";

  const pending = await db.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });
  const where: Prisma.UserWhereInput = {
    ...(status !== "ALL" && { status }),
    ...(q && { OR: [{ name: { contains: q } }, { email: { contains: q } }, { membershipNumber: { contains: q } }] }),
  };
  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: { groupMember: { include: { group: { select: { name: true } } } }, _count: { select: { applications: true } } },
  });
  const small = "!px-2 !py-1 text-xs";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Users</h1>
        <div className="flex gap-2">
          <Link href="/admin/groups" className="btn-secondary">Groups</Link>
          <Link href="/admin/users/new" className="btn">Add user</Link>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3">Awaiting approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations waiting.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Membership no.</th><th>Registered</th><th></th></tr></thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td><Link href={`/admin/users/${u.id}`} className="font-medium text-navy hover:underline">{u.name}</Link></td>
                    <td>{u.email}</td>
                    <td>{u.phone ?? "—"}</td>
                    <td>{u.membershipNumber ?? "—"}</td>
                    <td className="whitespace-nowrap">{fmt(u.createdAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        <ActionButton className={`btn ${small}`} action={setStatusAction.bind(null, u.id, "APPROVED")}>Approve</ActionButton>
                        <ActionButton className={`btn-danger ${small}`} action={setStatusAction.bind(null, u.id, "REJECTED")}
                          confirm={`Reject ${u.name}'s registration?`}>Reject</ActionButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link key={f} href={`/admin/users?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${f === status ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </Link>
          ))}
          <form className="ml-auto flex gap-2">
            <input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q} placeholder="Search name, email, membership" className="input !py-1 w-64" />
            <button className="btn-secondary !py-1">Search</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Group</th><th>Weight</th><th>Ban / reduced</th><th>Apps</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><Link href={`/admin/users/${u.id}`} className="font-medium text-navy hover:underline">{u.name}</Link></td>
                  <td>{u.email}</td>
                  <td><Badge value={u.status}>{u.status.toLowerCase()}</Badge></td>
                  <td>{u.role === "ADMIN" ? <Badge value="drawn">admin</Badge> : "supporter"}</td>
                  <td>{u.groupMember?.group.name ?? "—"}</td>
                  <td>{u.weight}</td>
                  <td>{u.banGamesLeft} / {u.reducedGamesLeft}</td>
                  <td>{u._count.applications}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={8} className="text-slate-500">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
