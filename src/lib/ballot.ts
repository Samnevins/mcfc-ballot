// Pure draw + weighting logic. No DB, no I/O, no Date.now(). Fully unit-tested.

export type BallotConfig = {
  weightIncrement: number; // added to weight after each unsuccessful application
  reducedMultiplier: number; // applied to weight while reducedGamesLeft > 0
};

export type UserState = {
  weight: number;
  banGamesLeft: number;
  reducedGamesLeft: number;
};

export type WeightReason =
  | "UNSUCCESSFUL"
  | "ACCEPTED"
  | "RETURNED"
  | "EXPIRED"
  | "PENALTY_USED"
  | "GROUP_WON";

export type StateChange = {
  userId: string;
  reason: WeightReason;
  before: UserState;
  after: UserState;
};

export const BASE_WEIGHT = 1.0;
export const BAN_GAMES = 1;
export const REDUCED_GAMES = 2;

// ---------- PRNG ----------

/** Deterministic 32-bit PRNG. Same seed -> same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Weighting ----------

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Weight used in a draw. 0 means excluded (banned). */
export function effectiveWeight(s: UserState, cfg: BallotConfig): number {
  if (s.banGamesLeft > 0) return 0;
  if (s.reducedGamesLeft > 0) return round(s.weight * cfg.reducedMultiplier);
  return s.weight;
}

export function onUnsuccessful(s: UserState, cfg: BallotConfig): UserState {
  return { ...s, weight: round(s.weight + cfg.weightIncrement) };
}

export function onAccepted(s: UserState): UserState {
  return { ...s, weight: BASE_WEIGHT };
}

/** A group entry won: every member resets to base immediately. */
export function onGroupWin(s: UserState): UserState {
  return { ...s, weight: BASE_WEIGHT };
}

/** Returned, or not accepted by the deadline. */
export function onForfeit(s: UserState): UserState {
  return { ...s, banGamesLeft: BAN_GAMES, reducedGamesLeft: REDUCED_GAMES };
}

/** One main draw has passed: consume one penalty game (ban first, then reduced). */
export function consumePenaltyGame(s: UserState): UserState {
  if (s.banGamesLeft > 0) return { ...s, banGamesLeft: s.banGamesLeft - 1 };
  if (s.reducedGamesLeft > 0) return { ...s, reducedGamesLeft: s.reducedGamesLeft - 1 };
  return s;
}

const hasPenalty = (s: UserState) => s.banGamesLeft > 0 || s.reducedGamesLeft > 0;

// ---------- Draw ----------
//
// The draw ranks *entries*. An entry is one supporter, or a group of supporters
// applying together. A group entry:
//   - drops banned members (they get no ticket),
//   - weighs the average of its remaining members' effective weights,
//   - needs one ticket per remaining member, and only wins if that many are left.

export type Entrant = { id: string; weight: number };

/**
 * Weighted random ordering without replacement.
 * Returns every entrant with weight > 0, ranked.
 * Input order does not matter (sorted by id first), so a seed fully reproduces the result.
 */
export function drawOrder(entrants: Entrant[], seed: number): string[] {
  const rand = mulberry32(seed);
  const pool = entrants
    .filter((e) => e.weight > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order: string[] = [];
  while (pool.length) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = rand() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].weight;
      if (r < 0) break;
    }
    order.push(pool[i].id);
    pool.splice(i, 1);
  }
  return order;
}

export type MemberRow = {
  userId: string;
  weight: number;
  effectiveWeight: number;
  excluded: boolean; // banned: dropped from the entry
};

export type DrawEntry = {
  entryId: string; // userId for individuals, "group:<groupId>" for groups
  groupId: string | null;
  groupName?: string; // snapshot for the audit trail
  members: MemberRow[];
  weight: number; // individual's effective weight, or group average of eligible members
  size: number; // tickets needed = eligible members
  excluded: boolean; // no eligible members
};

export type Applicant = { userId: string; state: UserState; groupId?: string | null; groupName?: string };

const groupEntryId = (groupId: string) => `group:${groupId}`;

export function buildEntries(applicants: Applicant[], cfg: BallotConfig): DrawEntry[] {
  const byEntry = new Map<string, { groupId: string | null; groupName?: string; members: MemberRow[] }>();
  for (const a of applicants) {
    const id = a.groupId ? groupEntryId(a.groupId) : a.userId;
    const ew = effectiveWeight(a.state, cfg);
    const row: MemberRow = { userId: a.userId, weight: a.state.weight, effectiveWeight: ew, excluded: ew <= 0 };
    const e = byEntry.get(id) ?? { groupId: a.groupId ?? null, groupName: a.groupName, members: [] };
    e.members.push(row);
    byEntry.set(id, e);
  }
  return [...byEntry].map(([entryId, { groupId, groupName, members }]) => {
    const eligible = members.filter((m) => !m.excluded);
    const weight = eligible.length
      ? round(eligible.reduce((s, m) => s + m.effectiveWeight, 0) / eligible.length)
      : 0;
    return {
      entryId,
      groupId,
      ...(groupName !== undefined && { groupName }),
      members,
      weight,
      size: eligible.length,
      excluded: eligible.length === 0,
    };
  });
}

