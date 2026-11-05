import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  onAccepted,
  onForfeit,
  runMainDraw,
  runRedraw,
  type DrawInputRow,
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

const stateOf = (u: { weight: number; banGamesLeft: number; reducedGamesLeft: number }): UserState => ({
  weight: u.weight,
  banGamesLeft: u.banGamesLeft,
  reducedGamesLeft: u.reducedGamesLeft,
});

/** Persist a user state change and log it. */
async function applyChange(
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
    const penalised = await tx.user.findMany({
      where: { OR: [{ banGamesLeft: { gt: 0 } }, { reducedGamesLeft: { gt: 0 } }] },
    });
    const seed = newSeed();
    const result = runMainDraw({
      applicants: apps.map((a) => ({ userId: a.userId, state: stateOf(a.user) })),
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
    for (const userId of result.winners) {
      await tx.allocation.create({ data: { drawId: draw.id, gameId, userId, respondBy } });
    }
    for (const c of result.changes) {
      await applyChange(tx, c.userId, c.reason, c.before, c.after, gameId);
    }
    return draw;
  });
}

/** Tickets from round 1 not currently held (pending/accepted). */
export async function openTickets(gameId: string, tx: Tx = db) {
  const main = await tx.draw.findUnique({ where: { gameId_round: { gameId, round: 1 } } });
  if (!main) return { main: null, open: 0, pool: 0 };
  const allocs = await tx.allocation.findMany({ where: { gameId } });
  const held = allocs.filter((a) => a.status === "PENDING" || a.status === "ACCEPTED").length;
  const input = JSON.parse(main.inputJson) as DrawInputRow[];
  const taken = new Set(allocs.map((a) => a.userId));
  const pool = input.filter((r) => !r.excluded && !taken.has(r.userId)).length;
  return { main, open: Math.max(0, main.ticketCount - held), pool };
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
      mainInput: JSON.parse(main.inputJson),
      alreadyAllocated: allocs.map((a) => a.userId),
      tickets: open,
      seed,
    });
    if (result.winners.length === 0) throw new Error("No remaining applicants");

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
    for (const userId of result.winners) {
      await tx.allocation.create({ data: { drawId: draw.id, gameId, userId, respondBy } });
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

export async function apply(gameId: string, userId: string, now = new Date()) {
  const game = await db.game.findUniqueOrThrow({ where: { id: gameId } });
  if (now >= game.applicationDeadline) throw new Error("Applications are closed");
  await db.application.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId },
    update: {},
  });
}

export async function withdraw(gameId: string, userId: string, now = new Date()) {
  const game = await db.game.findUniqueOrThrow({ where: { id: gameId } });
  if (now >= game.applicationDeadline) throw new Error("Applications are closed");
  await db.application.deleteMany({ where: { userId, gameId } });
}
