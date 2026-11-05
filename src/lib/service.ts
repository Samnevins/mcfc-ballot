import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  normalizeInput,
  onAccepted,
  onForfeit,
  onGroupWin,
  runMainDraw,
  runRedraw,
  type UserState,
  type WeightReason,
} from "@/lib/ballot";

type Tx = Prisma.TransactionClient;

export async function getSettings(tx: Tx = db) {
  return (
    (await tx.settings.findUnique({ where: { id: 1 } })) ??
    (await tx.settings.create({ data: { id: 1 } }))
  );
}

export const stateOf = (u: { weight: number; banGamesLeft: number; reducedGamesLeft: number }): UserState => ({
  weight: u.weight,
  banGamesLeft: u.banGamesLeft,
  reducedGamesLeft: u.reducedGamesLeft,
});

/** Persist a user state change and log it. */
export async function applyChange(
  tx: Tx,
  userId: string,
  reason: WeightReason | "ADMIN",
  before: UserState,
  after: UserState,
  gameId?: string,
) {
  await tx.user.update({ where: { id: userId }, data: after });
  await tx.weightLog.create({
    data: {
      userId,
      gameId,
      reason,
      oldWeight: before.weight,
      newWeight: after.weight,
      banLeft: after.banGamesLeft,
      reducedLeft: after.reducedGamesLeft,
    },
  });
}

const newSeed = () => randomInt(0, 2 ** 31);

/**
 * Lazily persist expired allocations (no scheduler). Idempotent; call on any read.
 */
export async function settle(now = new Date()) {
  const expired = await db.allocation.findMany({
    where: { status: "PENDING", respondBy: { lt: now } },
    select: { id: true },
  });
  for (const { id } of expired) {
    await db.$transaction(async (tx) => {
      const claimed = await tx.allocation.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (claimed.count === 0) return; // settled concurrently
      const a = await tx.allocation.findUniqueOrThrow({ where: { id }, include: { user: true } });
      const before = stateOf(a.user);
      await applyChange(tx, a.userId, "EXPIRED", before, onForfeit(before), a.gameId);
    });
  }
}

export async function runGameDraw(gameId: string, tickets: number, adminId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
    if (now < game.applicationDeadline) throw new Error("Applications are still open");
    if (await tx.draw.findFirst({ where: { gameId } })) throw new Error("Draw already run");
    if (!Number.isInteger(tickets) || tickets < 0) throw new Error("Invalid ticket count");

    const cfg = await getSettings(tx);
    const apps = await tx.application.findMany({ where: { gameId }, include: { user: true } });
    const groupIds = [...new Set(apps.map((a) => a.groupId).filter((x): x is string => !!x))];
    const names = new Map(
      (await tx.group.findMany({ where: { id: { in: groupIds } } })).map((g) => [g.id, g.name]),
    );
    const penalised = await tx.user.findMany({
      where: { OR: [{ banGamesLeft: { gt: 0 } }, { reducedGamesLeft: { gt: 0 } }] },
    });
    const seed = newSeed();
    const result = runMainDraw({
      applicants: apps.map((a) => ({
        userId: a.userId,
        state: stateOf(a.user),
        groupId: a.groupId,
        groupName: a.groupId ? (names.get(a.groupId) ?? "Group (deleted)") : undefined,
      })),
      penalised: penalised.map((u) => ({ userId: u.id, state: stateOf(u) })),
      tickets,
      seed,
      cfg,
    });

    const draw = await tx.draw.create({
      data: {
        gameId,
        round: 1,
        seed,
        ticketCount: tickets,
        inputJson: JSON.stringify(result.input),
        orderJson: JSON.stringify(result.order),
        ranById: adminId,
        ranAt: now,
      },
    });
    const respondBy = new Date(now.getTime() + cfg.acceptWindowHours * 3600_000);
    for (const userId of result.winnerUserIds) {
      await tx.allocation.create({ data: { drawId: draw.id, gameId, userId, respondBy } });
    }
    for (const c of result.changes) {
      await applyChange(tx, c.userId, c.reason, c.before, c.after, gameId);
    }
    return draw;
  });
}

/** Tickets from round 1 not currently held (pending/accepted), and entries that could take them. */
export async function openTickets(gameId: string, tx: Tx = db) {
  const main = await tx.draw.findUnique({ where: { gameId_round: { gameId, round: 1 } } });
  if (!main) return { main: null, open: 0, pool: 0, fits: 0 };
  const allocs = await tx.allocation.findMany({ where: { gameId } });
  const held = allocs.filter((a) => a.status === "PENDING" || a.status === "ACCEPTED").length;
  const open = Math.max(0, main.ticketCount - held);
  const taken = new Set(allocs.map((a) => a.userId));
  const remaining = normalizeInput(main.inputJson).filter(
    (e) => !e.excluded && !e.members.some((m) => taken.has(m.userId)),
  );
  return { main, open, pool: remaining.length, fits: remaining.filter((e) => e.size <= open).length };
}

