import {describe, expect, it} from "vitest";
import {
  currentImages,
  MAX_SPOT_IMAGES,
  materializeSpotImages,
  PLACEHOLDER_URL,
  planAddImages,
  SpotImage,
  toggleLikeInImages,
} from "../src/lib/spotImages";

const NOW = "now";
const LATER = "later";

function counter(): () => string {
  let n = 0;
  return () => `new_${n++}`;
}

function urls(n: number, prefix = "u"): string[] {
  return Array.from({length: n}, (_, i) => `${prefix}${i}`);
}

describe("constants", () => {
  it("placeholder and limit are unchanged", () => {
    expect(PLACEHOLDER_URL).toBe("/placeholder-spot.jpg");
    expect(MAX_SPOT_IMAGES).toBe(20);
  });
});

describe("materializeSpotImages", () => {
  it("uses ${spotId}_${index} ids, includes the placeholder, has no addedBy", () => {
    const images = materializeSpotImages("s1", ["a", PLACEHOLDER_URL, "b"], NOW);
    expect(images).toEqual([
      {id: "s1_0", url: "a", addedAt: NOW, likes: 0, likedBy: []},
      {id: "s1_1", url: PLACEHOLDER_URL, addedAt: NOW, likes: 0, likedBy: []},
      {id: "s1_2", url: "b", addedAt: NOW, likes: 0, likedBy: []},
    ]);
    for (const image of images) {
      expect(Object.keys(image)).toEqual(["id", "url", "addedAt", "likes", "likedBy"]);
      expect("addedBy" in image).toBe(false);
    }
  });

  it("empty list → empty", () => {
    expect(materializeSpotImages("s1", [], NOW)).toEqual([]);
  });
});

describe("currentImages", () => {
  it("returns spotImages when non-empty", () => {
    const spotImages = [{id: "x", url: "a", addedAt: LATER, likes: 2, likedBy: ["p", "q"]}];
    expect(currentImages({imageUrls: ["a", "b"], spotImages}, "s1", NOW)).toBe(spotImages);
  });

  it("materialises imageUrls when spotImages is missing or empty", () => {
    const expected = materializeSpotImages("s1", ["a"], NOW);
    expect(currentImages({imageUrls: ["a"]}, "s1", NOW)).toEqual(expected);
    expect(currentImages({imageUrls: ["a"], spotImages: []}, "s1", NOW)).toEqual(expected);
  });

  it("a spot with only the singular legacy imageUrl has no images", () => {
    expect(currentImages({imageUrl: "a"} as never, "s1", NOW)).toEqual([]);
  });
});

