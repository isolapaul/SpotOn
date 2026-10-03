import { useState, type ChangeEvent } from 'react';
import type { SpotCategory } from '@/store/useSpotStore';
import { checkDraftImages, primaryAfterRemoval } from '@/lib/draftImages';
import type { TranslationKey } from '@/lib/translations';

export interface DraftFields {
  name: string;
  category: SpotCategory;
  description: string;
}

const EMPTY_FIELDS: DraftFields = { name: '', category: 'scenic', description: '' };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export interface SpotDraft {
  fields: DraftFields;
  setField: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  images: File[];
  previews: string[];
  primaryIndex: number;
  setPrimaryIndex: (index: number) => void;
  /** Adds the picked files (after the count and size checks) with their previews. */
  addImages: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeImage: (index: number) => void;
  /** The message key of the last refused action; null when there is none. */
  error: TranslationKey | null;
  setError: (key: TranslationKey | null) => void;
  reset: () => void;
}

/** Form state of the add-spot sheet: fields, picked photos with previews, the primary photo, the error. */
export function useSpotDraft(): SpotDraft {
  const [fields, setFields] = useState<DraftFields>(EMPTY_FIELDS);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);

  const setField: SpotDraft['setField'] = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const addImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const { accepted, error: refused } = checkDraftImages(images.length, Array.from(e.target.files ?? []));
    if (accepted.length === 0) {
      if (refused) setError(refused);
      return;
    }
    const added = await Promise.all(accepted.map(readAsDataUrl));
    setImages((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...added]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setPrimaryIndex((prev) => primaryAfterRemoval(prev, index));
  };

  const reset = () => {
    setFields(EMPTY_FIELDS);
    setImages([]);
    setPreviews([]);
    setPrimaryIndex(0);
    setError(null);
  };

  return { fields, setField, images, previews, primaryIndex, setPrimaryIndex, addImages, removeImage, error, setError, reset };
}
