// The following feed (Instagram-like): spots of the people the user follows, newest first, then
// earlier spots of everyone else so the feed is never empty. Pure.
import type { Spot } from '@/store/useSpotStore';
import { publishedAt } from './newSpots';
import { getHeroImageUrl, getSpotImages, imageFallbacks, PLACEHOLDER_URL, sortSpotImagesByLikes } from './spotImages';

/** Cards rendered per page while scrolling. */
export const FEED_PAGE_SIZE = 10;
/** Photos swipeable on one card. */
export const FEED_MAX_PHOTOS = 10;
/** Fewer followed cards than this: no "all caught up" line before the suggestions. */
export const FEED_CAUGHT_UP_MIN = 3;
/** A card younger than this gets the "New" badge. */
export const FEED_NEW_MS = 24 * 60 * 60 * 1000;

const DELETED_OWNER = 'deleted-user';

export interface FeedSections {
  /** Spots of followed people, newest first. */
  followed: Spot[];
  /** Everyone else's spots (not the user's own), newest first. */
  suggested: Spot[];
}

const time = (s: Spot) => publishedAt(s) ?? 0;

/**
 * Approved spots with a known poster, split into followed and suggested. The user's own spots
 * and the spots of people either side blocked are left out.
 */
export function buildFeed(
  spots: readonly Spot[],
  o: { following: ReadonlySet<string>; me: string | null; hidden: ReadonlySet<string> },
): FeedSections {
  const shown = spots
    .filter((s) => s.status === 'approved' && s.createdBy && s.createdBy !== DELETED_OWNER)
    .filter((s) => s.createdBy !== o.me && !o.hidden.has(s.createdBy))
    .sort((a, b) => time(b) - time(a));
  return {
    followed: shown.filter((s) => o.following.has(s.createdBy)),
    suggested: shown.filter((s) => !o.following.has(s.createdBy)),
  };
}

/** Followed spots that appeared after `seenAt` (the launcher's dot). */
export function countUnseen(followed: readonly Spot[], seenAt: number): number {
  return followed.filter((s) => time(s) > seenAt).length;
}

/** Appeared within FEED_NEW_MS of `now`. */
export function isFreshSpot(spot: Spot, now: number): boolean {
  const at = publishedAt(spot);
  return at !== null && now - at < FEED_NEW_MS;
}

export interface FeedPhoto {
  url: string;
  /** The spotImages id to like; null for a photo that cannot be liked. */
  imageId: string | null;
  likes: number;
  likedBy: string[];
}

/**
 * A card's photos: the details hero first, then the gallery order, then the legacy singular
 * `imageUrl` (so old spots and broken spotImages entries still show a photo); at most FEED_MAX_PHOTOS.
 */
export function feedPhotos(spot: Spot): FeedPhoto[] {
  const images = getSpotImages(spot);
  const sorted = sortSpotImagesByLikes(images, 'missingAsZero');
  const gallery = imageFallbacks(spot, sorted);
  const hero = getHeroImageUrl(spot, sorted);
  const urls = (hero !== PLACEHOLDER_URL ? [hero, ...gallery] : gallery)
    .filter((url, i, all) => all.indexOf(url) === i)
    .slice(0, FEED_MAX_PHOTOS);
  return urls.map((url) => {
    const image = images.find((img) => img.url === url);
    return image
      ? { url, imageId: image.id, likes: image.likes ?? 0, likedBy: image.likedBy ?? [] }
      : { url, imageId: null, likes: 0, likedBy: [] };
  });
}

/** The poster people who are not followed yet, most spots first (the "People to follow" row). */
export function suggestedPeople(suggested: readonly Spot[], max: number): { uid: string; name: string; photo?: string; count: number }[] {
  const byUid = new Map<string, { uid: string; name: string; photo?: string; count: number }>();
  for (const s of suggested) {
    const entry = byUid.get(s.createdBy);
    if (entry) entry.count += 1;
    else byUid.set(s.createdBy, { uid: s.createdBy, name: s.createdByName ?? '', photo: s.createdByPhoto, count: 1 });
  }
  return [...byUid.values()]
    .filter((p) => p.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/** A card's age for its "3 h" label; older than four weeks shows the date instead (null). */
export function feedAge(at: number | null, now: number): { unit: 'now' | 'min' | 'h' | 'd' | 'w'; n: number } | null {
  if (at === null) return null;
  const min = Math.floor(Math.max(0, now - at) / 60_000);
  if (min < 1) return { unit: 'now', n: 0 };
  if (min < 60) return { unit: 'min', n: min };
  if (min < 24 * 60) return { unit: 'h', n: Math.floor(min / 60) };
  const days = Math.floor(min / (24 * 60));
  if (days < 7) return { unit: 'd', n: days };
  return days < 28 ? { unit: 'w', n: Math.floor(days / 7) } : null;
}