export async function runGameRedraw(gameId: string, adminId: string, now = new Date()) {
  await settle(now);
  return db.$transaction(async (tx) => {
    const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
    if (now >= game.kickoff) throw new Error("Game has kicked off");
    const { main, open } = await openTickets(gameId, tx);
    if (!main) throw new Error("Main draw not run yet");
    if (open <= 0) throw new Error("No tickets to redraw");

    const allocs = await tx.allocation.findMany({ where: { gameId } });
    const last = await tx.draw.findFirstOrThrow({ where: { gameId }, orderBy: { round: "desc" } });
    const seed = newSeed();
    const result = runRedraw({
      mainInput: normalizeInput(main.inputJson),
      alreadyAllocated: allocs.map((a) => a.userId),
      tickets: open,
      seed,
    });
    if (result.winners.length === 0) throw new Error("No remaining applicants fit the tickets left");

    const cfg = await getSettings(tx);
    const draw = await tx.draw.create({
      data: {
        gameId,
        round: last.round + 1,
        seed,
        ticketCount: open,
        inputJson: JSON.stringify(result.input),
        orderJson: JSON.stringify(result.order),
        ranById: adminId,
        ranAt: now,
      },
    });
    const respondBy = new Date(now.getTime() + cfg.acceptWindowHours * 3600_000);
    for (const userId of result.winnerUserIds) {
      await tx.allocation.create({ data: { drawId: draw.id, gameId, userId, respondBy } });
    }
    for (const userId of result.groupWinnerUserIds) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const before = stateOf(u);
      await applyChange(tx, userId, "GROUP_WON", before, onGroupWin(before), gameId);
    }
    return draw;
  });
}

export async function respondToAllocation(
  allocationId: string,
  userId: string,
  accept: boolean,
  now = new Date(),
) {
  await settle(now);
  return db.$transaction(async (tx) => {
    const claimed = await tx.allocation.updateMany({
      where: { id: allocationId, userId, status: "PENDING", respondBy: { gte: now } },
      data: { status: accept ? "ACCEPTED" : "RETURNED", respondedAt: now },
    });
    if (claimed.count === 0) throw new Error("This ticket can no longer be changed");
    const a = await tx.allocation.findUniqueOrThrow({ where: { id: allocationId }, include: { user: true } });
    const before = stateOf(a.user);
    if (accept) await applyChange(tx, userId, "ACCEPTED", before, onAccepted(before), a.gameId);
    else await applyChange(tx, userId, "RETURNED", before, onForfeit(before), a.gameId);
  });
}

// ---------- Applications ----------

async function openGame(gameId: string, now: Date, tx: Tx = db) {
  const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
  if (now >= game.applicationDeadline) throw new Error("Applications are closed");
  return game;
}

/** Apply on your own. Not allowed while your group has applied for this game. */
export async function apply(gameId: string, userId: string, now = new Date()) {
  await openGame(gameId, now);
  const existing = await db.application.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (existing?.groupId) throw new Error("You are already in your group's application");
  if (!existing) await db.application.create({ data: { userId, gameId } });
}

export async function withdraw(gameId: string, userId: string, now = new Date()) {
  await openGame(gameId, now);
  const existing = await db.application.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (existing?.groupId) throw new Error("Your group leader withdraws group applications, or you can leave the group");
  await db.application.deleteMany({ where: { userId, gameId } });
}

/** Leader applies for the whole group; replaces any individual applications by members. */
export async function applyGroup(gameId: string, leaderId: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    const game = await openGame(gameId, now, tx);
    const group = await tx.group.findFirst({ where: { leaderId }, include: { members: true } });
    if (!group) throw new Error("Only a group leader can apply for the group");
    if (group.members.length > game.ticketsAvailable) {
      throw new Error(`Your group has ${group.members.length} members but only ${game.ticketsAvailable} tickets are available`);
    }
    for (const m of group.members) {
      await tx.application.upsert({
        where: { userId_gameId: { userId: m.userId, gameId } },
        create: { userId: m.userId, gameId, groupId: group.id },
        update: { groupId: group.id },
      });
    }
  });
}

export async function withdrawGroup(gameId: string, leaderId: string, now = new Date()) {
  await openGame(gameId, now);
  const group = await db.group.findFirst({ where: { leaderId } });
  if (!group) throw new Error("Only a group leader can withdraw the group");
  await db.application.deleteMany({ where: { gameId, groupId: group.id } });
}
