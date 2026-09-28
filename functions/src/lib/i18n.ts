/**
 * Notification translations (hu/en/de) and translate().
 * Strings are byte-identical to the pre-T08 functions/src/index.ts table.
 */
export type Lang = "hu" | "en" | "de";
export type TParam = string | number;
type Template = string | ((...params: TParam[]) => string);

export const translations = {
  spotApproved: {
    hu: "Jóváhagyták a helyedet! 🥳",
    en: "Your spot has been approved! 🥳",
    de: "Ihr Ort wurde genehmigt! 🥳",
  },
  spotApprovedBody: {
    hu: (spotName: TParam) => `"${spotName}" mostantól látható a térképen`,
    en: (spotName: TParam) => `"${spotName}" is now visible on the map`,
    de: (spotName: TParam) => `"${spotName}" ist jetzt auf der Karte sichtbar`,
  },
  newReview: {
    hu: "Új értékelés érkezett! ⭐",
    en: "New review received! ⭐",
    de: "Neue Bewertung erhalten! ⭐",
  },
  newReviewBody: {
    hu: (spotName: TParam, rating: TParam) =>
      `"${spotName}" ${rating} csillagot kapott`,
    en: (spotName: TParam, rating: TParam) =>
      `"${spotName}" received ${rating} stars`,
    de: (spotName: TParam, rating: TParam) =>
      `"${spotName}" hat ${rating} Sterne erhalten`,
  },
  newLike: {
    hu: "Valaki kedvelte a helyedet ❤️",
    en: "Someone liked your spot ❤️",
    de: "Jemandem gefällt Ihr Ort ❤️",
  },
  newLikeBody: {
    hu: (spotName: TParam) => `"${spotName}" kedvencek közé került`,
    en: (spotName: TParam) => `"${spotName}" was added to favorites`,
    de: (spotName: TParam) => `"${spotName}" wurde zu Favoriten hinzugefügt`,
  },
  newPendingSpot: {
    hu: "Új hely vár jóváhagyásra 🛡️",
    en: "New spot awaiting approval 🛡️",
    de: "Neuer Ort wartet auf Genehmigung 🛡️",
  },
  newPendingSpotBody: {
    hu: (spotName: TParam, userName: TParam) =>
      `"${spotName}" feltöltve: ${userName}`,
    en: (spotName: TParam, userName: TParam) =>
      `"${spotName}" uploaded by ${userName}`,
    de: (spotName: TParam, userName: TParam) =>
      `"${spotName}" hochgeladen von ${userName}`,
  },
} satisfies Record<string, Record<Lang, Template>>;

export type TKey = keyof typeof translations;

function isLang(lang: unknown): lang is Lang {
  return lang === "hu" || lang === "en" || lang === "de";
}

/** Renders `key` in `lang`; any unknown/missing language falls back to `en`. */
export function translate(
  key: TKey,
  lang: unknown,
  params: ReadonlyArray<TParam> = [],
): string {
  const entry: Record<Lang, Template> = translations[key];
  const template = entry[isLang(lang) ? lang : "en"];
  return typeof template === "function" ? template(...params) : String(template);
}
