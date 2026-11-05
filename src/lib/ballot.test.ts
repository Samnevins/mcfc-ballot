import { describe, expect, it } from "vitest";
import {
  allocate,
  buildEntries,
  normalizeInput,
  consumePenaltyGame,
  drawOrder,
  effectiveWeight,
  mulberry32,
  onAccepted,
  onForfeit,
  onUnsuccessful,
  runMainDraw,
  runRedraw,
  type UserState,
} from "./ballot";

const cfg = { weightIncrement: 0.5, reducedMultiplier: 0.5 };
const fresh: UserState = { weight: 1, banGamesLeft: 0, reducedGamesLeft: 0 };
const users = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(2, "0")}`, state: fresh }));

describe("prng", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    sa.forEach((x) => expect(x >= 0 && x < 1).toBe(true));
  });
});

describe("weighting", () => {
  it("unsuccessful adds increment", () => {
    expect(onUnsuccessful(fresh, cfg).weight).toBe(1.5);
    expect(onUnsuccessful(onUnsuccessful(fresh, cfg), cfg).weight).toBe(2);
  });
  it("accepted resets to 1", () => {
    expect(onAccepted({ ...fresh, weight: 3.5 }).weight).toBe(1);
  });
  it("forfeit: ban 1 game then reduced 2 games, weight kept", () => {
    let s = onForfeit({ ...fresh, weight: 2 });
    expect(s).toEqual({ weight: 2, banGamesLeft: 1, reducedGamesLeft: 2 });
    expect(effectiveWeight(s, cfg)).toBe(0);
    s = consumePenaltyGame(s);
    expect(effectiveWeight(s, cfg)).toBe(1);
    s = consumePenaltyGame(s);
    expect(effectiveWeight(s, cfg)).toBe(1);
    s = consumePenaltyGame(s);
    expect(s).toEqual({ weight: 2, banGamesLeft: 0, reducedGamesLeft: 0 });
    expect(effectiveWeight(s, cfg)).toBe(2);
    expect(consumePenaltyGame(s)).toEqual(s);
  });
});

describe("drawOrder", () => {
  it("ranks all, no duplicates, excludes zero weight", () => {
    const o = drawOrder(
      [{ id: "a", weight: 1 }, { id: "b", weight: 0 }, { id: "c", weight: 2 }],
      7,
    );
    expect(o.sort()).toEqual(["a", "c"]);
  });
  it("is reproducible and independent of input order", () => {
    const e = users(10).map((u, i) => ({ id: u.userId, weight: 1 + i * 0.3 }));
    expect(drawOrder(e, 99)).toEqual(drawOrder([...e].reverse(), 99));
  });
  it("respects weights statistically", () => {
    let heavyFirst = 0;
    const trials = 4000;
    for (let s = 0; s < trials; s++) {
      const o = drawOrder([{ id: "light", weight: 1 }, { id: "heavy", weight: 3 }], s);
      if (o[0] === "heavy") heavyFirst++;
    }
    expect(heavyFirst / trials).toBeGreaterThan(0.72);
    expect(heavyFirst / trials).toBeLessThan(0.78);
  });
  it("handles empty pool", () => {
    expect(drawOrder([], 1)).toEqual([]);
  });
});

describe("runMainDraw", () => {
  it("picks N winners, losers get +increment, winners unchanged", () => {
    const r = runMainDraw({ applicants: users(10), penalised: [], tickets: 3, seed: 1, cfg });
    expect(r.winners).toHaveLength(3);
    expect(new Set(r.winners).size).toBe(3);
    expect(r.order).toHaveLength(10);
    const unsuccessful = r.changes.filter((c) => c.reason === "UNSUCCESSFUL");
    expect(unsuccessful).toHaveLength(7);
    unsuccessful.forEach((c) => expect(r.winners).not.toContain(c.userId));
    unsuccessful.forEach((c) => expect(c.after.weight).toBe(1.5));
  });
  it("more tickets than applicants: everyone wins", () => {
    const r = runMainDraw({ applicants: users(3), penalised: [], tickets: 10, seed: 1, cfg });
    expect(r.winners).toHaveLength(3);
    expect(r.changes).toHaveLength(0);
  });
  it("banned applicant excluded, no increment, ban consumed", () => {
    const banned = { userId: "zz", state: { weight: 5, banGamesLeft: 1, reducedGamesLeft: 2 } };
    const r = runMainDraw({ applicants: [...users(2), banned], penalised: [banned], tickets: 5, seed: 1, cfg });
    expect(r.winners).not.toContain("zz");
    expect(r.input.find((i) => i.entryId === "zz")).toMatchObject({ excluded: true, weight: 0, size: 0 });
    const zz = r.changes.filter((c) => c.userId === "zz");
    expect(zz.map((c) => c.reason)).toEqual(["PENALTY_USED"]);
    expect(zz[0].after).toEqual({ weight: 5, banGamesLeft: 0, reducedGamesLeft: 2 });
  });
  it("reduced applicant drawn at multiplied weight; loser gets increment then penalty used", () => {
    const red = { userId: "zz", state: { weight: 2, banGamesLeft: 0, reducedGamesLeft: 1 } };
    const r = runMainDraw({ applicants: [...users(3), red], penalised: [red], tickets: 0, seed: 1, cfg });
    expect(r.input.find((i) => i.entryId === "zz")!.weight).toBe(1);
    const zz = r.changes.filter((c) => c.userId === "zz");
    expect(zz.map((c) => c.reason)).toEqual(["UNSUCCESSFUL", "PENALTY_USED"]);
    expect(zz[1].after).toEqual({ weight: 2.5, banGamesLeft: 0, reducedGamesLeft: 0 });
  });
  it("penalised non-applicants still consume a penalty game", () => {
    const p = { userId: "p", state: { weight: 1, banGamesLeft: 1, reducedGamesLeft: 2 } };
    const r = runMainDraw({ applicants: users(2), penalised: [p], tickets: 1, seed: 1, cfg });
    expect(r.changes.find((c) => c.userId === "p")!.after.banGamesLeft).toBe(0);
  });
  it("same seed reproduces result", () => {
    const a = runMainDraw({ applicants: users(10), penalised: [], tickets: 4, seed: 123, cfg });
    const b = runMainDraw({ applicants: users(10), penalised: [], tickets: 4, seed: 123, cfg });
    expect(a.winners).toEqual(b.winners);
  });
});

describe("runRedraw", () => {
  it("draws only from eligible, unallocated applicants", () => {
    const main = runMainDraw({
      applicants: [...users(5), { userId: "ban", state: { ...fresh, banGamesLeft: 1 } }],
      penalised: [],
      tickets: 2,
      seed: 5,
      cfg,
    });
    const r = runRedraw({ mainInput: main.input, alreadyAllocated: main.winners, tickets: 2, seed: 6 });
    expect(r.winners).toHaveLength(2);
    r.winners.forEach((w) => {
      expect(main.winners).not.toContain(w);
      expect(w).not.toBe("ban");
    });
    expect(r.input).toHaveLength(3);
  });
  it("returns no winners when pool exhausted", () => {
    const main = runMainDraw({ applicants: users(2), penalised: [], tickets: 2, seed: 5, cfg });
    expect(runRedraw({ mainInput: main.input, alreadyAllocated: main.winners, tickets: 1, seed: 1 }).winners).toEqual([]);
  });
});

describe("groups", () => {
  const st = (weight: number, ban = 0, reduced = 0): UserState => ({ weight, banGamesLeft: ban, reducedGamesLeft: reduced });

  it("group weight is the average of members' effective weights; banned members dropped", () => {
    const [e] = buildEntries(
      [
        { userId: "a", state: st(1), groupId: "G" },
        { userId: "b", state: st(2, 0, 1), groupId: "G" }, // reduced: 2 * 0.5 = 1
        { userId: "c", state: st(4), groupId: "G" },
        { userId: "d", state: st(9, 1), groupId: "G" }, // banned: dropped
      ],
      cfg,
    );
    expect(e).toMatchObject({ entryId: "group:G", groupId: "G", size: 3, excluded: false });
    expect(e.weight).toBe(2); // (1 + 1 + 4) / 3
    expect(e.members.find((m) => m.userId === "d")!.excluded).toBe(true);
  });

  it("group with every member banned is excluded", () => {
    const [e] = buildEntries([{ userId: "a", state: st(1, 1), groupId: "G" }], cfg);
    expect(e).toMatchObject({ excluded: true, size: 0, weight: 0 });
  });

  it("allocate skips entries that need more tickets than remain", () => {
    const entries = buildEntries(
      [
        { userId: "g1", state: st(1), groupId: "G" },
        { userId: "g2", state: st(1), groupId: "G" },
        { userId: "g3", state: st(1), groupId: "G" },
        { userId: "x", state: st(1) },
        { userId: "y", state: st(1) },
      ],
      cfg,
    );
    const r = allocate(["x", "group:G", "y"], entries, 3);
    expect(r.winners).toEqual(["x", "y"]);
    expect(r.skipped).toEqual(["group:G"]);
    expect(r.winnerUserIds).toEqual(["x", "y"]);
    const r2 = allocate(["group:G", "x", "y"], entries, 3);
    expect(r2.winners).toEqual(["group:G"]);
    expect(r2.winnerUserIds).toEqual(["g1", "g2", "g3"]);
  });

  it("group too big for the tickets never wins", () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = runMainDraw({
        applicants: [
          { userId: "g1", state: st(5), groupId: "G" },
          { userId: "g2", state: st(5), groupId: "G" },
          { userId: "g3", state: st(5), groupId: "G" },
          ...users(3),
        ],
        penalised: [],
        tickets: 2,
        seed,
        cfg,
      });
      expect(r.winners).not.toContain("group:G");
      expect(r.winnerUserIds).toHaveLength(2);
    }
  });

  it("winning group: all eligible members reset to base; banned member gets nothing", () => {
    const r = runMainDraw({
      applicants: [
        { userId: "g1", state: st(3), groupId: "G" },
        { userId: "g2", state: st(2.5), groupId: "G" },
        { userId: "g3", state: st(2, 1, 2), groupId: "G" }, // banned
      ],
      penalised: [{ userId: "g3", state: st(2, 1, 2) }],
      tickets: 5,
      seed: 1,
      cfg,
    });
    expect(r.winners).toEqual(["group:G"]);
    expect(r.winnerUserIds.sort()).toEqual(["g1", "g2"]);
    const by = (u: string) => r.changes.filter((c) => c.userId === u);
    expect(by("g1").map((c) => [c.reason, c.after.weight])).toEqual([["GROUP_WON", 1]]);
    expect(by("g2").map((c) => [c.reason, c.after.weight])).toEqual([["GROUP_WON", 1]]);
    expect(by("g3").map((c) => c.reason)).toEqual(["PENALTY_USED"]);
  });

  it("losing group: every eligible member gets +increment", () => {
    const r = runMainDraw({
      applicants: [{ userId: "g1", state: st(1), groupId: "G" }, { userId: "g2", state: st(2), groupId: "G" }],
      penalised: [],
      tickets: 0,
      seed: 1,
      cfg,
    });
    expect(r.changes.map((c) => [c.userId, c.reason, c.after.weight])).toEqual([
      ["g1", "UNSUCCESSFUL", 1.5],
      ["g2", "UNSUCCESSFUL", 2.5],
    ]);
  });

  it("redraw: group fits only if enough tickets; any allocated member removes the entry", () => {
    const main = buildEntries(
      [
        { userId: "g1", state: st(1), groupId: "G" },
        { userId: "g2", state: st(1), groupId: "G" },
        { userId: "h1", state: st(1), groupId: "H" },
        { userId: "h2", state: st(1), groupId: "H" },
        { userId: "x", state: st(1) },
      ],
      cfg,
    );
    const one = runRedraw({ mainInput: main, alreadyAllocated: ["h1"], tickets: 1, seed: 3 });
    expect(one.input.map((e) => e.entryId).sort()).toEqual(["group:G", "x"]);
    expect(one.winners).toEqual(["x"]);
    const two = runRedraw({ mainInput: main, alreadyAllocated: ["x", "h1"], tickets: 2, seed: 3 });
    expect(two.winners).toEqual(["group:G"]);
    expect(two.groupWinnerUserIds).toEqual(["g1", "g2"]);
  });

  it("reads pre-group audit records as individual entries", () => {
    const old = JSON.stringify([{ userId: "a", weight: 1.5, effectiveWeight: 1.5, excluded: false }]);
    expect(normalizeInput(old)).toEqual([
      { entryId: "a", groupId: null, members: [{ userId: "a", weight: 1.5, effectiveWeight: 1.5, excluded: false }], weight: 1.5, size: 1, excluded: false },
    ]);
  });
});
