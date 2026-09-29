import {describe, expect, it} from "vitest";
import {
  DELETED_OWNER,
  orphanedUploads,
  planSpotCleanup,
  relocatedPath,
  rewriteDownloadUrl,
} from "../src/lib/accountDeletion";

const UID = "gone";
const path = (p: string) => `https://files/${p}`;
const pathOf = (url: string) => (url.startsWith("https://files/") ? url.slice("https://files/".length) : null);
const mine = path(`spot-images/${UID}/a.jpg`);
const other = path("spot-images/other/b.jpg");
const legacyMine = path(`spot-images/${UID}/c.jpg`);
const img = (url: string, addedBy?: string, likedBy: string[] = []) =>
  ({id: url, url, addedBy, likes: likedBy.length, likedBy});

describe("planSpotCleanup", () => {
  it("hands an own spot to DELETED_OWNER, relocates its photos and drops own reviews on it", () => {
    const moved = path(`spot-images/${DELETED_OWNER}/s1_a.jpg`);
    const plan = planSpotCleanup({
      createdBy: UID, createdByName: "me", createdByPhoto: "p",
      imageUrls: [mine], spotImages: [img(mine, UID, ["x"])], imageUrl: mine,
      reviews: [{userId: UID, id: "r1"}, {userId: "x", id: "r2"}],
    }, UID, pathOf, (url) => (url === mine ? moved : null));
    expect(plan.anonymize).toBe(true);
    expect(plan.update).toEqual({
      reviews: [{userId: "x", id: "r2"}],
      createdBy: DELETED_OWNER,
      imageUrls: [moved],
      spotImages: [{...img(mine, UID, ["x"]), url: moved, addedBy: DELETED_OWNER}],
      imageUrl: moved,
    });
    expect(plan.deletePaths).toEqual([]);
  });

  it("an own spot whose photos could not be moved still changes owner", () => {
    const plan = planSpotCleanup({createdBy: UID, imageUrls: [mine]}, UID, pathOf, () => null);
    expect(plan.update).toEqual({createdBy: DELETED_OWNER});
  });

  it("removes the user's photos from someone else's spot and fixes the primary index", () => {
    const plan = planSpotCleanup({
      createdBy: "owner",
      imageUrls: [mine, other],
      spotImages: [img(mine, UID), img(other, "owner")],
      primaryImageIndex: 1,
    }, UID, pathOf);
    expect(plan.anonymize).toBe(false);
    expect(plan.update).toEqual({
      imageUrls: [other],
      primaryImageIndex: 0,
      spotImages: [img(other, "owner")],
    });
    expect(plan.deletePaths).toEqual([`spot-images/${UID}/a.jpg`]);
  });

  it("finds legacy photos without addedBy by their upload path; a spot left empty gets the placeholder", () => {
    const plan = planSpotCleanup({createdBy: "owner", imageUrls: [legacyMine]}, UID, pathOf);
    expect(plan.update).toEqual({imageUrls: ["/placeholder-spot.jpg"], primaryImageIndex: 0});
    expect(plan.deletePaths).toEqual([`spot-images/${UID}/c.jpg`]);
  });

  it("removes likes and highlights by the user, and nothing else", () => {
    const plan = planSpotCleanup({
      createdBy: "owner",
      imageUrls: [other],
      spotImages: [img(other, "owner", [UID, "x"])],
      highlighted: [{userId: UID}, {userId: "x"}],
      reviews: [{userId: "x"}],
    }, UID, pathOf);
    expect(plan.update).toEqual({
      spotImages: [{...img(other, "owner"), likedBy: ["x"], likes: 1}],
      highlighted: [{userId: "x"}],
      isHighlighted: true,
    });
    expect(plan.deletePaths).toEqual([]);
  });

  it("leaves unrelated spots untouched", () => {
    const plan = planSpotCleanup({
      createdBy: "owner", imageUrls: [other], spotImages: [img(other, "owner", ["x"])], reviews: [{userId: "x"}],
    }, UID, pathOf);
    expect(plan).toEqual({update: null, anonymize: false, deletePaths: []});
  });

  it("never deletes files outside spot-images/, nor the placeholder", () => {
    const foreign = path("profile-pictures/other/z.jpg");
    const plan = planSpotCleanup({
      createdBy: "owner",
      imageUrls: ["/placeholder-spot.jpg", foreign],
      spotImages: [img("/placeholder-spot.jpg", UID), img(foreign, UID)],
    }, UID, pathOf);
    expect(plan.update?.imageUrls).toEqual(["/placeholder-spot.jpg"]);
    expect(plan.deletePaths).toEqual([]);
  });
});

describe("planSpotCleanup (confused deputy)", () => {
  it("unlinks a photo with a spoofed addedBy but never deletes someone else's file", () => {
    const victim = path("spot-images/victim/v.jpg");
    const legacyFlat = path("spot-images/flat.jpg");
    const plan = planSpotCleanup({
      createdBy: "attacker",
      imageUrls: [victim, legacyFlat],
      spotImages: [img(victim, UID), img(legacyFlat, UID)],
    }, UID, pathOf);
    expect(plan.update?.imageUrls).toEqual(["/placeholder-spot.jpg"]);
    expect(plan.deletePaths).toEqual([]);
  });
});

describe("orphanedUploads", () => {
  it("keeps the files the own spots still show", () => {
    expect(orphanedUploads(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });
});

describe("relocation helpers", () => {
  it("moves a photo under the deleted-user folder, prefixed by the spot id", () => {
    expect(relocatedPath("s1", `spot-images/${UID}/a.jpg`)).toBe(`spot-images/${DELETED_OWNER}/s1_a.jpg`);
  });

  it("rewrites only the encoded object name of a download URL", () => {
    const url = "https://firebasestorage.googleapis.com/v0/b/b/o/spot-images%2Fgone%2Fa.jpg?alt=media&token=t";
    expect(rewriteDownloadUrl(url, "spot-images/gone/a.jpg", "spot-images/deleted-user/s1_a.jpg"))
      .toBe("https://firebasestorage.googleapis.com/v0/b/b/o/spot-images%2Fdeleted-user%2Fs1_a.jpg?alt=media&token=t");
    expect(rewriteDownloadUrl(url, "spot-images/other/a.jpg", "x")).toBeNull();
  });
});
