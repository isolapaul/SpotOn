import {describe, expect, it} from "vitest";
import {TKey, translate, translations} from "../src/lib/i18n";

const keys = Object.keys(translations) as TKey[];

describe("translations", () => {
  it("has every key in hu/en/de", () => {
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      for (const lang of ["hu", "en", "de"] as const) {
        expect(translations[key][lang], `${key}.${lang}`).toBeDefined();
        expect(translate(key, lang, ["X", 5]).length, `${key}.${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it("contains no valentine keys", () => {
    for (const key of keys) {
      expect(key.toLowerCase()).not.toContain("valentine");
    }
  });
});

describe("translate", () => {
  it("renders plain titles", () => {
    expect(translate("spotApproved", "hu")).toBe("Jóváhagyták a helyedet! 🥳");
    expect(translate("newLike", "de")).toBe("Jemandem gefällt Ihr Ort ❤️");
  });

  it("renders parametrised bodies", () => {
    expect(translate("spotApprovedBody", "en", ["Park"])).toBe("\"Park\" is now visible on the map");
    expect(translate("newReviewBody", "hu", ["Park", 4])).toBe("\"Park\" 4 csillagot kapott");
    expect(translate("newReviewBody", "de", ["Park", 5])).toBe("\"Park\" hat 5 Sterne erhalten");
    expect(translate("newLikeBody", "en", ["Park"])).toBe("\"Park\" was added to favorites");
    expect(translate("newPendingSpotBody", "en", ["Park", "anna"]))
      .toBe("\"Park\" uploaded by anna");
  });

  it("falls back to en for unknown or missing languages", () => {
    expect(translate("newReview", "fr")).toBe("New review received! ⭐");
    expect(translate("newReview", undefined)).toBe("New review received! ⭐");
    expect(translate("newPendingSpotBody", "xx", ["Park", "anna"]))
      .toBe("\"Park\" uploaded by anna");
  });
});
