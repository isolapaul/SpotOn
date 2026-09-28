import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEOLOCATION_TIMEOUT_MS, LOCATION_CACHE_MAX_AGE_MS } from '@/lib/constants';
import { useLocationStore } from './useLocationStore';

type Success = (p: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (e: unknown) => void;

let getCurrentPosition: ReturnType<typeof vi.fn>;
let storage: Map<string, string>;

/** Resolves the n-th getCurrentPosition call with a position. */
const succeed = (n: number, lat: number, lng: number) =>
  (getCurrentPosition.mock.calls[n][0] as Success)({ coords: { latitude: lat, longitude: lng } });
/** Fails the n-th getCurrentPosition call. */
const fail = (n: number) => (getCurrentPosition.mock.calls[n][1] as Failure)({ code: 1 });
const state = () => useLocationStore.getState();

function stubSessionStorage() {
  storage = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
}

beforeEach(() => {
  useLocationStore.setState({ status: 'idle', location: null, autoRequested: false });
  getCurrentPosition = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  stubSessionStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('requestAutomatic', () => {
  it('uses a cache younger than 10 min without a geolocation call', () => {
    storage.set('userLocation', JSON.stringify({ lat: 1, lng: 2 }));
    storage.set('userLocationTime', String(Date.now() - LOCATION_CACHE_MAX_AGE_MS + 5_000));
    state().requestAutomatic();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 1, lng: 2 } });
  });

  it('ignores an expired cache and requests with the automatic options', () => {
    storage.set('userLocation', JSON.stringify({ lat: 1, lng: 2 }));
    storage.set('userLocationTime', String(Date.now() - LOCATION_CACHE_MAX_AGE_MS - 1));
    state().requestAutomatic();
    expect(state().status).toBe('pending');
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: LOCATION_CACHE_MAX_AGE_MS,
    });
  });

  it('cache miss: success grants the location and writes the cache', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    state().requestAutomatic();
    succeed(0, 47.5, 19.04);
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 47.5, lng: 19.04 } });
    expect(JSON.parse(storage.get('userLocation')!)).toEqual({ lat: 47.5, lng: 19.04 });
    expect(storage.get('userLocationTime')).toBe('1000000');
  });

  it('error (including timeout) → denied, location null', () => {
    state().requestAutomatic();
    fail(0);
    expect(state()).toMatchObject({ status: 'denied', location: null });
    expect(storage.size).toBe(0);
  });

  it('runs once: a second call makes no second request', () => {
    state().requestAutomatic();
    state().requestAutomatic();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(state().autoRequested).toBe(true);
  });

  it('a late automatic error does not override a manual success', async () => {
    state().requestAutomatic();
    const manual = state().request();
    succeed(1, 3, 4);
    await expect(manual).resolves.toBe('granted');
    fail(0);
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 3, lng: 4 } });
  });

  it('without navigator.geolocation: no request, status stays idle, never retried', () => {
    vi.stubGlobal('navigator', {});
    state().requestAutomatic();
    expect(state()).toMatchObject({ status: 'idle', location: null, autoRequested: true });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    state().requestAutomatic();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('request (manual)', () => {
  it('passes the manual options (high accuracy, no maximumAge)', () => {
    void state().request();
    const options = getCurrentPosition.mock.calls[0][2];
    expect(options).toEqual({ enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS });
    expect(options).not.toHaveProperty('maximumAge');
  });

  it('never sets pending', () => {
    void state().request();
    expect(state().status).toBe('idle');
  });

  it('success grants, writes the cache and resolves granted', async () => {
    const result = state().request();
    succeed(0, 5, 6);
    await expect(result).resolves.toBe('granted');
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 5, lng: 6 } });
    expect(JSON.parse(storage.get('userLocation')!)).toEqual({ lat: 5, lng: 6 });
    expect(storage.has('userLocationTime')).toBe(true);
  });

  it('error after a success keeps the location and granted, resolves denied', async () => {
    const first = state().request();
    succeed(0, 5, 6);
    await first;
    const second = state().request();
    fail(1);
    await expect(second).resolves.toBe('denied');
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 5, lng: 6 } });
  });

  it('error after an automatic denial keeps denied and a null location (default-centre dot)', async () => {
    state().requestAutomatic();
    fail(0);
    const result = state().request();
    fail(1);
    await expect(result).resolves.toBe('denied');
    expect(state()).toMatchObject({ status: 'denied', location: null });
  });

  it('success after an automatic denial grants the location', async () => {
    state().requestAutomatic();
    fail(0);
    const result = state().request();
    succeed(1, 7, 8);
    await expect(result).resolves.toBe('granted');
    expect(state()).toMatchObject({ status: 'granted', location: { lat: 7, lng: 8 } });
  });

  it('without navigator.geolocation resolves unsupported and leaves the store unchanged', async () => {
    vi.stubGlobal('navigator', {});
    await expect(state().request()).resolves.toBe('unsupported');
    expect(state()).toMatchObject({ status: 'idle', location: null, autoRequested: false });
    expect(storage.size).toBe(0);
  });
});
