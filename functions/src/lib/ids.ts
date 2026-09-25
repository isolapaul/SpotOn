/**
 * Pure id validation shared by the callables (T10). No imports.
 */

/** Longest spot id accepted from callers. */
export const MAX_SPOT_ID_LENGTH = 200;

/**
 * True for a usable spots/{id} document id: a string of 1–200 characters without "/", not
 * "." or "..", and not a reserved `__…__` id. Anything else would be read as a different path
 * (or rejected by Firestore) when passed to collection("spots").doc(id).
 */
export function isValidSpotId(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && x.length <= MAX_SPOT_ID_LENGTH &&
    !x.includes("/") && x !== "." && x !== ".." && !/^__.*__$/.test(x);
}
