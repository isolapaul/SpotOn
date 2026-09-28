import {describe, expect, it} from "vitest";
import {orphanedUploads, planSpotCleanup} from "../src/lib/accountDeletion";

const UID = "gone";
const path = (p: string) => `https://files/${p}`;
const pathOf = (url: string) => (url.startsWith("https://files/") ? url.slice("https://files/".length) : null);
const mine = path(`spot-images/${UID}/a.jpg`);
const other = path("spot-images/other/b.jpg");
const legacyMine = path(`spot-images/${UID}/c.jpg`);
const img = (url: string, addedBy?: string, likedBy: string[] = []) =>
  ({id: url, url, addedBy, likes: likedBy.length, likedBy});

describe("planSpotCleanup", () => {
  it("anonymises an own spot but keeps its photos, and drops own reviews on it", () => {
    const plan = planSpotCleanup({
      createdBy: UID, createdByName: "me", createdByPhoto: "p",
      imageUrls: [mine], spotImages: [img(mine, UID)],
      reviews: [{userId: UID, id: "r1"}, {userId: "x", id: "r2"}],
    }, UID, pathOf);
    expect(plan.anonymize).toBe(true);
    expect(plan.update).toEqual({reviews: [{userId: "x", id: "r2"}]});
    expect(plan.deletePaths).toEqual([]);
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

describe("orphanedUploads", () => {
  it("keeps the files the own spots still show", () => {
    expect(orphanedUploads(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });
});
