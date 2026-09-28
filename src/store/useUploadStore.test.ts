import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/store/spotUploads', () => ({
  newSpotId: vi.fn(() => 'new-spot-id'),
  uploadSpotImages: vi.fn(),
  createSpot: vi.fn(),
  attachSpotImages: vi.fn(),
  appendReview: vi.fn(),
  buildReview: vi.fn((r: object) => ({ ...r, id: 'review-id' })),
}));
const showToast = vi.fn();
vi.mock('@/store/useToastStore', () => ({ useToastStore: { getState: () => ({ showToast }) } }));
const request = vi.fn();
vi.mock('@/store/usePushPromptStore', () => ({ usePushPromptStore: { getState: () => ({ request }) } }));

import * as steps from '@/store/spotUploads';
import { TIMEOUT } from '@/lib/withTimeout';
import { useUploadStore, isSpotUploadRunning } from './useUploadStore';

const store = () => useUploadStore.getState();
const flush = () => new Promise((r) => setTimeout(r, 0));
const file = (name: string) => ({ name }) as unknown as File;
const uploaded = [{ url: 'https://u/1', spotImage: { id: 'i1' } }];
const fields = {
  name: 'Sunset', category: 'scenic', description: '', location: { lat: 1, lng: 2 }, createdBy: 'u1',
} as unknown as Parameters<ReturnType<typeof store>['submitSpot']>[0]['fields'];

describe('useUploadStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUploadStore.setState({ jobs: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.useRealTimers());

  it('a spot uploads its photos, then creates the doc; success toasts, asks for push, then clears', async () => {
    vi.useFakeTimers();
    vi.mocked(steps.uploadSpotImages).mockResolvedValue(uploaded as never);
    vi.mocked(steps.createSpot).mockResolvedValue();
    store().submitSpot({ fields, files: [file('a')], primaryIndex: 0, userId: 'u1', isAdmin: false });
    expect(store().jobs).toMatchObject([{ kind: 'spot', label: 'Sunset', status: 'running' }]);

    await vi.advanceTimersByTimeAsync(0);
    expect(steps.createSpot).toHaveBeenCalledWith('new-spot-id', fields, uploaded, 0, 'u1', false);
    expect(store().jobs[0].status).toBe('done');
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'success');
    expect(request).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2500);
    expect(store().jobs).toEqual([]);
  });

  it('a timeout fails with the timeout text; Retry reuses the uploaded photos and the same spot id', async () => {
    vi.mocked(steps.uploadSpotImages).mockResolvedValue(uploaded as never);
    vi.mocked(steps.createSpot).mockRejectedValueOnce(new Error(TIMEOUT)).mockResolvedValueOnce();
    store().submitSpot({ fields, files: [file('a')], primaryIndex: 0, userId: 'u1', isAdmin: false });
    await flush();
    expect(store().jobs[0]).toMatchObject({ status: 'failed', errorKey: 'uploadTimeout' });
    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(request).not.toHaveBeenCalled();

    store().retry(store().jobs[0].id);
    await flush();
    expect(steps.uploadSpotImages).toHaveBeenCalledTimes(1);
    expect(vi.mocked(steps.createSpot).mock.calls.map((c) => c[0])).toEqual(['new-spot-id', 'new-spot-id']);
    expect(store().jobs[0].status).toBe('done');
  });

  it('review with photos: photos first, then the review; a review failure does not re-send the photos', async () => {
    vi.mocked(steps.uploadSpotImages).mockResolvedValue(uploaded as never);
    vi.mocked(steps.attachSpotImages).mockResolvedValue();
    vi.mocked(steps.appendReview).mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce();
    const review = { userId: 'u1', userName: 'me', rating: 5, comment: 'nice' };
    store().submitReview({ spotId: 's1', spotName: 'Sunset', review, files: [file('a')], userId: 'u1' });
    expect(isSpotUploadRunning(store().jobs, 's1')).toBe(true);
    await flush();
    expect(store().jobs[0]).toMatchObject({ status: 'failed', errorKey: 'reviewError' });
    expect(isSpotUploadRunning(store().jobs, 's1')).toBe(false);

    store().retry(store().jobs[0].id);
    await flush();
    expect(steps.attachSpotImages).toHaveBeenCalledTimes(1);
    expect(steps.appendReview).toHaveBeenCalledTimes(2);
    expect(vi.mocked(steps.appendReview).mock.calls[1]).toEqual(['s1', { ...review, id: 'review-id' }]);
    expect(store().jobs[0].status).toBe('done');
  });

  it('a failing photo step reports the photo error, not the review error', async () => {
    vi.mocked(steps.uploadSpotImages).mockResolvedValue(uploaded as never);
    vi.mocked(steps.attachSpotImages).mockRejectedValue(new Error('internal'));
    const review = { userId: 'u1', userName: 'me', rating: 5, comment: '' };
    store().submitReview({ spotId: 's1', spotName: 'Sunset', review, files: [file('a')], userId: 'u1' });
    await flush();
    expect(store().jobs[0]).toMatchObject({ status: 'failed', errorKey: 'spotPhotoAddError' });
    expect(steps.appendReview).not.toHaveBeenCalled();
  });

  it('photos only (no review) never writes a review; a running job cannot be dismissed', async () => {
    vi.mocked(steps.uploadSpotImages).mockReturnValue(new Promise(() => {}));
    store().submitReview({ spotId: 's1', spotName: 'Sunset', review: null, files: [file('a')], userId: 'u1' });
    store().dismiss(store().jobs[0].id);
    expect(store().jobs).toHaveLength(1);
    expect(steps.appendReview).not.toHaveBeenCalled();
  });

  it('the image limit has its own text; a failed job can be dismissed', async () => {
    vi.mocked(steps.uploadSpotImages).mockResolvedValue(uploaded as never);
    vi.mocked(steps.attachSpotImages).mockRejectedValue(new Error('MAX_SPOT_IMAGES'));
    store().submitPhotos({ spotId: 's1', spotName: 'Sunset', files: [file('a')], userId: 'u1' });
    await flush();
    expect(store().jobs[0]).toMatchObject({ status: 'failed', errorKey: 'maxSpotImages' });
    store().dismiss(store().jobs[0].id);
    expect(store().jobs).toEqual([]);
  });
});
