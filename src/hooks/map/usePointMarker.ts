import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { PIN_ANCHOR } from '@/lib/mapMarkers';

/** The pin's tip is the spot's coordinate (PIN_ANCHOR inside the 44×54 pin box). */
export const PIN_OFFSET: [number, number] = [-PIN_ANCHOR[0], -PIN_ANCHOR[1]];

export const USER_PUCK_HTML =
  '<span class="user-puck" aria-hidden="true"><span class="user-puck__halo"></span><span class="user-puck__dot"></span></span>';

// The location picked while adding a spot: a brand pin with a plus, dropped in once.
export const DRAFT_PIN_HTML =
  '<div class="draft-pin" aria-hidden="true"><svg width="44" height="54" viewBox="0 0 44 54">' +
  '<ellipse cx="22" cy="50.6" rx="6" ry="2" fill="#000" opacity=".22"/>' +
  '<path d="M22 50C20.6 45.5 18 41.8 14.9 36.5A18 18 0 1 1 29.1 36.5C26 41.8 23.4 45.5 22 50Z" fill="#12814F" stroke="#fff" stroke-width="3"/>' +
  '<path d="M22 13v14M15 20h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg></div>';

export function htmlElement(className: string, html: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  return el;
}

/** One map marker at a point, created and removed with the value (the user dot, the draft pin). */
export function usePointMarker(
  map: mapboxgl.Map | null,
  point: { lat: number; lng: number } | null | undefined,
  make: () => mapboxgl.Marker,
) {
  const marker = useRef<mapboxgl.Marker | null>(null);
  const has = !!point;
  useEffect(() => {
    if (!map || !has) return;
    marker.current = make().setLngLat([0, 0]).addTo(map);
    return () => {
      marker.current?.remove();
      marker.current = null;
    };
    // `make` is a constant factory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, has]);
  useEffect(() => {
    if (point) marker.current?.setLngLat([point.lng, point.lat]);
  }, [point, map, has]);
}
