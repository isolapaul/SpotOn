import { useState } from 'react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

export interface SpotEdit {
  isEditing: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  /** Enter edit mode with the spot's current name and description. */
  start: () => void;
  cancel: () => void;
  /** Saves the changed fields (name, then description) and toasts what changed. */
  save: () => Promise<void>;
}

/**
 * Name/description edit state for the shown spot (T28). Owned by the panel shell because it spans
 * two DOM places (SpotTitle's input and EditForm). Edit mode and the drafts reset whenever the
 * shown spot changes, so a draft never carries over to (or is saved onto) another spot.
 */
export function useSpotEdit(spot: Spot | null): SpotEdit {
  const updateSpotName = useSpotStore((s) => s.updateSpotName);
  const updateSpotDescription = useSpotStore((s) => s.updateSpotDescription);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();

  // The draft remembers which spot it belongs to. When another spot (or none) is shown, it is
  // dropped during render (React's "adjust state on prop change" pattern, guarded by the draft
  // itself), so no frame shows the previous spot's draft and Save can never target another spot.
  // baseName/baseDescription: the values when editing started. Save compares against them, so a
  // field changed remotely meanwhile is not overwritten unless the user edited it.
  const [draft, setDraft] = useState<{
    spotId: string; name: string; description: string; baseName: string; baseDescription: string;
  } | null>(null);
  if (draft && draft.spotId !== spot?.id) setDraft(null);
  const current = draft && draft.spotId === spot?.id ? draft : null;

  const isEditing = current !== null;
  const editName = current?.name ?? '';
  const editDescription = current?.description ?? '';
  const setEditName = (name: string) => setDraft((d) => (d ? { ...d, name } : d));
  const setEditDescription = (description: string) => setDraft((d) => (d ? { ...d, description } : d));

  const start = () => {
    if (!spot) return;
    const description = spot.description ?? '';
    setDraft({ spotId: spot.id, name: spot.name, description, baseName: spot.name, baseDescription: description });
  };

  const cancel = () => setDraft(null);

  const save = async () => {
    if (!spot || !current) return;
    try {
      const nameChanged = !!editName.trim() && editName.trim() !== current.baseName;
      const descChanged = editDescription.trim() !== current.baseDescription;
      if (nameChanged) await updateSpotName(spot.id, editName.trim());
      if (descChanged) await updateSpotDescription(spot.id, editDescription.trim());
      setDraft(null);
      if (nameChanged && descChanged) showToast(t('spotUpdated'), 'success');
      else if (nameChanged) showToast(t('nameUpdated'), 'success');
      else if (descChanged) showToast(t('descriptionUpdated'), 'success');
    } catch {
      showToast(t('updateError'), 'error');
    }
  };

  return { isEditing, editName, setEditName, editDescription, setEditDescription, start, cancel, save };
}
