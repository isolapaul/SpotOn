import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { Spot } from '@/store/useSpotStore';
import { LOCATE_ZOOM, SPOT_FOCUS } from '@/lib/constants';
import type { Latest } from './useMapInstance';

export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Pans the map to the user's location once when it becomes available, and again (a smooth fly) on
// every locate request; a request made before the location is known is served when it arrives.
export function useLocationPanner(map: mapboxgl.Map | null, userLocation: { lat: number; lng: number } | null, locateRequest: number) {
  const panned = useRef(false);
  const servedRequest = useRef(locateRequest);
  useEffect(() => {
    if (!map || !userLocation) return;
    const center: [number, number] = [userLocation.lng, userLocation.lat];
    if (!panned.current) {
      panned.current = true;
      servedRequest.current = locateRequest;
      map.easeTo({ center, zoom: LOCATE_ZOOM, animate: !prefersReducedMotion() });
    } else if (locateRequest !== servedRequest.current) {
      servedRequest.current = locateRequest;
      map.flyTo({ center, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 800, essential: false });
    }
  }, [userLocation, locateRequest, map]);
}

// Flies to a focused spot (opened from the profile) and reports the arrival, once per request. The spot
// lands a little above the centre, clear of the place card; reduced motion jumps instead of flying.
export function useSpotFocuser(
  map: mapboxgl.Map | null,
  focus: { spotId: string; seq: number } | null,
  spots: Spot[],
  latest: Latest,
) {
  const served = useRef(0);
  // Only the target matters: a spots snapshot during the flight must not restart or cancel it.
  const target = focus ? spots.find((s) => s.id === focus.spotId)?.location ?? null : null;
  const lat = target?.lat;
  const lng = target?.lng;

  useEffect(() => {
    if (!map || !focus || focus.seq === served.current || lat === undefined || lng === undefined) return;
    served.current = focus.seq;
    const zoom = Math.max(map.getZoom(), SPOT_FOCUS.zoom);
    let done = false;
    const arrive = () => {
      if (done) return;
      done = true;
      latest.current.onSpotArrive?.(focus.spotId);
    };
    if (prefersReducedMotion()) {
      map.jumpTo({ center: [lng, lat], zoom });
      map.panBy([0, SPOT_FOCUS.liftPx], { animate: false });
      arrive();
      return;
    }
    // flyTo first: it stops a running ease, which fires a moveend at once; only the flight's own
    // moveend means arrival.
    map.flyTo({ center: [lng, lat], zoom, offset: [0, -SPOT_FOCUS.liftPx], duration: SPOT_FOCUS.durationS * 1000, essential: true });
    map.once('moveend', arrive);
    const fallback = setTimeout(arrive, SPOT_FOCUS.fallbackMs);
    return () => {
      clearTimeout(fallback);
      map.off('moveend', arrive);
    };
  }, [focus, lat, lng, map, latest]);
}
