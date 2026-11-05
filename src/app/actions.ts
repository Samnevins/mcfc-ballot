"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/guard";
import * as svc from "@/lib/service";
import * as groups from "@/lib/groups";
import { fromLondonInput } from "@/lib/time";
import { COMPETITION_KEYS, HOME_AWAY_KEYS } from "@/lib/fixture";
import type { ActionState } from "@/components/ActionButton";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

async function attempt(fn: () => Promise<unknown>, ok?: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    return { error: msg(e) };
  }
  revalidatePath("/", "layout");
  return ok ? { ok } : undefined;
}

// ---------- Auth ----------

const STATUS_MESSAGE: Record<string, string> = {
  PENDING: "Your registration is awaiting approval by a club admin.",
  REJECTED: "Your registration was not approved. Contact the club if you think this is a mistake.",
  SUSPENDED: "Your account is suspended. Contact the club.",
};

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status !== "APPROVED" && (await bcrypt.compare(password, user.passwordHash))) {
    return { error: STATUS_MESSAGE[user.status] ?? "Account not active" };
  }
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password" };
    throw e; // redirect
  }
}

const optional = z.string().trim().max(50).optional().transform((v) => v || null);

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email"),
    phone: optional,
    membershipNumber: optional,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, "Passwords do not match");

/** Creates a PENDING account; an admin must approve it before sign-in. */
export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = registerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { confirm: _c, password, ...data } = p.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "Email already registered" };
  await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: "Thanks for registering. A club admin will review your account; you can sign in once it's approved." };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------- Supporter ----------

export async function applyAction(gameId: string): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.apply(gameId, u.id));
}

export async function withdrawAction(gameId: string): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.withdraw(gameId, u.id));
}

export async function applyGroupAction(gameId: string): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.applyGroup(gameId, u.id));
}

export async function withdrawGroupAction(gameId: string): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.withdrawGroup(gameId, u.id));
}

export async function respondAction(allocationId: string, accept: boolean): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.respondToAllocation(allocationId, u.id, accept));
}

// ---------- Admin ----------

const gameSchema = z
  .object({
    opponent: z.string().trim().min(1, "Opponent is required"),
    venue: z.string().trim().min(1, "Venue is required"),
    homeAway: z.enum(HOME_AWAY_KEYS, "Choose home or away"),
    competition: z.enum(COMPETITION_KEYS, "Choose a competition"),
    kickoff: z.string().transform(fromLondonInput),
    applicationDeadline: z.string().transform(fromLondonInput),
    drawAt: z.string().transform(fromLondonInput),
    ticketsAvailable: z.coerce.number().int().min(0),
  })
  .refine((g) => g.applicationDeadline <= g.drawAt, "Deadline must be before the draw")
  .refine((g) => g.drawAt < g.kickoff, "Draw must be before kickoff");

