import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Spot } from '@/store/useSpotStore';
import type { CategoryIconId } from '@/lib/categoryIcons';
import type { useT } from '@/hooks/useT';
import { buildPinHtml, markerVariant } from '@/lib/mapMarkers';
import { normalizePinIcon } from '@/lib/pinGlyphs';
import { normalizeCategory } from '@/lib/categoryGlyphs';
import type { Latest } from './useMapInstance';
import { PIN_OFFSET } from './usePointMarker';

interface SpotMarker {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
  /** The pin's look; the markup is rebuilt only when it changes. */
  key: string;
}

/**
 * Spot markers: kept by id; only a changed look rebuilds a pin's markup, only a move re-positions it.
 * A map going away (unmount, or a rebuilt map) drops its markers, so the new map gets its own.
 */
export function useSpotMarkers(
  map: mapboxgl.Map | null,
  shownSpots: Spot[],
  customIcons: ReadonlyMap<string, CategoryIconId | null>,
  selectedSpotId: string | null,
  nowIso: string,
  lockedIds: ReadonlySet<string> | undefined,
  t: ReturnType<typeof useT>,
  latest: Latest,
) {
  const markers = useRef(new Map<string, SpotMarker>());
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    shownSpots.forEach((spot, index) => {
      seen.add(spot.id);
      const highlighted = (spot.highlighted || []).some((h) => h.expiresAt > nowIso);
      const look = {
        category: spot.category,
        categoryIcon: customIcons.get(spot.category) ?? null,
        variant: markerVariant(spot.status),
        highlighted,
        pin: normalizePinIcon(spot.ownerPin),
      };
      const key = `${normalizeCategory(look.category)}|${look.categoryIcon ?? ''}|${look.variant}|${highlighted ? 1 : 0}|${look.pin ?? ''}`;
      let entry = markers.current.get(spot.id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = 'spot-marker';
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        // Pins land one after another (a short cascade, capped), not all at once.
        el.style.setProperty('--pin-delay', `${Math.min(index, 24) * 22}ms`);
        const open = (e: Event) => {
          e.stopPropagation();
          latest.current.onSpotPreview?.(spot.id);
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') open(e);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'top-left', offset: PIN_OFFSET })
          .setLngLat([spot.location.lng, spot.location.lat])
          .addTo(map);
        entry = { marker, el, key: '' };
        markers.current.set(spot.id, entry);
      } else {
        const at = entry.marker.getLngLat();
        if (at.lat !== spot.location.lat || at.lng !== spot.location.lng) {
          entry.marker.setLngLat([spot.location.lng, spot.location.lat]);
        }
      }
      if (entry.key !== key) {
        entry.el.innerHTML = buildPinHtml(look);
        entry.key = key;
      }
      const locked = lockedIds?.has(spot.id) ?? false;
      const label = locked ? t('lockedTitle') : spot.name;
      entry.el.title = label;
      entry.el.setAttribute('aria-label', label);
      if (locked) entry.el.dataset.locked = 'true';
      else delete entry.el.dataset.locked;
      entry.el.style.zIndex = spot.id === selectedSpotId ? '3' : highlighted ? '2' : '1';
      const pin = entry.el.querySelector<HTMLElement>('.spot-pin');
      if (pin) {
        if (spot.id === selectedSpotId) pin.dataset.selected = 'true';
        else delete pin.dataset.selected;
      }
    });
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      markers.current.delete(id);
    }
  }, [map, shownSpots, customIcons, selectedSpotId, nowIso, lockedIds, t, latest]);

  // A map going away (unmount, or a rebuilt map): drop its markers, so the new map gets its own.
  useEffect(() => {
    if (!map) return;
    const all = markers.current;
    return () => {
      for (const entry of all.values()) entry.marker.remove();
      all.clear();
    };
  }, [map]);
}
