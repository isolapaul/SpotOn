import {describe, expect, it} from "vitest";
import {canViewProfile, followId, isUid, nextRateWindow, normalizeQuery} from "../src/lib/follows";
import {buildPublicProfile} from "../src/lib/profiles";

describe("follows helpers", () => {
  it("ids and uids", () => {
    expect(followId("a", "b")).toBe("a_b");
    expect(isUid("abc")).toBe(true);
    for (const bad of ["", "a/b", "..", 1, null, "x".repeat(129)]) expect(isUid(bad)).toBe(false);
  });
  it("private profiles only for followers and the owner", () => {
    expect(canViewProfile({isPrivate: false, isSelf: false, following: false})).toBe(true);
    expect(canViewProfile({isPrivate: true, isSelf: false, following: false})).toBe(false);
    expect(canViewProfile({isPrivate: true, isSelf: false, following: true})).toBe(true);
    expect(canViewProfile({isPrivate: true, isSelf: true, following: false})).toBe(true);
  });
  it("search queries: 2-20 username characters, lowercased, an @ dropped", () => {
    expect(normalizeQuery(" @Pa ")).toBe("pa");
    for (const bad of ["p", "a b", "é", "x".repeat(21), 3]) expect(normalizeQuery(bad)).toBeNull();
  });
  it("rate limit: 20 a minute, then a new window", () => {
    let w = nextRateWindow(undefined, 1000, 60_000, 2)!;
    expect(w).toEqual({windowStart: 1000, count: 1});
    w = nextRateWindow(w, 2000, 60_000, 2)!;
    expect(w.count).toBe(2);
    expect(nextRateWindow(w, 3000, 60_000, 2)).toBeNull();
    expect(nextRateWindow(w, 61_000, 60_000, 2)).toEqual({windowStart: 61_000, count: 1});
  });
  it("public profile mirrors the bio (trimmed, capped) and the privacy flag", () => {
    const p = buildPublicProfile({username: "a", bio: `  ${"x".repeat(200)} `, profilePrivate: true}, {isAdmin: false});
    expect(p.bio).toHaveLength(150);
    expect(p.isPrivate).toBe(true);
    expect(buildPublicProfile({username: "a", bio: "  "}, {isAdmin: false})).toMatchObject({bio: null, isPrivate: false});
  });
});
