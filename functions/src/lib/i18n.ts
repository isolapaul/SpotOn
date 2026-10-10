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
  // Moderation (item 4): to the owner or uploader, with the admin's reason.
  spotRejected: {
    hu: "A helyedet nem hagytuk jóvá",
    en: "Your spot was not approved",
    de: "Ihr Ort wurde nicht genehmigt",
  },
  spotRejectedBody: {
    hu: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}. Javíthatod és újra beküldheted.`,
    en: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}. You can edit and resubmit it.`,
    de: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}. Sie können ihn bearbeiten und erneut einreichen.`,
  },
  spotRemoved: {
    hu: "A helyedet eltávolítottuk",
    en: "Your spot was removed",
    de: "Ihr Ort wurde entfernt",
  },
  spotRemovedBody: {
    hu: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    en: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    de: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
  },
  editApproved: {
    hu: "Jóváhagytuk a módosításodat",
    en: "Your changes were approved",
    de: "Ihre Änderungen wurden genehmigt",
  },
  editApprovedBody: {
    hu: (spotName: TParam) => `"${spotName}" frissült a térképen`,
    en: (spotName: TParam) => `"${spotName}" is updated on the map`,
    de: (spotName: TParam) => `"${spotName}" wurde auf der Karte aktualisiert`,
  },
  editRejected: {
    hu: "A módosításodat nem hagytuk jóvá",
    en: "Your changes were not approved",
    de: "Ihre Änderungen wurden nicht genehmigt",
  },
  editRejectedBody: {
    hu: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    en: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    de: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
  },
  photoApproved: {
    hu: "Jóváhagytuk a fotódat",
    en: "Your photo was approved",
    de: "Ihr Foto wurde genehmigt",
  },
  photoApprovedBody: {
    hu: (spotName: TParam) => `Mostantól látható itt: "${spotName}"`,
    en: (spotName: TParam) => `It now shows on "${spotName}"`,
    de: (spotName: TParam) => `Es ist jetzt bei "${spotName}" zu sehen`,
  },
  photoRejected: {
    hu: "A fotódat nem hagytuk jóvá",
    en: "Your photo was not approved",
    de: "Ihr Foto wurde nicht genehmigt",
  },
  photoRejectedBody: {
    hu: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    en: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    de: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
  },
  // Moderation (item 4): to the admins.
  spotResubmitted: {
    hu: "Újra beküldött hely vár jóváhagyásra",
    en: "A resubmitted spot awaits approval",
    de: "Ein erneut eingereichter Ort wartet auf Genehmigung",
  },
  spotResubmittedBody: {
    hu: (spotName: TParam, userName: TParam) => `"${spotName}" újra beküldve: ${userName}`,
    en: (spotName: TParam, userName: TParam) => `"${spotName}" resubmitted by ${userName}`,
    de: (spotName: TParam, userName: TParam) => `"${spotName}" erneut eingereicht von ${userName}`,
  },
  editProposed: {
    hu: "Módosítás vár jóváhagyásra",
    en: "A change awaits approval",
    de: "Eine Änderung wartet auf Genehmigung",
  },
  editProposedBody: {
    hu: (spotName: TParam) => `Módosították ezt: "${spotName}"`,
    en: (spotName: TParam) => `Changes proposed for "${spotName}"`,
    de: (spotName: TParam) => `Änderungen vorgeschlagen für "${spotName}"`,
  },
  photoSubmitted: {
    hu: "Új fotó vár jóváhagyásra",
    en: "A new photo awaits approval",
    de: "Ein neues Foto wartet auf Genehmigung",
  },
  photoSubmittedBody: {
    hu: (spotName: TParam) => `Fotó érkezett ehhez: "${spotName}"`,
    en: (spotName: TParam) => `A photo was added to "${spotName}"`,
    de: (spotName: TParam) => `Ein Foto wurde zu "${spotName}" hinzugefügt`,
  },
  contentRemoved: {
    hu: "Eltávolítottunk egy tartalmadat",
    en: "We removed something you posted",
    de: "Wir haben einen deiner Beiträge entfernt",
  },
  contentRemovedBody: {
    hu: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    en: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
    de: (spotName: TParam, reason: TParam) => `"${spotName}": ${reason}`,
  },
  newReport: {
    hu: "Új jelentés",
    en: "New report",
    de: "Neue Meldung",
  },
  newReportBody: {
    hu: (what: TParam) => `Jelentették: "${what}"`,
    en: (what: TParam) => `Reported: "${what}"`,
    de: (what: TParam) => `Gemeldet: "${what}"`,
  },
  reviewReply: {
    hu: "Új válasz",
    en: "New reply",
    de: "Neue Antwort",
  },
  reviewReplyBody: {
    hu: (user: TParam, spotName: TParam) => `${user} válaszolt itt: "${spotName}"`,
    en: (user: TParam, spotName: TParam) => `${user} replied on "${spotName}"`,
    de: (user: TParam, spotName: TParam) => `${user} hat bei "${spotName}" geantwortet`,
  },
  // Follows (item 8).
  followRequest: {
    hu: "Új követési kérés",
    en: "New follow request",
    de: "Neue Folgeanfrage",
  },
  followRequestBody: {
    hu: (user: TParam) => `${user} követni szeretne`,
    en: (user: TParam) => `${user} wants to follow you`,
    de: (user: TParam) => `${user} möchte dir folgen`,
  },
  followAccepted: {
    hu: "Elfogadták a követési kérésedet",
    en: "Follow request accepted",
    de: "Folgeanfrage angenommen",
  },
  followAcceptedBody: {
    hu: (user: TParam) => `Mostantól követed: ${user}`,
    en: (user: TParam) => `You now follow ${user}`,
    de: (user: TParam) => `Du folgst jetzt ${user}`,
  },
  followedSpot: {
    hu: "Új hely attól, akit követsz",
    en: "New spot from someone you follow",
    de: "Neuer Ort von jemandem, dem du folgst",
  },
  followedSpotBody: {
    hu: (user: TParam, spotName: TParam) => `${user}: "${spotName}"`,
    en: (user: TParam, spotName: TParam) => `${user}: "${spotName}"`,
    de: (user: TParam, spotName: TParam) => `${user}: "${spotName}"`,
  },
  newFollower: {
    hu: "Új követő",
    en: "New follower",
    de: "Neuer Follower",
  },
  newFollowerBody: {
    hu: (user: TParam) => `${user} bekövetett`,
    en: (user: TParam) => `${user} started following you`,
    de: (user: TParam) => `${user} folgt dir jetzt`,
  },
  // Weekly feed digest: (first name, how many others, how many spots).
  weeklyDigest: {
    hu: "Heti összefoglaló",
    en: "Your week on SpotOn",
    de: "Deine Woche auf SpotOn",
  },
  weeklyDigestBody: {
    hu: (name: TParam, others: TParam, count: TParam) => Number(others) > 0 ?
      `${name} és még ${others} ember ${count} új helyet osztott meg a héten` :
      `${name} ${count} új helyet osztott meg a héten`,
    en: (name: TParam, others: TParam, count: TParam) => Number(others) > 0 ?
      `${name} and ${others} more shared ${count} new spots this week` :
      `${name} shared ${count} new ${Number(count) === 1 ? "spot" : "spots"} this week`,
    de: (name: TParam, others: TParam, count: TParam) => Number(others) > 0 ?
      `${name} und ${others} weitere haben diese Woche ${count} neue Orte geteilt` :
      `${name} hat diese Woche ${count} ${Number(count) === 1 ? "neuen Ort" : "neue Orte"} geteilt`,
  },
  weeklyDigestBodyNoName: {
    hu: (count: TParam) => `${count} új hely azoktól, akiket követsz`,
    en: (count: TParam) => `${count} new ${Number(count) === 1 ? "spot" : "spots"} from people you follow`,
    de: (count: TParam) => `${count} ${Number(count) === 1 ? "neuer Ort" : "neue Orte"} von Leuten, denen du folgst`,
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
