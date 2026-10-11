// The share card (growth plan §6): a clean 1080×1920 story image of a spot. Pure layout helpers;
// hooks/shareCard draws it on a canvas.

export const CARD = { width: 1080, height: 1920, margin: 88 } as const;

/**
 * Greedy word wrap: at most `maxLines` lines no wider than `maxWidth` (by `measure`); the last line
 * ends with an ellipsis when text is left over. A single word wider than the line is cut too.
 */
export function wrapLines(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    line = '';
    i = words.length;
  }
  const leftOver = i < words.length || line !== '';
  if (leftOver || lines.some((l) => measure(l) > maxWidth)) {
    const last = lines.length - 1;
    let cut = lines[last];
    while (cut.length > 1 && measure(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
    lines[last] = leftOver || measure(lines[last]) > maxWidth ? `${cut.trimEnd()}…` : cut;
  }
  return lines.slice(0, maxLines);
}

/** The source rectangle that covers a `w`×`h` box with an image of `iw`×`ih` (object-fit: cover). */
export function coverRect(iw: number, ih: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}
