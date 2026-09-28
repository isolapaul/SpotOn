// Display helpers for the notification center (pure).

// Emoji (with variation selectors / joiners) and whitespace at either end of a text.
const EDGE_EMOJI = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+|[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+$/gu;

/**
 * The text without leading or trailing emoji: the type icon already shows the mood, so a "✅" or
 * "⭐" in the title would be a second icon. Emoji inside the text stay. Returns the input when
 * nothing but emoji is left.
 */
export function stripEdgeEmoji(text: string): string {
  const stripped = text.replace(EDGE_EMOJI, '');
  return stripped || text;
}

/** Local-day key, for grouping notifications into "today" and "earlier". */
export function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
