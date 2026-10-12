import {describe, expect, it} from "vitest";
import {planDigests} from "../src/lib/digest";
import {translate} from "../src/lib/i18n";

describe("weekly digest", () => {
  it("adds up the followed people's new spots per follower, busiest first", () => {
    const followers = new Map([["anna", ["x", "y"]], ["bela", ["x"]], ["cili", []]]);
    const digests = planDigests(["anna", "bela", "bela", "cili"], followers);
    expect(digests).toEqual([
      {follower: "x", count: 3, owners: ["bela", "anna"]},
      {follower: "y", count: 1, owners: ["anna"]},
    ]);
  });
  it("skips blocked pairs either way", () => {
    const followers = new Map([["anna", ["x", "y"]]]);
    const digests = planDigests(["anna"], followers, (a, b) => a === "anna" && b === "y");
    expect(digests.map((d) => d.follower)).toEqual(["x"]);
  });
  it("reads naturally", () => {
    expect(translate("weeklyDigestBody", "en", ["anna", 0, 1])).toBe("anna shared 1 new spot this week");
    expect(translate("weeklyDigestBody", "hu", ["anna", 2, 5])).toBe("anna és még 2 ember 5 új helyet osztott meg a héten");
  });
});
