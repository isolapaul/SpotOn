import {describe, expect, it} from "vitest";
import {PLACEHOLDER_URL} from "../src/lib/spotImages";
import {
  changedXpUids,
  sameContributors,
  spotContributors,
  spotPhotos,
  spotXp,
  storagePathOf,
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
    // A spotImages entry the spot does not show earns nothing (no hidden photos for XP).
    expect(spotPhotos({createdBy: "o", imageUrls: ["a"], spotImages: [{url: "fake", addedBy: "bob"}]}))
      .toEqual([{url: "a", addedBy: "o"}]);
    expect(spotPhotos({createdBy: "o", imageUrls: ["x"], spotImages: [{url: "x"}]}))
      .toEqual([{url: "x", addedBy: "o"}]);
  });
});

describe("spotPhotos: files, not URL strings", () => {
  const dl = (path: string, query = "alt=media&token=t") =>
    `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(path)}?${query}`;
  it("reads the object path of a download URL", () => {
    expect(storagePathOf(dl("spot-images/u/1.jpg"))).toBe("spot-images/u/1.jpg");
    expect(storagePathOf("http://127.0.0.1:9199/v0/b/b/o/spot-images%2Fu%2F1.jpg?alt=media"))
      .toBe("spot-images/u/1.jpg");
    expect(storagePathOf("a.jpg")).toBeNull();
    expect(storagePathOf("https://x/v0/b/b/o/%E0%A4%A?alt=media")).toBeNull();
  });
  it("counts one file once, whatever query-string variants list it", () => {
    const urls = [dl("spot-images/o/1.jpg"), dl("spot-images/o/1.jpg", "alt=media&token=t&x=1")];
    expect(spotPhotos({createdBy: "o", imageUrls: urls, spotImages: urls.map((url) => ({url, addedBy: "o"}))}))
      .toEqual([{url: urls[0], addedBy: "o"}]);
  });
  it("credits no one for a photo in someone else's folder; legacy flat paths still count", () => {
    const foreign = dl("spot-images/victim/1.jpg");
    const flat = dl("spot-images/old.jpg");
    expect(spotPhotos({createdBy: "o", imageUrls: [foreign, flat], spotImages: [{url: foreign, addedBy: "o"}]}))
      .toEqual([{url: flat, addedBy: "o"}]);
    const own = dl("spot-images/bob/2.jpg");
    expect(spotPhotos({createdBy: "o", imageUrls: [own], spotImages: [{url: own, addedBy: "bob"}]}))
      .toEqual([{url: own, addedBy: "bob"}]);
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
    // The migration: the old spot-count level, never below a stored floor.
    expect(userLevelFields(10, undefined, 20)).toEqual({xp: 10, level: 5, levelFloor: 5});
    expect(userLevelFields(10, 1, 20)).toEqual({xp: 10, level: 5, levelFloor: 5});
    expect(userLevelFields(10, 4, 3)).toEqual({xp: 10, level: 4, levelFloor: 4});
    // The trigger: a stored floor is kept; none (a new account) is 1, whatever it created.
    expect(userLevelFields(10, undefined, null)).toEqual({xp: 10, level: 1, levelFloor: 1});
    expect(userLevelFields(120, 2, null)).toEqual({xp: 120, level: 3, levelFloor: 2});
  });
});
