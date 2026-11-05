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
import { fromLondonInput } from "@/lib/time";
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

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password" };
    throw e; // redirect
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = registerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: "Email already registered" };
  await db.user.create({
    data: { name: p.data.name, email: p.data.email, passwordHash: await bcrypt.hash(p.data.password, 10) },
  });
  await signIn("credentials", { email: p.data.email, password: p.data.password, redirectTo: "/" });
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

export async function respondAction(allocationId: string, accept: boolean): Promise<ActionState> {
  const u = await requireUser();
  return attempt(() => svc.respondToAllocation(allocationId, u.id, accept));
}

// ---------- Admin ----------

const gameSchema = z
  .object({
    opponent: z.string().trim().min(1, "Opponent is required"),
    venue: z.string().trim().min(1, "Venue is required"),
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

export async function setRoleAction(userId: string, role: "ADMIN" | "SUPPORTER"): Promise<ActionState> {
  const admin = await requireAdmin();
  if (admin.id === userId) return { error: "You cannot change your own role" };
  return attempt(() => db.user.update({ where: { id: userId }, data: { role } }));
}
