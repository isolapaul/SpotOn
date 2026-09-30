import { useSpotStore } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useUserStore } from '@/store/useUserStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useT } from '@/hooks/useT';
import { editRoute } from '@/lib/moderation';

/**
 * Saves a spot's new location picked on the map (the edit form's "Change location"): directly for
 * admins and for the owner of a spot under review, as a proposal for the owner of an approved spot.
 */
export function useRelocateSpot(): (spotId: string, location: { lat: number; lng: number }) => Promise<void> {
  const uid = useUserStore((s) => s.user?.uid);
  const isAdmin = useIsAdmin();
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();

  return async (spotId, location) => {
    const spot = useSpotStore.getState().spots.find((s) => s.id === spotId);
    const route = spot ? editRoute(spot, uid, isAdmin) : null;
    if (!spot || !route) return;
    try {
      if (route === 'propose') {
        if (await useModerationStore.getState().proposeEdit(spot, { location })) showToast(t('editSentForReview'), 'success');
      } else {
        await useSpotStore.getState().updateSpotFields(spotId, { location });
        showToast(t('locationUpdated'), 'success');
      }
    } catch {
      showToast(t('updateError'), 'error');
    }
  };
}
