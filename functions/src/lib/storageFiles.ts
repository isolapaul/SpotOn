/**
 * Deleting spot photo files that nothing refers to any more (a removed spot, a rejected photo, a
 * photo an approved edit removed). A file is deleted only when
 * - it is under spot-images/{owner}/ of one of the given owners (the spot's creator, the photo's
 *   uploader, or the deleted-user folder), so a spot that lists someone else's URL can never get
 *   that person's file deleted; and
 * - no spot and no waiting photo submission refers to it any more.
 * Legacy flat paths and anything else stay. Failures are logged, never thrown.
 */
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import {db} from "./app";
import {DELETED_OWNER} from "./accountDeletion";
import {parseStorageDownloadUrl, PLACEHOLDER_URL} from "./spotImages";

function storageContext(): {bucket: string; emulatorHost?: string} {
  const bucket: string = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").storageBucket ?? "";
  const emulatorHost = process.env.FUNCTIONS_EMULATOR === "true" ?
    process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined;
  return {bucket, emulatorHost};
}

/** A photo URL and who may own its file (its uploader and/or the spot's creator). */
export interface PhotoFile {
  url: string;
  owners: readonly string[];
}

/**
 * The spot-images/{owner}/ object path of each file, when it lies in one of its owners' folders
 * (or the deleted-user folder); placeholder, foreign, malformed and other folders are dropped.
 */
export function ownedSpotImagePaths(
  files: readonly PhotoFile[],
  ctx = storageContext(),
): {url: string; path: string}[] {
  const out = new Map<string, {url: string; path: string}>();
  for (const {url, owners} of files) {
    if (url === PLACEHOLDER_URL) continue;
    const path = parseStorageDownloadUrl(url, ctx)?.path;
    if (!path) continue;
    const allowed = [...owners, DELETED_OWNER].filter((o) => o.length > 0 && !o.includes("/"));
    if (allowed.some((owner) => path.startsWith(`spot-images/${owner}/`))) out.set(path, {url, path});
  }
  return [...out.values()];
}

/** True when a spot or a waiting photo submission still refers to the URL. */
async function stillReferenced(url: string): Promise<boolean> {
  const [spots, submissions] = await Promise.all([
    db.collection("spots").where("imageUrls", "array-contains", url).limit(1).select().get(),
    db.collection("photoSubmissions").where("url", "==", url).limit(1).select().get(),
  ]);
  return !spots.empty || !submissions.empty;
}

export async function deleteSpotImageFiles(files: readonly PhotoFile[]): Promise<void> {
  const candidates = ownedSpotImagePaths(files);
  if (!candidates.length) return;
  const bucket = getStorage().bucket();
  const results = await Promise.allSettled(candidates.map(async ({url, path}) => {
    if (await stillReferenced(url)) return false;
    await bucket.file(path).delete({ignoreNotFound: true});
    return true;
  }));
  const deleted = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.filter((r) => r.status === "rejected").length;
  logger.info("deleteSpotImageFiles", {deleted, kept: candidates.length - deleted - failed, failed});
}
