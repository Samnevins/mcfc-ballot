import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Current user, loaded fresh from DB (so role/status changes apply immediately). Only APPROVED users count. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  return user?.status === "APPROVED" ? user : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
