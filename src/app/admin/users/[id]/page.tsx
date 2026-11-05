import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { settle } from "@/lib/service";
import { fmt } from "@/lib/time";
import { setStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge } from "@/components/Badge";
import { UserSummary } from "@/components/UserSummary";
import { ResetPasswordForm, UserDetailsForm, WeightForm } from "@/components/UserForms";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  await settle();
  const user = await db.user.findUnique({
    where: { id },
    include: { groupMember: { include: { group: true } } },
  });
  if (!user) notFound();
  const self = admin.id === user.id;
  const group = user.groupMember?.group;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1>{user.name}</h1>
          <p className="text-sm text-slate-500">
            {user.email} · registered {fmt(user.createdAt, { dateStyle: "medium" })} · <Badge value={user.status}>{user.status.toLowerCase()}</Badge>
            {group && <> · group <Link href="/admin/groups" className="underline">{group.name}</Link>{group.leaderId === user.id && " (leader)"}</>}
          </p>
        </div>
        {!self && (
          <div className="flex gap-2">
            {user.status !== "APPROVED" && (
              <ActionButton action={setStatusAction.bind(null, user.id, "APPROVED")}>Approve</ActionButton>
            )}
            {user.status === "PENDING" && (
              <ActionButton action={setStatusAction.bind(null, user.id, "REJECTED")} className="btn-danger" confirm="Reject this registration?">Reject</ActionButton>
            )}
            {user.status === "APPROVED" && (
              <ActionButton action={setStatusAction.bind(null, user.id, "SUSPENDED")} className="btn-danger"
                confirm="Suspend this account? They will be signed out and unable to sign in.">Suspend</ActionButton>
            )}
          </div>
        )}
      </div>

      <section className="card">
        <h2 className="mb-3">Details</h2>
        <UserDetailsForm user={user} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-1">Weight &amp; penalties</h2>
          <p className="mb-3 text-xs text-slate-500">Manual changes are logged as an admin change.</p>
          <WeightForm user={user} />
        </section>
        <section className="card">
          <h2 className="mb-3">Reset password</h2>
          <ResetPasswordForm userId={user.id} />
        </section>
      </div>

      <UserSummary userId={id} />
    </div>
  );
}
