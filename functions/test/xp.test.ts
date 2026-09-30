import {describe, expect, it} from "vitest";
import {PLACEHOLDER_URL} from "../src/lib/spotImages";
import {
  changedXpUids,
  sameContributors,
  spotContributors,
  spotPhotos,
  spotXp,
  userLevelFields,
  xpOf,
} from "../src/lib/xp";
import {effectiveLevel, levelForSpotCount, levelForXp} from "../src/lib/levels";

const review = (userId: string) => ({id: `${userId}_1`, userId, rating: 5, comment: ""});
const spot = (over: Record<string, unknown> = {}) => ({
  createdBy: "owner",
  status: "approved",
  imageUrls: ["a.jpg", "b.jpg"],
  spotImages: [{url: "a.jpg", addedBy: "owner"}, {url: "b.jpg", addedBy: "bob"}],
  reviews: [],
  ...over,
});

describe("spotPhotos", () => {
  it("each real photo once; legacy photos belong to the creator; no placeholder", () => {
    expect(spotPhotos({createdBy: "o", imageUrls: ["x", "x", PLACEHOLDER_URL]}))
      .toEqual([{url: "x", addedBy: "o"}]);
    expect(spotPhotos(spot())).toEqual([{url: "a.jpg", addedBy: "owner"}, {url: "b.jpg", addedBy: "bob"}]);
    expect(spotPhotos({createdBy: "o", imageUrls: ["x"], spotImages: [{url: "x"}]}))
      .toEqual([{url: "x", addedBy: "o"}]);
  });
});

describe("spotXp", () => {
  it("creator 10 + own photos 3 each; others 3 per photo and 2 per reviewed spot", () => {
    const xp = spotXp(spot({reviews: [review("bob"), review("bob"), review("carol"), review("owner")]}));
    expect(Object.fromEntries(xp)).toEqual({owner: 13, bob: 5, carol: 2});
  });
  it("nothing for pending, rejected, missing spots and the deleted-user placeholder", () => {
    expect(spotXp(spot({status: "pending"})).size).toBe(0);
    expect(spotXp(spot({status: "rejected"})).size).toBe(0);
    expect(spotXp(undefined).size).toBe(0);
    expect(spotXp(spot({createdBy: "deleted-user", spotImages: []})).has("deleted-user")).toBe(false);
  });
});

describe("contributors and changes", () => {
  it("lists reviewers and photo adders other than the creator, sorted", () => {
    expect(spotContributors(spot({reviews: [review("zed"), review("owner")]}))).toEqual(["bob", "zed"]);
    expect(sameContributors(["bob"], ["bob"])).toBe(true);
    expect(sameContributors(undefined, [])).toBe(false);
  });
  it("finds whose XP changed", () => {
    expect(changedXpUids(spot({status: "pending"}), spot()).sort()).toEqual(["bob", "owner"]);
    expect(changedXpUids(spot(), spot({reviews: [review("carol")]}))).toEqual(["carol"]);
    expect(changedXpUids(spot(), {...spot(), name: "renamed"})).toEqual([]);
    expect(changedXpUids(spot(), undefined).sort()).toEqual(["bob", "owner"]);
  });
  it("sums a user's XP over spots", () => {
    expect(xpOf("bob", [spot(), spot({reviews: [review("bob")]})])).toBe(8);
  });
});

describe("levels", () => {
  it("XP thresholds 30/100/150/200", () => {
    expect([0, 29, 30, 99, 100, 149, 150, 199, 200, 999].map(levelForXp))
      .toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it("never below the floor", () => {
    expect(effectiveLevel(0, 4)).toBe(4);
    expect(effectiveLevel(200, 2)).toBe(5);
  });
  it("freezes the floor from the old spot count once, then keeps it", () => {
    expect(levelForSpotCount(20)).toBe(5);
    expect(userLevelFields(10, undefined, 20)).toEqual({xp: 10, level: 5, levelFloor: 5});
    expect(userLevelFields(10, 1, 20)).toEqual({xp: 10, level: 1, levelFloor: 1});
    expect(userLevelFields(120, 2, 0)).toEqual({xp: 120, level: 3, levelFloor: 2});
  });
});
