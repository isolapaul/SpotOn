import {describe, expect, it} from "vitest";
import {
  BUILT_IN_CATEGORIES,
  MAX_REASON_LENGTH,
  planEditApply,
  readProposal,
  validReason,
} from "../src/lib/moderation";
import {PLACEHOLDER_URL, photosAddDirectly, uniqueIdFactory} from "../src/lib/spotImages";
import {ownedSpotImagePaths} from "../src/lib/storageFiles";

const known = (id: string) => BUILT_IN_CATEGORIES.includes(id);

describe("validReason", () => {
  it("trims and accepts 1-500 characters", () => {
    expect(validReason("  spam  ")).toBe("spam");
    expect(validReason("x".repeat(MAX_REASON_LENGTH))).toHaveLength(MAX_REASON_LENGTH);
  });
  it("refuses empty, too long and non-strings", () => {
    for (const x of ["", "   ", "x".repeat(MAX_REASON_LENGTH + 1), null, 5, undefined]) {
      expect(validReason(x)).toBeNull();
    }
  });
});

describe("readProposal", () => {
  it("keeps only valid fields", () => {
    expect(readProposal({
      name: "  New  ", description: " d ", category: "park", location: {lat: 47, lng: 19},
      removeImageUrls: ["a", 3], primaryImageUrl: "b", other: "x",
    }, known)).toEqual({
      name: "New", description: "d", category: "park", location: {lat: 47, lng: 19},
      removeImageUrls: ["a"], primaryImageUrl: "b",
    });
  });
  it("drops invalid values", () => {
    expect(readProposal({
      name: "", description: "x".repeat(2001), category: "nope", location: {lat: 99, lng: 0},
    }, known)).toEqual({});
    expect(readProposal(null, known)).toEqual({});
  });
});

describe("planEditApply", () => {
  const spot = {
    imageUrls: ["a", "b", "c"],
    spotImages: [{url: "a", id: "1"}, {url: "b", id: "2"}, {url: "c", id: "3"}],
    primaryImageIndex: 1,
  };

  it("applies text, category and location fields", () => {
    expect(planEditApply(spot, {name: "N", description: "D", category: "park", location: {lat: 1, lng: 2}}))
      .toEqual({update: {name: "N", description: "D", category: "park", location: {lat: 1, lng: 2}}, removedUrls: []});
  });

  it("removes photos and keeps the primary on the same photo", () => {
    const plan = planEditApply(spot, {removeImageUrls: ["a"]});
    expect(plan.removedUrls).toEqual(["a"]);
    expect(plan.update).toEqual({
      imageUrls: ["b", "c"],
      spotImages: [{url: "b", id: "2"}, {url: "c", id: "3"}],
      primaryImageIndex: 0,
    });
  });

  it("removing the primary photo falls back to the first; removing all leaves the placeholder", () => {
    expect(planEditApply(spot, {removeImageUrls: ["b"]}).update.primaryImageIndex).toBe(0);
    const all = planEditApply(spot, {removeImageUrls: ["a", "b", "c"]});
    expect(all.update.imageUrls).toEqual([PLACEHOLDER_URL]);
    expect(all.update.primaryImageIndex).toBe(0);
  });

  it("sets the primary photo by URL after the removals, ignoring an unknown URL", () => {
    expect(planEditApply(spot, {removeImageUrls: ["a"], primaryImageUrl: "c"}).update.primaryImageIndex).toBe(1);
    expect(planEditApply(spot, {primaryImageUrl: "c"}).update).toEqual({primaryImageIndex: 2});
    expect(planEditApply(spot, {primaryImageUrl: "zzz"}).update).toEqual({});
  });

  it("ignores unknown and placeholder removals", () => {
    expect(planEditApply(spot, {removeImageUrls: ["zzz", PLACEHOLDER_URL]})).toEqual({update: {}, removedUrls: []});
  });
});

describe("photosAddDirectly", () => {
  it("admins always; owners only while the spot is not approved; others never", () => {
    expect(photosAddDirectly({status: "approved", createdBy: "o"}, "x", true)).toBe(true);
    expect(photosAddDirectly({status: "pending", createdBy: "o"}, "o", false)).toBe(true);
    expect(photosAddDirectly({status: "rejected", createdBy: "o"}, "o", false)).toBe(true);
    expect(photosAddDirectly({status: "approved", createdBy: "o"}, "o", false)).toBe(false);
    expect(photosAddDirectly({status: "approved", createdBy: "o"}, "x", false)).toBe(false);
  });
});

describe("uniqueIdFactory", () => {
  it("never repeats an id that is used or already given out", () => {
    const used = new Set(["1_0"]);
    const next = uniqueIdFactory(used, () => 1);
    const ids = Array.from({length: 50}, next);
    expect(new Set(ids).size).toBe(50);
    expect(ids).not.toContain("1_0");
  });
});

describe("ownedSpotImagePaths", () => {
  const ctx = {bucket: "b"};
  const url = (path: string) =>
    `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(path)}?alt=media&token=t`;
  const file = (path: string, ...owners: string[]) => ({url: url(path), owners});
  it("keeps files in an owner's folder, once each", () => {
    expect(ownedSpotImagePaths([file("spot-images/u/1.jpg", "u"), file("spot-images/u/1.jpg", "u")], ctx))
      .toEqual([{url: url("spot-images/u/1.jpg"), path: "spot-images/u/1.jpg"}]);
  });
  it("keeps files in the deleted-user folder", () => {
    expect(ownedSpotImagePaths([file("spot-images/deleted-user/s_1.jpg", "u")], ctx).map((f) => f.path))
      .toEqual(["spot-images/deleted-user/s_1.jpg"]);
  });
  it("never deletes someone else's file listed on a spot", () => {
    expect(ownedSpotImagePaths([
      file("spot-images/victim/1.jpg", "attacker"),
      file("spot-images/victimx/1.jpg", "victim"),
      file("spot-images/victim/1.jpg", "", ""),
      file("spot-images/1.jpg", "u"),
    ], ctx)).toEqual([]);
  });
  it("drops the placeholder, other folders, other buckets and non-URLs", () => {
    const owners = ["u"];
    expect(ownedSpotImagePaths([
      PLACEHOLDER_URL, url("profile-pictures/u/p.jpg"), "https://example.com/x.jpg", "not a url",
      "https://firebasestorage.googleapis.com/v0/b/other/o/spot-images%2Fu%2F1.jpg?alt=media&token=t",
    ].map((u) => ({url: u, owners})), ctx)).toEqual([]);
  });
});
