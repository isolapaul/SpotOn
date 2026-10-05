// The onboarding's demo map (a stylised dark city in the app's dark map palette) and where its
// camera looks on each step. Pure data and geometry: components/onboarding/MapScene draws it with
// SVG, so the tour needs no map provider, tiles or network.
import type { SpotCategory } from '@/store/useSpotStore';
import type { OnboardingStep } from './onboarding';

export const SCENE_W = 1400;
export const SCENE_H = 2200;

export const SCENE_COLORS = {
  land: '#1b1c1e',
  minor: '#2a2c30',
  major: '#393c42',
  casing: '#141517',
  water: '#0f1317',
  shore: '#16191d',
  park: '#1b241e',
  parkPath: '#26332a',
  block: '#202124',
} as const;

type Point = readonly [number, number];

const RIVER: readonly Point[] = [[560, -120], [600, 300], [545, 700], [615, 1100], [720, 1500], [700, 1900], [760, 2340]];

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
export function smoothPath(pts: readonly Point[]): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Deterministic PRNG (mulberry32), so the city looks the same on every render and device. */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RIVER_PATH = smoothPath(RIVER);
const riverEdge = RIVER.map((p) => `L${p[0]} ${p[1]}`).join(' ');
/** The banks either side of the river (clip regions for the two street grids). */
export const WEST_BANK = `M-200 -200 ${riverEdge} L-200 2400Z`;
export const EAST_BANK = `M1600 -200 ${riverEdge} L1600 2400Z`;

export interface StreetGrid {
  angle: number;
  origin: Point;
  blocks: string;
  streets: string;
}

/** A rotated street grid as two paths: the building blocks and the streets between them. */
function grid(rand: () => number, angle: number, step: Point, origin: Point): StreetGrid {
  const [sx, sy] = step;
  let blocks = '';
  let streets = '';
  for (let x = -500; x < 1900; x += sx) {
    for (let y = -500; y < 2700; y += sy) {
      if (rand() < 0.86) blocks += `M${x + 7} ${y + 7}h${sx - 14}v${sy - 14}h${14 - sx}z`;
    }
    streets += `M${x} -500V2700`;
  }
  for (let y = -500; y < 2700; y += sy) streets += `M-500 ${y}H1900`;
  return { angle, origin, blocks, streets };
}

export function streetGrids(): { west: StreetGrid; east: StreetGrid } {
  const rand = seededRandom(7);
  return { west: grid(rand, -14, [92, 110], [300, 1000]), east: grid(rand, 9, [84, 96], [1000, 1000]) };
}

export const MAJOR_ROADS: readonly string[] = [
  'M640 1060 A520 520 0 0 0 1250 640',
  'M640 1060 A520 520 0 0 1 1180 1560',
  'M650 780 C 900 760, 1150 700, 1600 560',
  'M700 1300 C 950 1320, 1200 1400, 1600 1460',
  'M660 1050 L1600 1000',
  'M560 560 C 400 520, 260 420, -100 380',
  'M600 1000 C 430 1040, 300 1180, 120 1260 S -50 1400 -200 1460',
  'M690 1700 C 520 1720, 300 1820, -200 1880',
  'M350 -200 C 330 300, 340 800, 300 2400',
  'M1020 -200 C 1000 600, 980 1400, 1040 2400',
];
/** Bridges, drawn over the river. */
export const BRIDGES: readonly string[] = ['M560 255 L660 300', 'M530 650 L650 700', 'M550 980 L690 1020', 'M610 1250 L760 1270', 'M650 1620 L800 1610'];

export const PARKS: readonly string[] = [
  'M300 1080c60-60 170-70 230-20s40 170-30 220-200 40-240-40 0-120 40-160z',
  'M1090 540h170a40 40 0 0 1 40 40v120a40 40 0 0 1-40 40h-170a40 40 0 0 1-40-40v-120a40 40 0 0 1 40-40z',
  'M40 560c40-90 170-120 240-60s30 190-60 210-210-60-180-150z',
  'M820 1900c60-40 200-30 240 30s-40 140-140 130-140-120-100-160z',
];
export const PARK_PATHS: readonly string[] = ['M330 1150c50 20 70 60 120 40s70 40 40 80', 'M1080 600c60 30 120 0 190 40', 'M80 600c40 40 90 10 140 60'];
/** The island in the river (drawn over the water) and its path. */
export const ISLAND = { shape: 'M596 250c22 40 18 200-4 300-10 30-30 30-34 0-10-100 4-260 38-300z', path: 'M584 300c6 60 0 160-8 220' } as const;
export const LAKE = { cx: 1150, cy: 650, rx: 44, ry: 26 } as const;

