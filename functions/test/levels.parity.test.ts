// Parity between the server copy (functions/src/lib/levels.ts) and the client level system.
import {describe, expect, it} from "vitest";
import {
  CUSTOM_NAME_COLORS,
  CUSTOM_NAME_FONTS,
  LEVEL_THRESHOLDS as CLIENT_LEVEL_THRESHOLDS,
  XP_REWARDS as CLIENT_XP_REWARDS,
  getLevelInfo,
  levelForSpotCount as clientLevelForSpotCount,
  levelForXp as clientLevelForXp,
} from "../../src/lib/levelUtils";
import {
  LEVEL_THRESHOLDS,
  levelForSpotCount,
  levelForXp,
  maxHighlightsForLevel,
  NAME_COLORS,
  NAME_FONTS,
  NAME_STYLE_MIN_LEVEL,
  XP_REWARDS,
} from "../src/lib/levels";

describe("levels parity with src/lib/levelUtils.ts", () => {
  it("levelForXp matches for 0..300 XP, levelForSpotCount for 0..30 spots", () => {
    for (let xp = 0; xp <= 300; xp++) expect(levelForXp(xp), `xp=${xp}`).toBe(clientLevelForXp(xp));
    for (let n = 0; n <= 30; n++) expect(levelForSpotCount(n), `n=${n}`).toBe(clientLevelForSpotCount(n));
  });

  it("level table and XP rewards match", () => {
    expect(LEVEL_THRESHOLDS).toEqual(
      CLIENT_LEVEL_THRESHOLDS.map(({level, xpRequired}) => ({level, xpRequired})),
    );
    expect(XP_REWARDS).toEqual(CLIENT_XP_REWARDS);
  });

  it("highlights and the name-style gate match per level", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(maxHighlightsForLevel(level)).toBe(getLevelInfo(level).maxHighlights);
      expect(level >= NAME_STYLE_MIN_LEVEL).toBe(getLevelInfo(level).canCustomizeName);
    }
  });

  it("name-style allowlists match the client options", () => {
    expect(NAME_COLORS).toEqual(CUSTOM_NAME_COLORS.map((v) => v.value));
    expect(NAME_FONTS).toEqual(CUSTOM_NAME_FONTS.map((v) => v.value));
  });
});
