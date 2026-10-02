/** The group key of reports about one thing (sha256 of kind|spotId|targetId, 32 hex). Pure. */
import {createHash} from "node:crypto";

export function reportKey(kind: string, spotId: string, targetId: string): string {
  return createHash("sha256").update(`${kind}|${spotId}|${targetId}`).digest("hex").slice(0, 32);
}
