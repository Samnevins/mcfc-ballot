import { expect, it } from "vitest";
import { fromLondonInput, toLondonInput } from "./time";

it("converts London wall time in GMT and BST", () => {
  expect(fromLondonInput("2026-01-10T15:00").toISOString()).toBe("2026-01-10T15:00:00.000Z");
  expect(fromLondonInput("2026-07-10T15:00").toISOString()).toBe("2026-07-10T14:00:00.000Z");
  expect(toLondonInput(new Date("2026-07-10T14:00:00Z"))).toBe("2026-07-10T15:00");
});