describe("planAddImages", () => {
  it("placeholder-only spot → placeholder dropped, primary 0", () => {
    const plan = planAddImages(
      {imageUrls: [PLACEHOLDER_URL]}, "s1", ["n1", "n2"], "uid", NOW, counter());
    expect(plan).toEqual({
      imageUrls: ["n1", "n2"],
      spotImages: [
        {id: "new_0", url: "n1", addedBy: "uid", addedAt: NOW, likes: 0, likedBy: []},
        {id: "new_1", url: "n2", addedBy: "uid", addedAt: NOW, likes: 0, likedBy: []},
      ],
      primaryImageIndex: 0,
    });
  });

  it("placeholder entries in spotImages are dropped", () => {
    const plan = planAddImages({
      imageUrls: [PLACEHOLDER_URL],
      spotImages: [{id: "p", url: PLACEHOLDER_URL, addedAt: LATER, likes: 0, likedBy: []}],
    }, "s1", ["n1"], "uid", NOW, counter());
    expect(plan.spotImages.map((i: SpotImage<string>) => i.id)).toEqual(["new_0"]);
    expect(plan.primaryImageIndex).toBe(0);
  });

  it("spot with no images → primary 0", () => {
    const plan = planAddImages({}, "s1", ["n1"], "uid", NOW, counter());
    expect(plan.imageUrls).toEqual(["n1"]);
    expect(plan.primaryImageIndex).toBe(0);
  });

  it("legacy spot keeps its materialised ids", () => {
    const plan = planAddImages({imageUrls: ["a", "b"]}, "s1", ["n1"], "uid", NOW, counter());
    expect(plan.imageUrls).toEqual(["a", "b", "n1"]);
    expect(plan.spotImages).toEqual([
      {id: "s1_0", url: "a", addedAt: NOW, likes: 0, likedBy: []},
      {id: "s1_1", url: "b", addedAt: NOW, likes: 0, likedBy: []},
      {id: "new_0", url: "n1", addedBy: "uid", addedAt: NOW, likes: 0, likedBy: []},
    ]);
    expect("primaryImageIndex" in plan).toBe(false);
  });

  it("19 + 2 → MAX_SPOT_IMAGES", () => {
    expect(() => planAddImages({imageUrls: urls(19)}, "s1", ["n1", "n2"], "uid", NOW, counter()))
      .toThrow("MAX_SPOT_IMAGES");
  });

  it("18 + 2 → ok", () => {
    const plan = planAddImages({imageUrls: urls(18)}, "s1", ["n1", "n2"], "uid", NOW, counter());
    expect(plan.imageUrls).toHaveLength(20);
    expect(plan.spotImages).toHaveLength(20);
  });

  it("placeholder-only spot + 20 → ok (placeholder does not count)", () => {
    const plan = planAddImages(
      {imageUrls: [PLACEHOLDER_URL]}, "s1", urls(20, "n"), "uid", NOW, counter());
    expect(plan.imageUrls).toHaveLength(20);
  });

  it("existing primary preserved (not in the plan)", () => {
    const existing = [{id: "x", url: "a", addedBy: "o", addedAt: LATER, likes: 3, likedBy: ["p"]}];
    const plan = planAddImages(
      {imageUrls: ["a"], spotImages: existing, primaryImageIndex: 0} as never,
      "s1", ["n1"], "uid", NOW, counter());
    expect(plan).toEqual({
      imageUrls: ["a", "n1"],
      spotImages: [
        existing[0],
        {id: "new_0", url: "n1", addedBy: "uid", addedAt: NOW, likes: 0, likedBy: []},
      ],
    });
  });
});

describe("toggleLikeInImages", () => {
  const base = (): SpotImage<string>[] => [
    {id: "a", url: "ua", addedAt: NOW, likes: 1, likedBy: ["other"]},
    {id: "b", url: "ub", addedAt: NOW, likes: 0, likedBy: []},
  ];

  it("like adds uid and increments", () => {
    const images = base();
    const r = toggleLikeInImages(images, "a", "me");
    expect(r.liked).toBe(true);
    expect(r.likes).toBe(2);
    expect(r.images[0].likedBy).toEqual(["other", "me"]);
    expect(r.images[1]).toBe(images[1]);
    expect(images[0].likedBy).toEqual(["other"]); // input not mutated
  });

  it("unlike removes uid and decrements", () => {
    const r = toggleLikeInImages(
      [{id: "a", url: "ua", addedAt: NOW, likes: 2, likedBy: ["other", "me"]}], "a", "me");
    expect(r).toEqual({
      images: [{id: "a", url: "ua", addedAt: NOW, likes: 1, likedBy: ["other"]}],
      liked: false,
      likes: 1,
    });
  });

  it("likes never below 0", () => {
    const r = toggleLikeInImages(
      [{id: "a", url: "ua", addedAt: NOW, likes: 0, likedBy: ["me"]}], "a", "me");
    expect(r.likes).toBe(0);
    expect(r.liked).toBe(false);
  });

  it("no duplicate uid; a like/unlike cycle is stable", () => {
    let images = base();
    images = toggleLikeInImages(images, "b", "me").images;
    expect(images[1].likedBy).toEqual(["me"]);
    images = toggleLikeInImages(images, "b", "me").images;
    expect(images[1].likedBy).toEqual([]);
    images = toggleLikeInImages(images, "b", "me").images;
    expect(images[1].likedBy.filter((id) => id === "me")).toHaveLength(1);
    expect(images[1].likes).toBe(1);
  });

  it("image not found throws", () => {
    expect(() => toggleLikeInImages(base(), "zzz", "me")).toThrow("IMAGE_NOT_FOUND");
  });
});
