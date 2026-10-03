/**
 * Special pin icons (item 6): from PIN_MIN_LEVEL a user picks one icon (users.pinIcon) that
 * replaces the category glyph on the map pins of all their spots (spots.ownerPin, server-written).
 *
 * KEEP IN SYNC with PIN_ICON_IDS in src/lib/pinGlyphs.ts
 * (parity test: functions/test/pinIcons.test.ts)
 */
export const PIN_ICON_IDS: readonly string[] = [
  "star", "crown", "flame", "mountain", "leaf", "bolt", "diamond", "moon",
];

/** Level from which the pin icon is shown (canCustomizeIcon). */
export const PIN_MIN_LEVEL = 4;

/** An allowlisted pin icon id, else null. */
export function validPinIcon(x: unknown): string | null {
  return typeof x === "string" && PIN_ICON_IDS.includes(x) ? x : null;
}

/** The pin icon a user's spots show: their choice, only while their level allows it. */
export function ownerPinFor(level: number, pinIcon: unknown): string | null {
  return level >= PIN_MIN_LEVEL ? validPinIcon(pinIcon) : null;
}
