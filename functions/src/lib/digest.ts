/**
 * The weekly feed digest (pure): who gets told how many new spots the people they follow shared
 * in the past week, and whose names to show.
 */
export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface Digest {
  follower: string;
  count: number;
  /** Owners with new spots, most spots first. */
  owners: string[];
}

/**
 * `newSpots`: owner uid per new approved spot; `followers`: an owner's followers. A follower's own
 * spots never count (one cannot follow oneself, but stay safe), blocked pairs are skipped.
 */
export function planDigests(
  newSpots: readonly string[],
  followers: ReadonlyMap<string, readonly string[]>,
  blocked: (a: string, b: string) => boolean = () => false,
): Digest[] {
  const perOwner = new Map<string, number>();
  for (const owner of newSpots) perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);
  const byFollower = new Map<string, Map<string, number>>();
  for (const [owner, count] of perOwner) {
    for (const follower of followers.get(owner) ?? []) {
      if (follower === owner || blocked(follower, owner) || blocked(owner, follower)) continue;
      const owners = byFollower.get(follower) ?? new Map<string, number>();
      owners.set(owner, count);
      byFollower.set(follower, owners);
    }
  }
  return [...byFollower].map(([follower, owners]) => ({
    follower,
    count: [...owners.values()].reduce((a, b) => a + b, 0),
    owners: [...owners].sort((a, b) => b[1] - a[1]).map(([o]) => o),
  }));
}
