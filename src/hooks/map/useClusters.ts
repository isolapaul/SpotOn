import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import Supercluster, { type ClusterFeature } from 'supercluster';
import type { Spot } from '@/store/useSpotStore';
import { buildClusterHtml, CLUSTER_MAX_ZOOM, CLUSTER_RADIUS } from '@/lib/mapMarkers';
import { prefersReducedMotion } from './useMapCamera';

/** The current time as an ISO string, refreshed every minute (highlight expiry; stable between renders). */
export function useMinuteClock(): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export interface MapViewState {
  zoom: number;
  bbox: [number, number, number, number];
}

/** The visible area and zoom, updated when a move ends (clusters are recomputed then). */
export function useMapView(map: mapboxgl.Map | null): MapViewState | null {
  const [view, setView] = useState<MapViewState | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const b = map.getBounds();
      if (!b) return;
      // A margin, so pins just outside the screen are ready when panning.
      const padLng = (b.getEast() - b.getWest()) * 0.25;
      const padLat = (b.getNorth() - b.getSouth()) * 0.25;
      setView({
        zoom: map.getZoom(),
        bbox: [b.getWest() - padLng, b.getSouth() - padLat, b.getEast() + padLng, b.getNorth() + padLat],
      });
    };
    update();
    map.on('moveend', update);
    map.on('resize', update);
    return () => {
      map.off('moveend', update);
      map.off('resize', update);
    };
  }, [map]);
  return view;
}

type ClusterProps = { pending: number };
type PointProps = { spotId: string; pending: number };
type ClusterIndex = Supercluster<PointProps, ClusterProps>;

/** Splits the spots into single pins and clusters for the current view. */
export function useClusters(spots: Spot[], view: MapViewState | null, selectedSpotId: string | null, nowIso: string) {
  const index = useMemo(() => {
    const idx: ClusterIndex = new Supercluster<PointProps, ClusterProps>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
      // Mapbox zooms with 512 px tiles.
      extent: 512,
      map: (p) => ({ pending: p.pending }),
      reduce: (acc, p) => {
        acc.pending += p.pending;
      },
    });
    idx.load(
      spots
        .filter((s) => !(s.highlighted || []).some((h) => h.expiresAt > nowIso) && s.id !== selectedSpotId)
        .map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.location.lng, s.location.lat] },
          properties: { spotId: s.id, pending: s.status === 'approved' ? 0 : 1 },
        })),
    );
    return idx;
  }, [spots, selectedSpotId, nowIso]);

  return useMemo(() => {
    if (!view) return { shownSpots: spots, clusters: [], index };
    const features = index.getClusters(view.bbox, Math.floor(view.zoom));
    const single = new Set<string>();
    const clusters: ClusterFeature<ClusterProps>[] = [];
    for (const f of features) {
      if ('cluster' in f.properties && f.properties.cluster) clusters.push(f as ClusterFeature<ClusterProps>);
      else single.add((f.properties as PointProps).spotId);
    }
    const clustered = new Set<string>();
    for (const c of clusters) {
      for (const leaf of index.getLeaves(c.properties.cluster_id, Infinity)) clustered.add(leaf.properties.spotId);
    }
    // Pins outside the view stay (no flicker at the edges); clustered ones are hidden.
    return { shownSpots: spots.filter((s) => !clustered.has(s.id)), clusters, index };
  }, [spots, view, index]);
}

/** Cluster markers: a tap zooms in until the cluster splits. `label` names one for screen readers. */
export function useClusterMarkers(
  map: mapboxgl.Map | null,
  clusters: ClusterFeature<ClusterProps>[],
  index: ClusterIndex,
  label: (count: number) => string,
) {
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; key: string }>());
  const indexRef = useRef(index);
  const labelRef = useRef(label);
  useEffect(() => {
    indexRef.current = index;
    labelRef.current = label;
  });
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    for (const c of clusters) {
      const [lng, lat] = c.geometry.coordinates;
      const id = `${c.properties.cluster_id}`;
      seen.add(id);
      const count = c.properties.point_count;
      const key = `${count}|${c.properties.pending > 0 ? 1 : 0}|${lng}|${lat}`;
      const existing = markers.current.get(id);
      if (existing?.key === key) continue;
      existing?.marker.remove();
      const el = document.createElement('div');
      el.className = 'spot-cluster-marker';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', labelRef.current(count));
      el.innerHTML = buildClusterHtml(count, c.properties.pending > 0);
      const open = (e: Event) => {
        e.stopPropagation();
        let zoom = CLUSTER_MAX_ZOOM + 1;
        try {
          zoom = Math.min(indexRef.current.getClusterExpansionZoom(c.properties.cluster_id), CLUSTER_MAX_ZOOM + 1);
        } catch {
          // The index changed meanwhile: zoom in one step.
          zoom = map.getZoom() + 2;
        }
        map.easeTo({ center: [lng, lat], zoom: Math.max(zoom, map.getZoom() + 1), duration: prefersReducedMotion() ? 0 : 500 });
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') open(e);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
      markers.current.set(id, { marker, key });
    }
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      markers.current.delete(id);
    }
  }, [map, clusters]);
  useEffect(() => {
    if (!map) return;
    const all = markers.current;
    return () => {
      for (const entry of all.values()) entry.marker.remove();
      all.clear();
    };
  }, [map]);
}