export interface SceneSpot {
  id: string;
  category: SpotCategory;
  x: number;
  y: number;
}

/** Demo spots (world px). s1 is the place card's spot, s4 the featured "New this week" one. */
export const SCENE_SPOTS: readonly SceneSpot[] = [
  { id: 's1', category: 'viewpoint', x: 450, y: 1160 },
  { id: 's2', category: 'scenic', x: 690, y: 880 },
  { id: 's3', category: 'date-spot', x: 578, y: 380 },
  { id: 's4', category: 'park', x: 1150, y: 620 },
  { id: 's5', category: 'smoke-spot', x: 880, y: 1210 },
  { id: 's6', category: 'part', x: 500, y: 70 },
  { id: 's7', category: 'hiking', x: 170, y: 700 },
  { id: 's8', category: 'random', x: 1010, y: 1480 },
  { id: 's9', category: 'scenic', x: 300, y: 1520 },
  { id: 's10', category: 'park', x: 920, y: 1930 },
  { id: 's11', category: 'smoke-spot', x: 1220, y: 1180 },
  { id: 's12', category: 'date-spot', x: 800, y: 640 },
  { id: 's13', category: 'viewpoint', x: 230, y: 420 },
  { id: 's14', category: 'random', x: 1180, y: 300 },
  { id: 's15', category: 'part', x: 760, y: 1680 },
  { id: 's16', category: 'park', x: 400, y: 860 },
  { id: 's17', category: 'scenic', x: 1080, y: 900 },
  { id: 's18', category: 'hiking', x: 120, y: 1300 },
];

/** The spot the share step adds, and where the visitor "is" on the location step. */
export const NEW_SPOT = { x: 705, y: 1050 } as const;
export const USER_SPOT = { x: 860, y: 1110 } as const;
/** Distance chips shown once location is allowed: spot id and the demo distance in metres. */
export const DISTANCES: readonly { id: string; metres: number }[] = [
  { id: 's5', metres: 380 },
  { id: 's17', metres: 1100 },
  { id: 's8', metres: 1600 },
];

/** Where the camera looks: world point (cx, cy) at the stage's horizontal centre and `fy` of its height, zoom `s`. */
export interface Camera {
  cx: number;
  cy: number;
  s: number;
  fy: number;
  /** `fy` on short screens (under SHORT_STAGE_PX), where the cards leave a narrower band of map. */
  fyShort?: number;
}

export const SHORT_STAGE_PX = 700;

export type SceneShot = OnboardingStep | 'explore' | 'done';

export const CAMERAS: Readonly<Record<SceneShot, Camera>> = {
  welcome: { cx: 700, cy: 1060, s: 0.42, fy: 0.5 },
  name: { cx: 760, cy: 980, s: 0.5, fy: 0.42 },
  discover: { cx: 470, cy: 1175, s: 1.05, fy: 0.5, fyShort: 0.6 },
  explore: { cx: 640, cy: 1000, s: 0.62, fy: 0.3 },
  add: { cx: 705, cy: 1060, s: 1.15, fy: 0.56, fyShort: 0.64 },
  levels: { cx: 690, cy: 880, s: 0.7, fy: 0.56 },
  location: { cx: 860, cy: 1110, s: 1, fy: 0.3 },
  install: { cx: 700, cy: 1060, s: 0.46, fy: 0.5 },
  signup: { cx: 640, cy: 1100, s: 0.5, fy: 0.5 },
  done: { cx: 760, cy: 1060, s: 0.8, fy: 0.46 },
};

/** The world's CSS transform for a camera on a stage of width w and height h. */
export function worldTransform(c: Camera, w: number, h: number): string {
  const fy = h < SHORT_STAGE_PX && c.fyShort !== undefined ? c.fyShort : c.fy;
  const tx = w * 0.5 - c.cx * c.s;
  const ty = h * fy - c.cy * c.s;
  return `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${c.s})`;
}

/** A marker's transform inside the world: at (x, y), counter-scaled so it keeps its size on screen. */
export function markerTransform(x: number, y: number, s: number): string {
  return `translate3d(${x}px, ${y}px, 0) scale(${(1 / s).toFixed(4)})`;
}

/** Steps that cover the map with a blurred scrim (the full-screen and sheet steps). */
export function sceneIsScrimmed(step: OnboardingStep): boolean {
  return step === 'welcome' || step === 'name' || step === 'install' || step === 'signup';
}

/** Discover first shows the place card, then the Explore sheet (ms after the step starts). */
export const DISCOVER_EXPLORE_AT_MS = 4600;
