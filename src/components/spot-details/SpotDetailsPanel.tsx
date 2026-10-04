'use client';

import { useCallback, useEffect, useState } from 'react';
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
import type { SpotBack } from '@/components/ui/BackButton';
import CompactBar from './CompactBar';
import ReportButton from '../safety/ReportButton';
import Gallery from './Gallery';
import { AdminStatusCard, DeleteSpotButton } from './AdminActions';
import OwnerStatusCard from './OwnerStatusCard';
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
  /** Opened from a list (profile, Explore): the way back to it. */
  back?: SpotBack;
}

/**
 * Full-screen spot details (T28 split). Always mounted by page.tsx; renders nothing without a spot.
 * Reads the spot live from the store (T29) and closes itself when the spot disappears (deleted).
 * Owns the state that spans several children: edit (title + form), highlight (hero + title) and
 * whether the gallery is open. The children own the rest and unmount while no spot is shown.
 */
export default function SpotDetailsPanel({ spotId, onClose, back }: Readonly<SpotDetailsPanelProps>) {
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

  const isOwner = !!user && spot.createdBy === user.uid;
  // Admins edit directly; owners too while the spot is under review, else they propose (item 4).
  const canEdit = edit.route !== null;
  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);
  const avgRating = averageRating(spot.reviews);

  return (
    <PanelShell
      onClose={onClose}
      backdropLabel="Close spot details"
      variant="slate"
      overlays={
        <Gallery urls={allGalleryImages} open={galleryOpen} startIndex={0} onClose={closeGallery} alt={spot.name} spotId={spot.status === 'approved' && !isOwner ? spot.id : undefined} />
      }
    >
      <CompactBar title={spot.name} shown={compact} onClose={onClose} back={back} />

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
          back={back}
          closeHidden={compact}
        />

        <div className="px-5 pt-4 space-y-5">
          {isAdmin && <AdminStatusCard spot={spot} onClose={closeThisSpot} />}
          {isOwner && !isAdmin && <OwnerStatusCard spot={spot} onEdit={edit.start} />}

          {/* Title, its category and rating line, and the actions read as one block. */}
          <div className="space-y-4">
            <SpotTitle
              spot={spot}
              avgRating={avgRating}
              canEdit={canEdit}
              edit={edit}
              isHighlightedByUser={highlight.isHighlightedByUser}
            />
            <SpotActions spot={spot} navigationUrl={navigationUrl} highlight={highlight} />
          </div>

          {/* Description / Edit form */}
          {edit.isEditing ? (
            <EditForm spotId={spot.id} edit={edit} />
          ) : spot.description ? (
            <section>
              <h2 className="text-[20px] font-bold text-label mb-2">{t('description')}</h2>
              <p className="text-[16px] text-label-secondary leading-relaxed">{spot.description}</p>
            </section>
          ) : null}

          {/* Info: one grouped card */}
          <div className="rounded-[18px] bg-surface-1 divide-y divide-white/6 overflow-hidden">
            <SpotLocation location={spot.location} navigationUrl={navigationUrl} />
            <CreatorInfo spot={spot} />
          </div>

          {/* Manage images (owner/admin); keyed so its toggle resets for another spot */}
          {edit.route && <ImageManager key={spot.id} spot={spot} imageCount={allGalleryImages.length} route={edit.route} />}

          <ReviewsSection spot={spot} />

          {isAdmin && <DeleteSpotButton spot={spot} onClose={closeThisSpot} />}
          {!isOwner && spot.status === 'approved' && (
            <div className="flex justify-center pt-2">
              <ReportButton target={{ kind: 'spot', spotId: spot.id, targetId: spot.id }} />
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
