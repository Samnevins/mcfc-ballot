import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

async function uniqueCode(tx: Tx) {
  for (;;) {
    const code = newCode();
    if (!(await tx.group.findUnique({ where: { code } }))) return code;
  }
}

/** Games this group has applied for whose deadline has not passed. */
async function openGroupGames(tx: Tx, groupId: string, now: Date) {
  const apps = await tx.application.findMany({
    where: { groupId, game: { applicationDeadline: { gt: now } } },
    select: { gameId: true },
    distinct: ["gameId"],
  });
  return apps.map((a) => a.gameId);
}

export async function createGroup(userId: string, name: string) {
  return db.$transaction(async (tx) => {
    if (await tx.groupMember.findUnique({ where: { userId } })) throw new Error("You are already in a group");
    const group = await tx.group.create({ data: { name, code: await uniqueCode(tx), leaderId: userId } });
    await tx.groupMember.create({ data: { groupId: group.id, userId } });
    return group;
  });
}

/** Join by code. The new member is added to the group's open applications (if tickets allow). */
export async function joinGroup(userId: string, code: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    if (await tx.groupMember.findUnique({ where: { userId } })) throw new Error("Leave your current group first");
    const group = await tx.group.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new Error("No group with that code");
    const size = group._count.members + 1;
    for (const gameId of await openGroupGames(tx, group.id, now)) {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
      if (game.ticketsAvailable != null && size > game.ticketsAvailable) {
        throw new Error(`The group has applied for ${game.opponent}, which only has ${game.ticketsAvailable} tickets`);
      }
      await tx.application.upsert({
        where: { userId_gameId: { userId, gameId } },
        create: { userId, gameId, groupId: group.id },
        update: { groupId: group.id },
      });
    }
    await tx.groupMember.create({ data: { groupId: group.id, userId } });
  });
}

/** Remove a member. Their open group applications go; closed ones stay as they were at the deadline. */
async function removeMemberTx(tx: Tx, groupId: string, userId: string, now: Date) {
  const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
  await tx.groupMember.delete({ where: { userId } });
  await tx.application.deleteMany({ where: { userId, groupId, game: { applicationDeadline: { gt: now } } } });
  if (group.leaderId === userId) {
    const next = await tx.groupMember.findFirst({ where: { groupId }, orderBy: { joinedAt: "asc" } });
    if (next) await tx.group.update({ where: { id: groupId }, data: { leaderId: next.userId } });
    else await tx.group.delete({ where: { id: groupId } });
  }
}

export async function leaveGroup(userId: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    const m = await tx.groupMember.findUnique({ where: { userId } });
    if (!m) throw new Error("You are not in a group");
    await removeMemberTx(tx, m.groupId, userId, now);
  });
}

/** Leader (actorId) or admin (actorId = null) removes a member. */
export async function removeMember(groupId: string, userId: string, actorId: string | null, now = new Date()) {
  await db.$transaction(async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
    if (actorId && group.leaderId !== actorId) throw new Error("Only the group leader can remove members");
    const m = await tx.groupMember.findUnique({ where: { userId } });
    if (!m || m.groupId !== groupId) throw new Error("Not a member of this group");
    await removeMemberTx(tx, groupId, userId, now);
  });
}

export async function makeLeader(groupId: string, userId: string, actorId: string | null) {
  const group = await db.group.findUniqueOrThrow({ where: { id: groupId } });
  if (actorId && group.leaderId !== actorId) throw new Error("Only the group leader can do that");
  const m = await db.groupMember.findUnique({ where: { userId } });
  if (!m || m.groupId !== groupId) throw new Error("Not a member of this group");
  await db.group.update({ where: { id: groupId }, data: { leaderId: userId } });
}

export async function renameGroup(groupId: string, name: string, actorId: string | null) {
  const group = await db.group.findUniqueOrThrow({ where: { id: groupId } });
  if (actorId && group.leaderId !== actorId) throw new Error("Only the group leader can do that");
  await db.group.update({ where: { id: groupId }, data: { name } });
}

export async function resetCode(groupId: string, actorId: string | null) {
  await db.$transaction(async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
    if (actorId && group.leaderId !== actorId) throw new Error("Only the group leader can do that");
    await tx.group.update({ where: { id: groupId }, data: { code: await uniqueCode(tx) } });
  });
}

/** Disband: open group applications are withdrawn; closed ones stay for the draw. */
export async function deleteGroup(groupId: string, actorId: string | null, now = new Date()) {
  await db.$transaction(async (tx) => {
    const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
    if (actorId && group.leaderId !== actorId) throw new Error("Only the group leader can disband the group");
    await tx.application.deleteMany({ where: { groupId, game: { applicationDeadline: { gt: now } } } });
    await tx.group.delete({ where: { id: groupId } });
  });
}

/** Group names by id, for labelling draw entries (includes nothing for deleted groups). */
export async function groupNames(ids: (string | null)[]) {
  const list = ids.filter((x): x is string => !!x);
  if (!list.length) return new Map<string, string>();
  const groups = await db.group.findMany({ where: { id: { in: list } }, select: { id: true, name: true } });
  return new Map(groups.map((g) => [g.id, g.name]));
}
