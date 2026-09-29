'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSpotStore } from '@/store/useSpotStore';
import { useUiStore } from '@/store/useUiStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getNavigationUrl } from '@/lib/spotUtils';
import { getGalleryUrls, getHeroImageUrl, getSpotImages, imageFallbacks, sortSpotImagesByLikes } from '@/lib/spotImages';
import { averageRating } from '@/lib/rating';
import PanelShell from '../ui/PanelShell';
import SpotHero from './SpotHero';
import Gallery from './Gallery';
import { AdminStatusCard, DeleteSpotButton } from './AdminActions';
import SpotTitle from './SpotTitle';
import SpotLocation from './SpotLocation';
import EditForm from './EditForm';
import ImageManager from './ImageManager';
import CreatorInfo from './CreatorInfo';
import SpotActions from './SpotActions';
import ReviewsSection from './ReviewsSection';
import { useSpotEdit } from './useSpotEdit';
import { useSpotHighlight } from './useSpotHighlight';

/** Scroll distance (px) after which the compact title bar shows: about the hero's height. */
const COMPACT_AFTER = 300;

interface SpotDetailsPanelProps {
  /** The open spot (activePanel), or null. The panel renders the live store copy (T29). */
  spotId: string | null;
  onClose: () => void;
}

/**
 * Full-screen spot details (T28 split). Always mounted by page.tsx; renders nothing without a spot.
 * Reads the spot live from the store (T29) and closes itself when the spot disappears (deleted).
 * Owns the state that spans several children: edit (title + form), highlight (hero + title) and
 * whether the gallery is open. The children own the rest and unmount while no spot is shown.
 */
export default function SpotDetailsPanel({ spotId, onClose }: Readonly<SpotDetailsPanelProps>) {
  const spot = useSpotStore((s) => (spotId ? s.spots.find((x) => x.id === spotId) : undefined)) ?? null;
  const closeSpotPanel = useUiStore((s) => s.closeSpotPanel);
  useEffect(() => {
    // closeSpotPanel only closes while this spot is still the open panel.
    if (spotId && !spot) closeSpotPanel(spotId);
  }, [spotId, spot, closeSpotPanel]);

  const user = useUserStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const t = useT();
  const edit = useSpotEdit(spot);

  // The spot whose gallery is open. Dropped during render when another spot (or none) is shown
  // (BUG-26), so a gallery never carries over to the next spot.
  const [galleryFor, setGalleryFor] = useState<string | null>(null);
  if (galleryFor !== null && galleryFor !== spot?.id) setGalleryFor(null);
  const galleryOpen = galleryFor !== null && galleryFor === spot?.id;
  const openGallery = useCallback(() => setGalleryFor(spotId), [spotId]);
  const closeGallery = useCallback(() => setGalleryFor(null), []);
  // Approve/delete finish asynchronously: close only if this spot is still the open panel.
  const closeThisSpot = useCallback(() => { if (spotId) closeSpotPanel(spotId); }, [spotId, closeSpotPanel]);

  const highlight = useSpotHighlight(spot);
  // The compact bar shows once the hero has scrolled away (reset for every spot).
  const [compact, setCompact] = useState(false);
  const [compactFor, setCompactFor] = useState(spotId);
  if (compactFor !== spotId) {
    setCompactFor(spotId);
    setCompact(false);
  }

  if (!spot) return null;

  // Sorted gallery images. Legacy spots are materialised in memory only (never written on read).
  const sortedSpotImages = sortSpotImagesByLikes(getSpotImages(spot), 'missingAsZero');
  const allGalleryImages = getGalleryUrls(spot, sortedSpotImages);
  const heroImageUrl = getHeroImageUrl(spot, sortedSpotImages);

  const isOwner = user && spot.createdBy === user.uid;
  const canEdit = isAdmin || (!!isOwner && spot.status === 'approved');
  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);
  const avgRating = averageRating(spot.reviews);

  return (
    <PanelShell
      onClose={onClose}
      backdropLabel="Close spot details"
      variant="slate"
      overlays={
        <Gallery urls={allGalleryImages} open={galleryOpen} startIndex={0} onClose={closeGallery} alt={spot.name} />
      }
    >
      {/* Compact bar: fades in once the title has scrolled under the top (design phase 3) */}
      <div
        aria-hidden={!compact || undefined}
        className={`material-sheet absolute inset-x-0 top-0 z-10 flex items-end justify-center pb-3 px-16 pointer-events-none
          border-b border-white/[.06] transition-opacity duration-150 ${compact ? 'opacity-100' : 'opacity-0'}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
      >
        <span className="text-[17px] font-semibold text-label truncate">{spot.name}</span>
        {/* Rendered only while compact: the hero's own Close is the one in view otherwise */}
        {compact && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="no-min-size pointer-events-auto absolute left-3 w-11 h-11 grid place-items-center rounded-full"
            style={{ bottom: '1px' }}
          >
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        )}
      </div>

      <div
        onScroll={(e) => setCompact(e.currentTarget.scrollTop > COMPACT_AFTER)}
        className="flex-1 overflow-y-auto overscroll-contain pointer-events-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <SpotHero
          spot={spot}
          heroImageUrl={heroImageUrl}
          fallbackUrls={imageFallbacks(spot, sortedSpotImages)}
          imageCount={allGalleryImages.length}
          onOpenGallery={openGallery}
          onClose={onClose}
          closeHidden={compact}
        />

        <div className="px-5 pt-4 space-y-5">
          {isAdmin && <AdminStatusCard spot={spot} onClose={closeThisSpot} />}

          <SpotTitle
            spot={spot}
            avgRating={avgRating}
            canEdit={canEdit}
            edit={edit}
            isHighlightedByUser={highlight.isHighlightedByUser}
          />

          <SpotActions spot={spot} navigationUrl={navigationUrl} highlight={highlight} />

          {/* Description / Edit form */}
          {edit.isEditing ? (
            <EditForm edit={edit} />
          ) : spot.description ? (
            <section>
              <h2 className="text-[20px] font-bold text-label mb-2">{t('description')}</h2>
              <p className="text-[16px] text-label-secondary leading-relaxed">{spot.description}</p>
            </section>
          ) : null}

          {/* Info: one grouped card */}
          <div className="rounded-[18px] bg-surface-1 divide-y divide-white/[.06] overflow-hidden">
            <SpotLocation location={spot.location} navigationUrl={navigationUrl} />
            <CreatorInfo spot={spot} />
          </div>

          {/* Manage images (owner/admin); keyed so its toggle resets for another spot */}
          {canEdit && <ImageManager key={spot.id} spot={spot} imageCount={allGalleryImages.length} />}

          <ReviewsSection spot={spot} />

          {isAdmin && <DeleteSpotButton spot={spot} onClose={closeThisSpot} />}
        </div>
      </div>
    </PanelShell>
  );
}
