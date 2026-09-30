/**
 * Deleting spot photo files that nothing refers to any more (a removed spot, a rejected photo, a
 * photo an approved edit removed). Only objects under spot-images/ of this bucket are touched;
 * legacy flat paths and anything else stay. Failures are logged, never thrown.
 */
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import {parseStorageDownloadUrl, PLACEHOLDER_URL} from "./spotImages";

function storageContext(): {bucket: string; emulatorHost?: string} {
  const bucket: string = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").storageBucket ?? "";
  const emulatorHost = process.env.FUNCTIONS_EMULATOR === "true" ?
    process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined;
  return {bucket, emulatorHost};
}

/** The spot-images/ object paths among `urls` (placeholder, foreign and malformed URLs dropped). */
export function spotImagePaths(urls: readonly string[], ctx = storageContext()): string[] {
  const paths = urls
    .filter((url) => url !== PLACEHOLDER_URL)
    .map((url) => parseStorageDownloadUrl(url, ctx)?.path)
    .filter((path): path is string => !!path && path.startsWith("spot-images/"));
  return [...new Set(paths)];
}

export async function deleteSpotImageFiles(urls: readonly string[]): Promise<void> {
  const paths = spotImagePaths(urls);
  if (!paths.length) return;
  const bucket = getStorage().bucket();
  const results = await Promise.allSettled(
    paths.map((path) => bucket.file(path).delete({ignoreNotFound: true})),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  logger.info("deleteSpotImageFiles", {deleted: paths.length - failed, failed});
}
