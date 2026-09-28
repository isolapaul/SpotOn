import {describe, expect, it} from "vitest";
import {isValidSpotId, MAX_SPOT_ID_LENGTH} from "../src/lib/ids";

describe("isValidSpotId", () => {
  it("accepts ordinary Firestore ids", () => {
    for (const id of ["e2e-modern-spot", "a", "AbC123xyz", "x".repeat(MAX_SPOT_ID_LENGTH),
      "_x_", "__x", "x__", "a.b", "...", "sp ot"]) {
      expect(isValidSpotId(id)).toBe(true);
    }
    expect(MAX_SPOT_ID_LENGTH).toBe(200);
  });

  it("rejects paths, dot ids, reserved ids, empty and over-long strings", () => {
    for (const id of ["", "a/b", "e2e-modern-spot/x/y", "/a", "a/", ".", "..", "__x__", "____",
      "__.*__", "x".repeat(MAX_SPOT_ID_LENGTH + 1)]) {
      expect(isValidSpotId(id)).toBe(false);
    }
  });

  it("rejects non-strings", () => {
    for (const id of [undefined, null, 1, {}, [], ["a"], true]) {
      expect(isValidSpotId(id)).toBe(false);
    }
  });
});
