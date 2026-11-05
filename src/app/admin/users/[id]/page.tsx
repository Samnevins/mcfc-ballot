import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { settle } from "@/lib/service";
import { UserSummary } from "@/components/UserSummary";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  await settle();
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  return (
    <div className="space-y-4">
      <h1>{user.name}</h1>
      <p className="text-sm text-slate-500">{user.email} · {user.role}</p>
      <UserSummary userId={id} />
    </div>
  );
}
