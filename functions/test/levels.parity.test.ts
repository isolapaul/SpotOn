// Parity between the server copy (functions/src/lib/levels.ts) and the client level system.
import {describe, expect, it} from "vitest";
import {
  CUSTOM_NAME_COLORS,
  CUSTOM_NAME_FONTS,
  LEVEL_THRESHOLDS as CLIENT_LEVEL_THRESHOLDS,
  calculateLevel as clientCalculateLevel,
  getLevelInfo,
} from "../../src/lib/levelUtils";
import {
  calculateLevel,
  LEVEL_THRESHOLDS,
  maxHighlightsForCount,
  NAME_COLORS,
  NAME_FONTS,
  NAME_STYLE_MIN_LEVEL,
} from "../src/lib/levels";

describe("levels parity with src/lib/levelUtils.ts", () => {
  it("calculateLevel and maxHighlights match for 0..30 spots", () => {
    for (let n = 0; n <= 30; n++) {
      expect(calculateLevel(n), `level n=${n}`).toBe(clientCalculateLevel(n));
      expect(maxHighlightsForCount(n), `maxHighlights n=${n}`)
        .toBe(getLevelInfo(n).maxHighlights);
    }
  });

  it("level table matches", () => {
    expect(LEVEL_THRESHOLDS).toEqual(
      CLIENT_LEVEL_THRESHOLDS.map(({level, spotsRequired}) => ({level, spotsRequired})),
    );
  });

  it("name-style gate matches canCustomizeName", () => {
    for (let n = 0; n <= 30; n++) {
      expect(calculateLevel(n) >= NAME_STYLE_MIN_LEVEL).toBe(getLevelInfo(n).canCustomizeName);
    }
  });

  it("name-style allowlists match the client options", () => {
    expect(NAME_COLORS).toEqual(CUSTOM_NAME_COLORS.map((v) => v.value));
    expect(NAME_FONTS).toEqual(CUSTOM_NAME_FONTS.map((v) => v.value));
  });
});
