import { useCallback, useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { SITE_URL } from '@/lib/constants';
import { spotLink } from '@/lib/spotLinks';
import { averageRating } from '@/lib/rating';
import { useToastStore } from '@/store/useToastStore';
import { track } from '@/store/telemetry';
import { useCategoryLabel } from './useCategory';
import { useLanguage, useT } from './useT';
import { shareSpotCard } from './shareCard';

/** "Share as image" (growth plan §6): the story card through the share sheet, else a download. */
export function useShareSpotCard() {
  const t = useT();
  const language = useLanguage();
  const categoryLabel = useCategoryLabel();
  const [busy, setBusy] = useState(false);
  const share = useCallback(async (spot: Spot) => {
    if (busy) return;
    setBusy(true);
    try {
      const url = spotLink(SITE_URL, spot.id);
      const count = spot.reviews?.length ?? 0;
      const avg = averageRating(spot.reviews);
      const rating = count > 0
        ? t('cardRating', { rating: language === 'en' ? avg.toFixed(1) : avg.toFixed(1).replace('.', ','), count })
        : '';
      const outcome = await shareSpotCard(spot, {
        category: categoryLabel(spot.category),
        rating,
        cta: t('cardCta'),
        link: url.replace(/^https:\/\//, ''),
      }, url);
      if (outcome !== 'cancelled') track('share_card');
      if (outcome === 'downloaded') useToastStore.getState().showToast(t('cardDownloaded'), 'success');
    } catch (error) {
      console.error('Share card failed:', error);
      useToastStore.getState().showToast(t('genericError'), 'error');
    } finally {
      setBusy(false);
    }
  }, [busy, t, language, categoryLabel]);
  return { share, busy };
}