/**
 * Walk the ranked order handing out tickets; an entry that needs more tickets
 * than remain is skipped. (Equivalent to sampling only among entries that fit,
 * since capacity only shrinks.)
 */
export function allocate(order: string[], entries: DrawEntry[], tickets: number) {
  const byId = new Map(entries.map((e) => [e.entryId, e]));
  let left = Math.max(0, tickets);
  const winners: string[] = [];
  const skipped: string[] = [];
  for (const id of order) {
    const e = byId.get(id)!;
    if (e.size <= left) {
      winners.push(id);
      left -= e.size;
    } else skipped.push(id);
  }
  const winnerUserIds = winners.flatMap((id) => byId.get(id)!.members.filter((m) => !m.excluded).map((m) => m.userId));
  return { winners, skipped, winnerUserIds, ticketsLeft: left };
}

/** Old audit records (pre-groups) stored one row per user; read them as individual entries. */
export function normalizeInput(json: string): DrawEntry[] {
  const rows = JSON.parse(json) as (DrawEntry | MemberRow)[];
  return rows.map((r) =>
    "entryId" in r
      ? r
      : { entryId: r.userId, groupId: null, members: [r], weight: r.effectiveWeight, size: r.excluded ? 0 : 1, excluded: r.excluded },
  );
}

export type MainDrawResult = {
  input: DrawEntry[];
  order: string[];
  winners: string[]; // entry ids
  winnerUserIds: string[];
  changes: StateChange[];
};

/**
 * Main (round 1) draw for a game.
 * - applicants: users who applied (with groupId if applying as a group), with current state
 * - penalised: ALL users with an active penalty (applied or not); each consumes one penalty game
 * Losing entries: each eligible member +increment. Winning groups: members reset to base now.
 * Winning individuals: unchanged until they accept/return.
 */
export function runMainDraw(args: {
  applicants: Applicant[];
  penalised: { userId: string; state: UserState }[];
  tickets: number;
  seed: number;
  cfg: BallotConfig;
}): MainDrawResult {
  const { applicants, penalised, tickets, seed, cfg } = args;
  const input = buildEntries(applicants, cfg);
  const order = drawOrder(input.map((e) => ({ id: e.entryId, weight: e.weight })), seed);
  const { winners, winnerUserIds } = allocate(order, input, tickets);
  const winnerSet = new Set(winners);

  const states = new Map<string, UserState>();
  for (const p of [...penalised, ...applicants]) states.set(p.userId, p.state);

  const changes: StateChange[] = [];
  const apply = (userId: string, reason: WeightReason, fn: (s: UserState) => UserState) => {
    const before = states.get(userId)!;
    const after = fn(before);
    states.set(userId, after);
    changes.push({ userId, reason, before, after });
  };

  for (const e of input) {
    for (const m of e.members.filter((m) => !m.excluded)) {
      if (!winnerSet.has(e.entryId)) apply(m.userId, "UNSUCCESSFUL", (s) => onUnsuccessful(s, cfg));
      else if (e.groupId) apply(m.userId, "GROUP_WON", onGroupWin);
    }
  }
  for (const [userId, s] of states) {
    if (hasPenalty(s)) apply(userId, "PENALTY_USED", consumePenaltyGame);
  }
  return { input, order, winners, winnerUserIds, changes };
}

/**
 * Redraw for returned/expired tickets. Uses the round-1 entries (weight snapshot);
 * an entry is out if any member already holds/held an allocation for this game.
 * groupWinnerUserIds: members of winning groups, to reset to base by the caller.
 */
export function runRedraw(args: {
  mainInput: DrawEntry[];
  alreadyAllocated: string[];
  tickets: number;
  seed: number;
}) {
  const taken = new Set(args.alreadyAllocated);
  const input = args.mainInput.filter((e) => !e.excluded && !e.members.some((m) => taken.has(m.userId)));
  const order = drawOrder(input.map((e) => ({ id: e.entryId, weight: e.weight })), args.seed);
  const { winners, winnerUserIds } = allocate(order, input, args.tickets);
  const groupWinnerUserIds = input
    .filter((e) => e.groupId && winners.includes(e.entryId))
    .flatMap((e) => e.members.filter((m) => !m.excluded).map((m) => m.userId));
  return { input, order, winners, winnerUserIds, groupWinnerUserIds };
}
