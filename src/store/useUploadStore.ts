import { create } from 'zustand';
import { translate } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/translations';
import { DELAYS } from '@/lib/constants';
import { uploadErrorKey } from '@/lib/uploadErrors';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';
import { usePushPromptStore } from '@/store/usePushPromptStore';
import type { NewReview } from '@/store/useSpotStore';
import {
  appendReview,
  attachSpotImages,
  buildReview,
  createSpot,
  newSpotId,
  uploadSpotImages,
  type NewSpotFields,
  type UploadedImage,
} from '@/store/spotUploads';

/**
 * Background uploads (G4): creating a spot, adding photos, and a review with photos run here while
 * the user keeps using the app. UploadStatus shows the state; the result also lands in the
 * notification center. Jobs live in memory only: closing the app drops a running upload (agreed).
 * Each job's task remembers the steps it finished, so Retry continues where it failed.
 */
export type UploadKind = 'spot' | 'photos' | 'review';

export interface UploadJob {
  id: string;
  kind: UploadKind;
  /** Spot name shown in the status pill. */
  label: string;
  /** Target spot (photos / review), to block a second submit while one runs. */
  spotId?: string;
  status: 'running' | 'failed' | 'done';
  /** Message key of the last failure. */
  errorKey?: TranslationKey;
}

interface JobSpec {
  kind: UploadKind;
  label: string;
  spotId?: string;
  doneKey: TranslationKey;
  /** Generic failure text; a multi-step task may switch it per step. */
  failKey: TranslationKey;
}

interface UploadStore {
  jobs: UploadJob[];
  retry: (id: string) => void;
  dismiss: (id: string) => void;
  submitSpot: (input: {
    fields: NewSpotFields;
    files: File[];
    primaryIndex: number;
    userId: string;
    isAdmin: boolean;
  }) => void;
  submitPhotos: (input: { spotId: string; spotName: string; files: File[]; userId: string }) => void;
  /** A review and/or photos in one go (either may be missing, not both). */
  submitReview: (input: {
    spotId: string;
    spotName: string;
    review: NewReview | null;
    files: File[];
    userId: string;
  }) => void;
}

// Not state: closures with File objects and the steps' progress.
const tasks = new Map<string, { spec: JobSpec; run: () => Promise<void> }>();
let seq = 0;

function text(key: TranslationKey): string {
  return translate(useLanguageStore.getState().language ?? 'hu', key);
}

export const useUploadStore = create<UploadStore>((set, get) => {
  const patch = (id: string, fields: Partial<UploadJob>) =>
    set((state) => ({ jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...fields } : job)) }));
  const remove = (id: string) => {
    tasks.delete(id);
    set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) }));
  };

  const execute = (id: string) => {
    const task = tasks.get(id);
    if (!task) return;
    patch(id, { status: 'running', errorKey: undefined });
    task.run().then(
      () => {
        patch(id, { status: 'done' });
        useToastStore.getState().showToast(text(task.spec.doneKey), 'success');
        usePushPromptStore.getState().request();
        setTimeout(() => {
          if (get().jobs.find((job) => job.id === id)?.status === 'done') remove(id);
        }, DELAYS.uploadDoneVisible);
      },
      (error: unknown) => {
        console.error(`Upload (${task.spec.kind}) failed:`, error);
        const errorKey = uploadErrorKey(error, task.spec.failKey);
        patch(id, { status: 'failed', errorKey });
        useToastStore.getState().showToast(text(errorKey), 'error');
      },
    );
  };

  const start = (spec: JobSpec, run: () => Promise<void>) => {
    seq += 1;
    const id = `upload_${Date.now()}_${seq}`;
    tasks.set(id, { spec, run });
    set((state) => ({
      jobs: [...state.jobs, { id, kind: spec.kind, label: spec.label, spotId: spec.spotId, status: 'running' }],
    }));
    execute(id);
  };

  return {
    jobs: [],

    retry: (id) => {
      if (get().jobs.find((job) => job.id === id)?.status === 'failed') execute(id);
    },

    dismiss: (id) => {
      if (get().jobs.find((job) => job.id === id)?.status !== 'running') remove(id);
    },

    submitSpot: ({ fields, files, primaryIndex, userId, isAdmin }) => {
      const spotId = newSpotId();
      let uploaded: UploadedImage[] | null = null;
      start(
        { kind: 'spot', label: fields.name, doneKey: 'spotUploaded', failKey: 'spotUploadFailed' },
        async () => {
          uploaded ??= await uploadSpotImages(files, userId);
          await createSpot(spotId, fields, uploaded, primaryIndex, userId, isAdmin);
        },
      );
    },

    submitPhotos: ({ spotId, spotName, files, userId }) => {
      let urls: string[] | null = null;
      start(
        { kind: 'photos', label: spotName, spotId, doneKey: 'spotPhotosAdded', failKey: 'spotPhotoAddError' },
        async () => {
          urls ??= (await uploadSpotImages(files, userId)).map((u) => u.url);
          await attachSpotImages(spotId, urls);
        },
      );
    },

    submitReview: ({ spotId, spotName, review, files, userId }) => {
      const stored = review ? buildReview(review) : null;
      let urls: string[] | null = null;
      let photosAttached = files.length === 0;
      const spec: JobSpec = {
        kind: 'review',
        label: spotName,
        spotId,
        doneKey: stored && files.length > 0 ? 'reviewAndPhotosAdded' : stored ? 'reviewAdded' : 'spotPhotosAdded',
        failKey: stored ? 'reviewError' : 'spotPhotoAddError',
      };
      start(spec, async () => {
        // The failure text follows the step that failed.
        if (!photosAttached) {
          spec.failKey = 'spotPhotoAddError';
          urls ??= (await uploadSpotImages(files, userId)).map((u) => u.url);
          await attachSpotImages(spotId, urls);
          photosAttached = true;
        }
        if (stored) {
          spec.failKey = 'reviewError';
          await appendReview(spotId, stored);
        }
      });
    },
  };
});

/** Whether a photos/review job for this spot is still running (blocks a second submit). */
export function isSpotUploadRunning(jobs: UploadJob[], spotId: string): boolean {
  return jobs.some((job) => job.spotId === spotId && job.status === 'running');
}
