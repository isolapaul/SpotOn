// Parity between the server pin icon allowlist and the client glyphs.
import {describe, expect, it} from "vitest";
import {PIN_ICON_IDS as CLIENT_IDS, PIN_GLYPHS} from "../../src/lib/pinGlyphs";
import {ownerPinFor, PIN_ICON_IDS, PIN_MIN_LEVEL, validPinIcon} from "../src/lib/pinIcons";
import {getLevelInfo} from "../../src/lib/levelUtils";

describe("pin icons", () => {
  it("match the client ids, each with a glyph", () => {
    expect(PIN_ICON_IDS).toEqual([...CLIENT_IDS]);
    for (const id of PIN_ICON_IDS) expect(PIN_GLYPHS[id as keyof typeof PIN_GLYPHS]).toBeDefined();
  });
  it("the level gate matches canCustomizeIcon", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(level >= PIN_MIN_LEVEL).toBe(getLevelInfo(level).canCustomizeIcon);
    }
  });
  it("only allowlisted icons, only from level 4", () => {
    expect(validPinIcon("crown")).toBe("crown");
    expect(validPinIcon("<svg>")).toBeNull();
    expect(ownerPinFor(4, "moon")).toBe("moon");
    expect(ownerPinFor(3, "moon")).toBeNull();
    expect(ownerPinFor(5, "nope")).toBeNull();
  });
});
