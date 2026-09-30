import { useState } from 'react';
import { useSpotStore, type Spot, type SpotCategory, type SpotFieldsPatch } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useUserStore } from '@/store/useUserStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useT } from '@/hooks/useT';
import { editRoute } from '@/lib/moderation';

export interface SpotEdit {
  /** How a save lands (lib/moderation editRoute); null: this user cannot edit the spot. */
  route: 'direct' | 'propose' | null;
  isEditing: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editCategory: SpotCategory;
  setEditCategory: (value: SpotCategory) => void;
  /** Enter edit mode with the spot's current name, description and category. */
  start: () => void;
  cancel: () => void;
  /** Saves the changed fields directly, or proposes them for review (item 4), and toasts it. */
  save: () => Promise<void>;
}

interface Draft {
  spotId: string;
  name: string;
  description: string;
  category: SpotCategory;
  /** The values when editing started: a save compares against them. */
  base: { name: string; description: string; category: SpotCategory };
}

/** The fields the user changed since editing started (a blank name is never saved). */
function changedFields(draft: Draft): SpotFieldsPatch {
  const out: SpotFieldsPatch = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name && name !== draft.base.name) out.name = name;
  if (description !== draft.base.description) out.description = description;
  if (draft.category !== draft.base.category) out.category = draft.category;
  return out;
}

/**
 * Name/description/category edit state for the shown spot (T28, item 4). Owned by the panel shell
 * because it spans two DOM places (SpotTitle's input and EditForm). The draft resets whenever the
 * shown spot changes, so it never carries over to (or is saved onto) another spot. A field changed
 * remotely meanwhile is not overwritten unless the user edited it.
 */
export function useSpotEdit(spot: Spot | null): SpotEdit {
  const updateSpotFields = useSpotStore((s) => s.updateSpotFields);
  const proposeEdit = useModerationStore((s) => s.proposeEdit);
  const uid = useUserStore((s) => s.user?.uid);
  const isAdmin = useIsAdmin();
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();

  // Dropped during render when another spot (or none) is shown (React's "adjust state on prop
  // change" pattern, guarded by the draft itself), so no frame shows the previous spot's draft.
  const [draft, setDraft] = useState<Draft | null>(null);
  if (draft && draft.spotId !== spot?.id) setDraft(null);
  const current = draft && draft.spotId === spot?.id ? draft : null;
  const route = spot ? editRoute(spot, uid, isAdmin) : null;
  const patch = (fields: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...fields } : d));

  const start = () => {
    if (!spot) return;
    const base = { name: spot.name, description: spot.description ?? '', category: spot.category };
    setDraft({ spotId: spot.id, ...base, base });
  };

  const save = async () => {
    if (!spot || !current || !route) return;
    const changed = changedFields(current);
    try {
      if (Object.keys(changed).length === 0) {
        setDraft(null);
        return;
      }
      if (route === 'propose') {
        if (await proposeEdit(spot, changed)) showToast(t('editSentForReview'), 'success');
      } else {
        await updateSpotFields(spot.id, changed);
        showToast(t('spotUpdated'), 'success');
      }
      setDraft(null);
    } catch {
      showToast(t('updateError'), 'error');
    }
  };

  return {
    route,
    isEditing: current !== null,
    editName: current?.name ?? '',
    setEditName: (name) => patch({ name }),
    editDescription: current?.description ?? '',
    setEditDescription: (description) => patch({ description }),
    editCategory: current?.category ?? spot?.category ?? 'other',
    setEditCategory: (category) => patch({ category }),
    start,
    cancel: () => setDraft(null),
    save,
  };
}
