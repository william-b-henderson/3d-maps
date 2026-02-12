"use client";

/**
 * SFNeighborhoodMap — Interactive SVG map of San Francisco neighborhoods
 * using real geographic boundaries from the SF Chronicle analysis
 * neighborhoods GeoJSON dataset.
 *
 * All 41 GeoJSON neighborhoods are rendered:
 *   - 37 residential neighborhoods are interactive (click to select, hover)
 *   - 4 parks (Golden Gate Park, Lincoln Park, McLaren Park, Presidio)
 *     are drawn as green non-interactive background
 *
 * Coordinates are projected from lat/lng to SVG viewBox space using a
 * simple linear (equirectangular) projection.
 */

import { useCallback, useMemo } from "react";
import geoData from "@/lib/onboarding/sf-neighborhoods.json";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SFNeighborhoodMapProps {
  /** Currently selected neighborhood names (using app names, not GeoJSON names). */
  selected: string[];
  /** Called when a neighborhood is toggled. */
  onToggle: (name: string) => void;
  /** Called when hover state changes (app name or null). */
  onHover: (name: string | null) => void;
  /** Currently hovered neighborhood name (driven externally, e.g. from pill buttons). */
  hoveredName: string | null;
}

// ---------------------------------------------------------------------------
// GeoJSON -> App name mapping (37 selectable neighborhoods)
// ---------------------------------------------------------------------------

/**
 * Maps GeoJSON `nhood` property values to our app's display names.
 * Only neighborhoods present in this map are rendered as interactive/selectable.
 */
const GEOJSON_TO_APP_NAME: Record<string, string> = {
  // Northern waterfront
  "Marina": "Marina",
  "Russian Hill": "Russian Hill",
  "North Beach": "North Beach",
  "Financial District/South Beach": "Financial District",
  "Chinatown": "Chinatown",
  "Nob Hill": "Nob Hill",
  "Pacific Heights": "Pacific Heights",
  "Presidio Heights": "Presidio Heights",
  "Seacliff": "Seacliff",
  // Central
  "South of Market": "SoMa",
  "Mission": "Mission",
  "Mission Bay": "Mission Bay",
  "Castro/Upper Market": "Castro",
  "Haight Ashbury": "Haight-Ashbury",
  "Hayes Valley": "Hayes Valley",
  "Western Addition": "Western Addition",
  "Japantown": "Japantown",
  "Lone Mountain/USF": "Lone Mountain/USF",
  "Tenderloin": "Tenderloin",
  // Mid-city
  "Noe Valley": "Noe Valley",
  "Inner Sunset": "Inner Sunset",
  "Inner Richmond": "Inner Richmond",
  "Sunset/Parkside": "Outer Sunset",
  "Outer Richmond": "Outer Richmond",
  "Twin Peaks": "Twin Peaks",
  "West of Twin Peaks": "West of Twin Peaks",
  "Glen Park": "Glen Park",
  // Southern / Eastern
  "Potrero Hill": "Potrero Hill",
  "Bernal Heights": "Bernal Heights",
  "Bayview Hunters Point": "Bayview",
  "Portola": "Portola",
  "Excelsior": "Excelsior",
  "Outer Mission": "Outer Mission",
  "Oceanview/Merced/Ingleside": "Oceanview/Merced/Ingleside",
  "Visitacion Valley": "Visitacion Valley",
  "Lakeshore": "Lakeshore",
  "Treasure Island": "Treasure Island",
};

// ---------------------------------------------------------------------------
// Parks (non-interactive green background)
// ---------------------------------------------------------------------------

/** GeoJSON names of park/non-residential areas rendered as green background. */
const PARK_NAMES = new Set([
  "Golden Gate Park",
  "Lincoln Park",
  "McLaren Park",
  "Presidio",
]);

// ---------------------------------------------------------------------------
// Projection constants
// ---------------------------------------------------------------------------

/** SVG viewBox dimensions. */
const SVG_WIDTH = 500;
const SVG_HEIGHT = 550;

