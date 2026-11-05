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
  | "PENALTY_USED";

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

export type Entrant = { userId: string; weight: number };

/**
 * Weighted random ordering without replacement.
 * Returns every entrant with weight > 0, ranked. Winners = first N.
 * Input order does not matter (sorted by userId first) so a seed fully reproduces the result.
 */
export function drawOrder(entrants: Entrant[], seed: number): string[] {
  const rand = mulberry32(seed);
  const pool = entrants
    .filter((e) => e.weight > 0)
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  const order: string[] = [];
  while (pool.length) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = rand() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].weight;
      if (r < 0) break;
    }
    order.push(pool[i].userId);
    pool.splice(i, 1);
  }
  return order;
}

export type DrawInputRow = {
  userId: string;
  weight: number;
  effectiveWeight: number;
  excluded: boolean;
};

export type MainDrawResult = {
  input: DrawInputRow[];
  order: string[];
  winners: string[];
  changes: StateChange[];
};

/**
 * Main (round 1) draw for a game.
 * - applicants: users who applied, with current state
 * - penalised: ALL users with an active penalty (applied or not); each consumes one penalty game
 * Applicants who lose get +increment. Winners unchanged until they accept/return.
 */
export function runMainDraw(args: {
  applicants: { userId: string; state: UserState }[];
  penalised: { userId: string; state: UserState }[];
  tickets: number;
  seed: number;
  cfg: BallotConfig;
}): MainDrawResult {
  const { applicants, penalised, tickets, seed, cfg } = args;

  const input: DrawInputRow[] = applicants.map(({ userId, state }) => {
    const ew = effectiveWeight(state, cfg);
    return { userId, weight: state.weight, effectiveWeight: ew, excluded: ew <= 0 };
  });
  const order = drawOrder(
    input.map((r) => ({ userId: r.userId, weight: r.effectiveWeight })),
    seed,
  );
  const winners = order.slice(0, Math.max(0, tickets));
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

  for (const row of input) {
    if (!row.excluded && !winnerSet.has(row.userId)) {
      apply(row.userId, "UNSUCCESSFUL", (s) => onUnsuccessful(s, cfg));
    }
  }
  for (const [userId, s] of states) {
    if (hasPenalty(s)) apply(userId, "PENALTY_USED", consumePenaltyGame);
  }
  return { input, order, winners, changes };
}

/**
 * Redraw for returned/expired tickets. Uses the round-1 effective weights
 * (snapshot) for applicants who were eligible and have not yet been allocated.
 */
export function runRedraw(args: {
  mainInput: DrawInputRow[];
  alreadyAllocated: string[];
  tickets: number;
  seed: number;
}): { input: DrawInputRow[]; order: string[]; winners: string[] } {
  const taken = new Set(args.alreadyAllocated);
  const input = args.mainInput.filter((r) => !r.excluded && !taken.has(r.userId));
  const order = drawOrder(
    input.map((r) => ({ userId: r.userId, weight: r.effectiveWeight })),
    args.seed,
  );
  return { input, order, winners: order.slice(0, Math.max(0, args.tickets)) };
}
