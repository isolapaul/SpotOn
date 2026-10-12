import {describe, expect, it} from "vitest";
import {badgeXp, badgesOf, LAUNCH_END_MS, missingSteps, seasonOpen} from "../src/lib/challenge";

describe("challenge", () => {
  it("is open until the configured or the built-in end", () => {
    expect(seasonOpen(LAUNCH_END_MS, undefined)).toBe(true);
    expect(seasonOpen(LAUNCH_END_MS + 1, undefined)).toBe(false);
    expect(seasonOpen(10, 5)).toBe(false);
    expect(seasonOpen(10, {toMillis: () => 20})).toBe(true);
  });
  it("lists the missing steps", () => {
    expect(missingSteps({spot: true, review: false, follow: true, visit: false, favorite: true}))
      .toEqual(["review", "visit"]);
  });
  it("counts the founder badge's XP", () => {
    expect(badgeXp(["founder"])).toBe(50);
    expect(badgeXp(["x"])).toBe(0);
    expect(badgesOf(["founder", 3, "fake"])).toEqual(["founder"]);
  });
});