/** Geographic bounding box for the projection. */
const GEO_WEST = -122.527;
const GEO_EAST = -122.347;
const GEO_NORTH = 37.815;
const GEO_SOUTH = 37.705;

const LNG_SPAN = GEO_EAST - GEO_WEST;
const LAT_SPAN = GEO_NORTH - GEO_SOUTH;

// ---------------------------------------------------------------------------
// Projection helper
// ---------------------------------------------------------------------------

/**
 * Projects a geographic [lng, lat] coordinate to SVG [x, y].
 *
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns [x, y] in SVG viewBox space
 */
function project(lng: number, lat: number): [number, number] {
  const x = ((lng - GEO_WEST) / LNG_SPAN) * SVG_WIDTH;
  const y = ((GEO_NORTH - lat) / LAT_SPAN) * SVG_HEIGHT;
  return [x, y];
}

// ---------------------------------------------------------------------------
// Path generation
// ---------------------------------------------------------------------------

/**
 * Converts an array of [lng, lat] coordinate rings into an SVG path `d` string.
 *
 * @param rings - Array of coordinate rings (outer + optional holes)
 * @returns SVG path data string
 */
function coordsToPath(rings: number[][][]): string {
  return rings
    .map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = project(lng, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `M${points.join("L")}Z`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Potrero Hill / Dogpatch split
// ---------------------------------------------------------------------------

/** Longitude of the I-280 / Potrero Ave corridor used to split the polygon. */
const SPLIT_LNG = -122.394;

/**
 * Interpolates the latitude where an edge crosses `SPLIT_LNG`.
 *
 * @param a - Start vertex [lng, lat]
 * @param b - End vertex [lng, lat]
 * @returns The interpolated [lng, lat] point on the split line
 */
function interpolateAtSplitLng(a: number[], b: number[]): number[] {
  const t = (SPLIT_LNG - a[0]) / (b[0] - a[0]);
  return [SPLIT_LNG, a[1] + t * (b[1] - a[1])];
}

/**
 * Splits the Potrero Hill polygon into separate Dogpatch (east) and
 * Potrero Hill (west) polygons along `SPLIT_LNG`.
 *
 * The GeoJSON polygon conveniently has all its waterfront/east vertices
 * (indices 0-44) east of I-280 and all its western vertices (45-62) west
 * of it, with exactly one edge crossing on the north (v44→v45) and one
 * on the south (v62→v63). We interpolate two points on the split line
 * and produce two clean polygons.
 *
 * @param outerRing - The outer coordinate ring of the Potrero Hill polygon
 * @returns Two coordinate rings: `{ dogpatch, potrero }`
 */
function splitPotreroDogpatch(outerRing: number[][]): {
  dogpatch: number[][];
  potrero: number[][];
} {
  // Collect east and west vertex runs, plus the two crossing points
  const eastVerts: number[][] = [];
  const westVerts: number[][] = [];
  let northCross: number[] | null = null;
  let southCross: number[] | null = null;

  for (let i = 0; i < outerRing.length - 1; i++) {
    const curr = outerRing[i];
    const next = outerRing[i + 1];
    const currEast = curr[0] >= SPLIT_LNG;
    const nextEast = next[0] >= SPLIT_LNG;

    if (currEast) {
      eastVerts.push(curr);
    } else {
      westVerts.push(curr);
    }

    // Detect edge crossings
    if (currEast && !nextEast) {
      // Crossing from east to west → north crossing point
      northCross = interpolateAtSplitLng(curr, next);
    } else if (!currEast && nextEast) {
      // Crossing from west to east → south crossing point
      southCross = interpolateAtSplitLng(curr, next);
    }
  }

  // Fallback in case the polygon structure is unexpected
  if (!northCross || !southCross) {
    return { dogpatch: outerRing, potrero: [] };
  }

  // Dogpatch: all east vertices, closed via the two split-line points
  const dogpatch = [...eastVerts, northCross, southCross, eastVerts[0]];

  // Potrero Hill: the two split-line points plus all west vertices
  const potrero = [northCross, ...westVerts, southCross, northCross];

  return { dogpatch, potrero };
}

// ---------------------------------------------------------------------------
// Pre-process features
// ---------------------------------------------------------------------------

interface MapFeature {
  /** Display name (app name for selectable, GeoJSON name for parks). */
  appName: string;
  /** SVG path data string. */
  pathData: string;
  /** Whether this feature is a non-interactive park. */
  isPark: boolean;
}

/**
 * Extracts and projects all GeoJSON features into SVG paths.
 * Selectable neighborhoods get their app-friendly name; parks are flagged.
 * The Potrero Hill polygon is split into Potrero Hill + Dogpatch.
 * This runs once at module load time.
 */
function buildFeatures(): MapFeature[] {
  const features: MapFeature[] = [];

  for (const feature of geoData.features) {
    const geoName = feature.properties.nhood;
    const appName = GEOJSON_TO_APP_NAME[geoName];
    const isPark = PARK_NAMES.has(geoName);

    // Skip features that are neither selectable nor parks
    if (!appName && !isPark) continue;

    const geom = feature.geometry;

    // --- Special case: split Potrero Hill into Potrero Hill + Dogpatch ---
    if (geoName === "Potrero Hill" && geom.type === "Polygon") {
      const outerRing = (geom.coordinates as number[][][])[0];
      const { dogpatch, potrero } = splitPotreroDogpatch(outerRing);

      if (dogpatch.length > 0) {
        features.push({
          appName: "Dogpatch",
          pathData: coordsToPath([dogpatch]),
          isPark: false,
        });
      }
      if (potrero.length > 0) {
        features.push({
          appName: "Potrero Hill",
          pathData: coordsToPath([potrero]),
          isPark: false,
        });
      }
      continue;
    }

    // --- Normal path for all other features ---
    let pathData: string;

    if (geom.type === "Polygon") {
      pathData = coordsToPath(geom.coordinates as number[][][]);
    } else if (geom.type === "MultiPolygon") {
      pathData = (geom.coordinates as number[][][][])
        .map((polygon) => coordsToPath(polygon))
        .join(" ");
    } else {
      continue;
    }

    features.push({
      appName: appName ?? geoName,
      pathData,
      isPark,
    });
  }

  return features;
}

const MAP_FEATURES = buildFeatures();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SFNeighborhoodMap({
  selected,
  onToggle,
  onHover,
  hoveredName,
}: SFNeighborhoodMapProps) {
  const handleClick = useCallback(
    (name: string) => onToggle(name),
    [onToggle]
  );

  const features = useMemo(() => MAP_FEATURES, []);

  // Split into parks (bottom layer) and neighborhoods (top layer)
  const parks = features.filter((f) => f.isPark);
  const neighborhoods = features.filter((f) => !f.isPark);

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="w-full max-w-[340px] h-auto"
      role="img"
      aria-label="San Francisco neighborhood map"
    >
      {/* Parks — green, non-interactive background layer */}
      {parks.map((feat) => (
        <path
          key={feat.appName}
          d={feat.pathData}
          fill="rgba(34,120,60,0.15)"
          stroke="rgba(34,120,60,0.3)"
          strokeWidth="1"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      ))}

      {/* Selectable neighborhoods — interactive top layer */}
      {neighborhoods.map((feat) => {
        const isSelected = selected.includes(feat.appName);
        const isHovered = hoveredName === feat.appName;

        // Determine fill: selected > hovered > default
        const fill = isSelected
          ? "rgba(255,255,255,0.25)"
          : isHovered
            ? "rgba(255,255,255,0.15)"
            : "rgba(255,255,255,0.06)";

        return (
          <path
            key={feat.appName}
            d={feat.pathData}
            onClick={() => handleClick(feat.appName)}
            onMouseEnter={() => onHover(feat.appName)}
            onMouseLeave={() => onHover(null)}
            className="cursor-pointer transition-all duration-200"
            fill={fill}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeLinejoin="round"
            style={{
              filter: isSelected
                ? "drop-shadow(0 0 6px rgba(255,255,255,0.15))"
                : "none",
            }}
          />
        );
      })}
    </svg>
  );
}
