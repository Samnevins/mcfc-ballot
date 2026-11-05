import { expect, it } from "vitest";
import { competitionLabel, fixtureTitle } from "./fixture";

it("orders the fixture by home/away", () => {
  expect(fixtureTitle({ opponent: "Arsenal", homeAway: "HOME" })).toBe("Manchester City v Arsenal");
  expect(fixtureTitle({ opponent: "Arsenal", homeAway: "AWAY" })).toBe("Arsenal v Manchester City");
  expect(competitionLabel("CARABAO_CUP")).toBe("Carabao Cup");
});
