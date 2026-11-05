import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { settle } from "@/lib/service";
import { setRoleAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";

export default async function Users() {
  const admin = await requireAdmin();
  await settle();
  const users = await db.user.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { applications: true } } } });
  return (
    <div className="space-y-4">
      <h1>Users</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Weight</th><th>Ban / reduced</th><th>Applications</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="font-medium text-navy hover:underline">{u.name}</Link></td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.weight}</td>
                <td>{u.banGamesLeft} / {u.reducedGamesLeft}</td>
                <td>{u._count.applications}</td>
                <td>
                  {u.id !== admin.id && (
                    <ActionButton className="btn-secondary !px-2 !py-1 text-xs"
                      action={setRoleAction.bind(null, u.id, u.role === "ADMIN" ? "SUPPORTER" : "ADMIN")}
                      confirm={u.role === "ADMIN" ? `Remove admin from ${u.name}?` : `Make ${u.name} an admin?`}>
                      {u.role === "ADMIN" ? "Make supporter" : "Make admin"}
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
