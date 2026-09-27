'use client';

import { useCallback, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getNavigationUrl } from '@/lib/spotUtils';
import { getGalleryUrls, getHeroImageUrl, getSpotImages, sortSpotImagesByLikes } from '@/lib/spotImages';
import { averageRating } from '@/lib/rating';
import { SWIPE_THRESHOLDS } from '@/lib/constants';
import PanelShell from '../ui/PanelShell';
import SpotHero from './SpotHero';
import Gallery from './Gallery';
import { AdminStatusCard, DeleteSpotButton } from './AdminActions';
import SpotTitle from './SpotTitle';
import SpotLocation from './SpotLocation';
import EditForm from './EditForm';
import ImageManager from './ImageManager';
import CreatorInfo from './CreatorInfo';
import ReviewsSection from './ReviewsSection';
import { useSpotEdit } from './useSpotEdit';
import { useSpotHighlight } from './useSpotHighlight';

interface SpotDetailsPanelProps {
  spot: Spot | null;
  onClose: () => void;
}

/**
 * Full-screen spot details (T28 split). Always mounted by page.tsx; renders nothing without a spot.
 * Owns the state that spans several children: edit (title + form), highlight (hero + title) and
 * whether the gallery is open. The children own the rest and unmount while no spot is shown.
 */
export default function SpotDetailsPanel({ spot, onClose }: Readonly<SpotDetailsPanelProps>) {
  const user = useUserStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const t = useT();
  const edit = useSpotEdit(spot);

  // The spot whose gallery is open. Dropped during render when another spot (or none) is shown
  // (BUG-26), so a gallery never carries over to the next spot.
  const [galleryFor, setGalleryFor] = useState<string | null>(null);
  if (galleryFor !== null && galleryFor !== spot?.id) setGalleryFor(null);
  const galleryOpen = galleryFor !== null && galleryFor === spot?.id;
  const spotId = spot?.id;
  const openGallery = useCallback(() => setGalleryFor(spotId ?? null), [spotId]);
  const closeGallery = useCallback(() => setGalleryFor(null), []);

  // Swipe to dismiss the panel (either direction)
  const panelSwipe = useSwipeToClose({ onClose, threshold: SWIPE_THRESHOLDS.spotDetails, direction: 'both' });

  // Live store copy of the open spot (the `spot` prop is a snapshot, see T29). Used only for the
  // highlight and gallery derivations.
  const fresh = useSpotStore((s) => (spot ? s.spots.find((x) => x.id === spot.id) : undefined)) ?? spot;
  const highlight = useSpotHighlight(fresh);

  if (!spot || !fresh) return null;

  // Sorted gallery images. Legacy spots are materialised in memory only (never written on read).
  const sortedSpotImages = sortSpotImagesByLikes(getSpotImages(fresh), 'missingAsZero');
  const allGalleryImages = getGalleryUrls(fresh, sortedSpotImages);
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
      swipe={panelSwipe}
      overlays={
        <Gallery urls={allGalleryImages} open={galleryOpen} startIndex={0} onClose={closeGallery} alt={spot.name} />
      }
    >
        <SpotHero
          spot={spot}
          heroImageUrl={heroImageUrl}
          imageCount={allGalleryImages.length}
          onOpenGallery={openGallery}
          onClose={onClose}
          highlight={highlight}
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pointer-events-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          <div className="space-y-6">
            {isAdmin && <AdminStatusCard spot={spot} onClose={onClose} />}

            <SpotTitle
              spot={spot}
              avgRating={avgRating}
              canEdit={canEdit}
              edit={edit}
              isHighlightedByUser={highlight.isHighlightedByUser}
            />

            <SpotLocation location={spot.location} navigationUrl={navigationUrl} />

            {/* Description / Edit form */}
            {edit.isEditing ? (
              <EditForm edit={edit} />
            ) : spot.description ? (
              <div>
                <h2 className="text-xl font-bold text-white mb-3">{t('description')}</h2>
                <p className="text-white/80 leading-relaxed">{spot.description}</p>
              </div>
            ) : null}

            {/* Manage images (owner/admin); keyed so its toggle resets for another spot */}
            {canEdit && <ImageManager key={spot.id} spot={spot} imageCount={allGalleryImages.length} />}

            {isAdmin && <DeleteSpotButton spot={spot} onClose={onClose} />}

            <CreatorInfo spot={spot} />

            <ReviewsSection spot={spot} />

            {/* CTA */}
            <a
              href={navigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl font-semibold text-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" /> {t('getDirections')}
            </a>

            <div className="h-20" />
          </div>
        </div>
    </PanelShell>
  );
}
