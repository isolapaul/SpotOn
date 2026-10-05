import { memo, useId } from 'react';
import {
  BRIDGES,
  EAST_BANK,
  ISLAND,
  LAKE,
  MAJOR_ROADS,
  PARKS,
  PARK_PATHS,
  RIVER_PATH,
  SCENE_COLORS as C,
  SCENE_H,
  SCENE_W,
  WEST_BANK,
  streetGrids,
  type StreetGrid,
} from '@/lib/onboardingScene';

// The demo city (lib/onboardingScene) as one SVG: two street grids either side of a river, parks,
// a lake, main roads and bridges. Decorative; drawn once (memo) and moved only by the camera.

const GRIDS = streetGrids();

function Grid({ grid, clip }: Readonly<{ grid: StreetGrid; clip: string }>) {
  return (
    <g clipPath={`url(#${clip})`}>
      <g transform={`rotate(${grid.angle} ${grid.origin[0]} ${grid.origin[1]})`}>
        <path d={grid.blocks} fill={C.block} />
        <path d={grid.streets} stroke={C.minor} strokeWidth="4" fill="none" />
      </g>
    </g>
  );
}

function Roads({ paths }: Readonly<{ paths: readonly string[] }>) {
  return (
    <g fill="none" strokeLinecap="round">
      {paths.map((d) => (
        <path key={`c${d}`} d={d} stroke={C.casing} strokeWidth="13" />
      ))}
      {paths.map((d) => (
        <path key={`r${d}`} d={d} stroke={C.major} strokeWidth="8" />
      ))}
    </g>
  );
}

function SceneMap() {
  const id = useId().replaceAll(':', '');
  return (
    <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false" className="block">
      <defs>
        <clipPath id={`${id}w`}>
          <path d={WEST_BANK} />
        </clipPath>
        <clipPath id={`${id}e`}>
          <path d={EAST_BANK} />
        </clipPath>
      </defs>
      <rect width={SCENE_W} height={SCENE_H} fill={C.land} />
      <Grid grid={GRIDS.west} clip={`${id}w`} />
      <Grid grid={GRIDS.east} clip={`${id}e`} />
      <g fill={C.park}>
        {PARKS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="none" stroke={C.parkPath} strokeWidth="3">
        {PARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <ellipse cx={LAKE.cx} cy={LAKE.cy} rx={LAKE.rx} ry={LAKE.ry} fill={C.water} />
      <Roads paths={MAJOR_ROADS} />
      <path d={RIVER_PATH} fill="none" stroke={C.shore} strokeWidth="136" strokeLinecap="round" />
      <path d={RIVER_PATH} fill="none" stroke={C.water} strokeWidth="124" strokeLinecap="round" />
      <path d={ISLAND.shape} fill={C.park} />
      <path d={ISLAND.path} fill="none" stroke={C.parkPath} strokeWidth="2.5" />
      <Roads paths={BRIDGES} />
    </svg>
  );
}

export default memo(SceneMap);