export async function saveGameAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let data;
  try {
    const p = gameSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    data = p.data;
  } catch (e) {
    return { error: msg(e) };
  }
  const game = id ? await db.game.update({ where: { id }, data }) : await db.game.create({ data });
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/games/${game.id}`);
  return { ok: "Saved" };
}

export async function deleteGameAction(id: string): Promise<ActionState> {
  await requireAdmin();
  if (await db.draw.findFirst({ where: { gameId: id } })) return { error: "Cannot delete a game that has been drawn" };
  await db.game.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function drawAction(gameId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(() => svc.runGameDraw(gameId, Number(fd.get("tickets")), admin.id), "Draw complete");
}

export async function redrawAction(gameId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  return attempt(() => svc.runGameRedraw(gameId, admin.id), "Redraw complete");
}

const settingsSchema = z.object({
  weightIncrement: z.coerce.number().min(0).max(10),
  reducedMultiplier: z.coerce.number().min(0).max(1),
  acceptWindowHours: z.coerce.number().int().min(1).max(24 * 14),
});

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  return attempt(() => db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...p.data }, update: p.data }), "Saved");
}

// ---------- Admin: users ----------

const userSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  phone: optional,
  membershipNumber: optional,
  role: z.enum(["SUPPORTER", "ADMIN"]),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
});

export async function setStatusAction(userId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED"): Promise<ActionState> {
  const admin = await requireAdmin();
  if (admin.id === userId) return { error: "You cannot change your own status" };
  return attempt(() => db.user.update({ where: { id: userId }, data: { status } }));
}

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = userSchema.extend({ password: z.string().min(8, "Password must be at least 8 characters") })
    .safeParse({ ...Object.fromEntries(fd), status: "APPROVED" });
  if (!p.success) return { error: p.error.issues[0].message };
  const { password, ...data } = p.data;
  if (await db.user.findUnique({ where: { email: data.email } })) return { error: "Email already registered" };
  const user = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/", "layout");
  redirect(`/admin/users/${user.id}`);
}

export async function updateUserAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (admin.id === userId && (p.data.role !== "ADMIN" || p.data.status !== "APPROVED")) {
    return { error: "You cannot remove your own admin role or deactivate yourself" };
  }
  const clash = await db.user.findUnique({ where: { email: p.data.email } });
  if (clash && clash.id !== userId) return { error: "Email already used by another account" };
  return attempt(() => db.user.update({ where: { id: userId }, data: p.data }), "Saved");
}

export async function resetPasswordAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const passwordHash = await bcrypt.hash(password, 10);
  return attempt(() => db.user.update({ where: { id: userId }, data: { passwordHash } }), "Password updated");
}

const weightSchema = z.object({
  weight: z.coerce.number().min(0).max(100),
  banGamesLeft: z.coerce.number().int().min(0).max(10),
  reducedGamesLeft: z.coerce.number().int().min(0).max(10),
});

/** Manual weight/penalty override, logged as ADMIN. */
export async function adjustWeightAction(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = weightSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  return attempt(
    () =>
      db.$transaction(async (tx) => {
        const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        await svc.applyChange(tx, userId, "ADMIN", svc.stateOf(u), p.data);
      }),
    "Weight updated",
  );
}

// ---------- Groups (supporters: own group; admins: any group) ----------

const groupName = z.string().trim().min(2, "Group name is required").max(60);

/** Leader acting on own group, or admin acting on any (actor = null skips the leader check). */
async function groupActor(groupId: string) {
  const u = await requireUser();
  if (u.role === "ADMIN") {
    const g = await db.group.findUnique({ where: { id: groupId } });
    return g?.leaderId === u.id ? u.id : null;
  }
  return u.id;
}

export async function createGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const p = groupName.safeParse(fd.get("name"));
  if (!p.success) return { error: p.error.issues[0].message };
  return attempt(() => groups.createGroup(u.id, p.data));
}

export async function joinGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => groups.joinGroup(u.id, String(fd.get("code") ?? "")));
}

export async function leaveGroupAction(): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => groups.leaveGroup(u.id));
}

export async function removeMemberAction(groupId: string, userId: string): Promise<ActionState> {
  const actor = await groupActor(groupId);
  return attempt(() => groups.removeMember(groupId, userId, actor));
}

export async function makeLeaderAction(groupId: string, userId: string): Promise<ActionState> {
  const actor = await groupActor(groupId);
  return attempt(() => groups.makeLeader(groupId, userId, actor));
}

export async function renameGroupAction(groupId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await groupActor(groupId);
  const p = groupName.safeParse(fd.get("name"));
  if (!p.success) return { error: p.error.issues[0].message };
  return attempt(() => groups.renameGroup(groupId, p.data, actor), "Renamed");
}

export async function resetCodeAction(groupId: string): Promise<ActionState> {
  const actor = await groupActor(groupId);
  return attempt(() => groups.resetCode(groupId, actor));
}

export async function deleteGroupAction(groupId: string): Promise<ActionState> {
  const actor = await groupActor(groupId);
  return attempt(() => groups.deleteGroup(groupId, actor));
}
