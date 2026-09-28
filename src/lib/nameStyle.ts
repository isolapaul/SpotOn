/**
 * Level-5 custom name style: static allowlists for colour and font (SEC-05, BUG-07).
 *
 * The keys are the exact values stored in users/{uid} and publicProfiles/{uid}
 * (customNameColor / customNameFont), so existing data stays valid. Stored values are
 * untrusted: render sites resolve them only through these maps, never interpolate them.
 * Every class string is a static literal so Tailwind JIT generates it.
 *
 * Server copy of the allowed values: functions/src/lib/levels.ts (NAME_COLORS / NAME_FONTS),
 * parity test: functions/test/levels.parity.test.ts (via levelUtils CUSTOM_NAME_*).
 * Relative imports only, and only `import type` from translations: the functions vitest
 * imports this file through levelUtils and has no `@/` alias.
 */
import type { TranslationKey } from './translations';

/** Picker order = entry order. */
export const NAME_COLORS = {
  'text-cyan-300': { textClass: 'text-cyan-300', selectedClass: 'bg-cyan-300/20 border-2 border-cyan-300', hex: '#67e8f9', labelKey: 'nameColorCyan' },
  'text-purple-400': { textClass: 'text-purple-400', selectedClass: 'bg-purple-400/20 border-2 border-purple-400', hex: '#c084fc', labelKey: 'nameColorPurple' },
  'text-emerald-400': { textClass: 'text-emerald-400', selectedClass: 'bg-emerald-400/20 border-2 border-emerald-400', hex: '#34d399', labelKey: 'nameColorEmerald' },
  'text-rose-400': { textClass: 'text-rose-400', selectedClass: 'bg-rose-400/20 border-2 border-rose-400', hex: '#fb7185', labelKey: 'nameColorRose' },
  'text-yellow-300': { textClass: 'text-yellow-300', selectedClass: 'bg-yellow-300/20 border-2 border-yellow-300', hex: '#fde047', labelKey: 'nameColorGold' },
  'text-slate-300': { textClass: 'text-slate-300', selectedClass: 'bg-slate-300/20 border-2 border-slate-300', hex: '#cbd5e1', labelKey: 'nameColorSilver' },
  'text-orange-400': { textClass: 'text-orange-400', selectedClass: 'bg-orange-400/20 border-2 border-orange-400', hex: '#fb923c', labelKey: 'nameColorOrange' },
} as const satisfies Record<string, { textClass: string; selectedClass: string; hex: string; labelKey: TranslationKey }>;

/** Picker order = entry order. */
export const NAME_FONTS = {
  'font-sans': { className: 'font-sans', labelKey: 'nameFontNormal' },
  'font-bold': { className: 'font-bold', labelKey: 'nameFontBold' },
  'font-serif': { className: 'font-serif', labelKey: 'nameFontHandwriting' },
  'font-mono': { className: 'font-mono', labelKey: 'nameFontModern' },
  'font-serif italic': { className: 'font-serif italic', labelKey: 'nameFontElegant' },
  'font-extrabold': { className: 'font-extrabold', labelKey: 'nameFontExtraBold' },
  'font-light italic': { className: 'font-light italic', labelKey: 'nameFontLightElegant' },
} as const satisfies Record<string, { className: string; labelKey: TranslationKey }>;

export type NameColorValue = keyof typeof NAME_COLORS;
export type NameFontValue = keyof typeof NAME_FONTS;

const DEFAULT_FONT_CLASS = 'font-sans';

export function isNameColorValue(v: unknown): v is NameColorValue {
  return typeof v === 'string' && Object.hasOwn(NAME_COLORS, v);
}

export function isNameFontValue(v: unknown): v is NameFontValue {
  return typeof v === 'string' && Object.hasOwn(NAME_FONTS, v);
}

/** Allowlisted font class for a stored value, else 'font-sans'. */
export function resolveNameFontClass(v: unknown): string {
  return isNameFontValue(v) ? NAME_FONTS[v].className : DEFAULT_FONT_CLASS;
}

/** Allowlisted hex colour for a stored value, else undefined (caller falls back to the level colour). */
export function resolveNameColorHex(v: unknown): string | undefined {
  return isNameColorValue(v) ? NAME_COLORS[v].hex : undefined;
}
