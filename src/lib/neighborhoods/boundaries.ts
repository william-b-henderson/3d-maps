/**
 * Neighborhood boundary utilities.
 *
 * Converts GeoJSON neighborhood polygons into coordinate arrays suitable
 * for rendering as `Polygon3DElement.outerCoordinates` on the 3D map.
 *
 * Handles the Dogpatch / Potrero Hill split at the I-280 corridor and
 * provides a lookup from app-friendly neighborhood names to map coordinates.
 */

import geoData from "@/lib/onboarding/sf-neighborhoods.json";
import { SF_NEIGHBORHOODS } from "@/lib/onboarding/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single 3D map coordinate with altitude. */
export interface MapCoord {
  lat: number;
  lng: number;
  altitude: number;
}

// ---------------------------------------------------------------------------
// GeoJSON name → app name mapping
// ---------------------------------------------------------------------------

/**
 * Maps GeoJSON `nhood` property values to our app's display names.
 * Mirrors the mapping in SFNeighborhoodMap.tsx — the canonical reference.
 */
const GEOJSON_TO_APP_NAME: Record<string, string> = {
  "Marina": "Marina",
  "Russian Hill": "Russian Hill",
  "North Beach": "North Beach",
  "Financial District/South Beach": "Financial District",
  "Chinatown": "Chinatown",
  "Nob Hill": "Nob Hill",
  "Pacific Heights": "Pacific Heights",
  "Presidio Heights": "Presidio Heights",
  "Seacliff": "Seacliff",
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
  "Noe Valley": "Noe Valley",
  "Inner Sunset": "Inner Sunset",
  "Inner Richmond": "Inner Richmond",
  "Sunset/Parkside": "Outer Sunset",
  "Outer Richmond": "Outer Richmond",
  "Twin Peaks": "Twin Peaks",
  "West of Twin Peaks": "West of Twin Peaks",
  "Glen Park": "Glen Park",
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

/** Reverse mapping: app display name → GeoJSON nhood name. */
const APP_NAME_TO_GEOJSON: Record<string, string> = {};
for (const [geo, app] of Object.entries(GEOJSON_TO_APP_NAME)) {
  APP_NAME_TO_GEOJSON[app] = geo;
}

// ---------------------------------------------------------------------------
// Potrero Hill / Dogpatch split (same logic as SFNeighborhoodMap.tsx)
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
 * Splits the Potrero Hill polygon into Dogpatch (east of I-280) and
 * Potrero Hill (west of I-280).
 *
 * @param outerRing - The outer coordinate ring [lng, lat][]
 * @returns Two coordinate rings keyed by app name
 */
function splitPotreroDogpatch(
  outerRing: number[][]
): { dogpatch: number[][]; potrero: number[][] } {
  const eastVerts: number[][] = [];
  const westVerts: number[][] = [];
  let northCross: number[] | null = null;
  let southCross: number[] | null = null;

  for (let i = 0; i < outerRing.length - 1; i++) {
    const curr = outerRing[i];
    const next = outerRing[i + 1];
    const currEast = curr[0] >= SPLIT_LNG;
    const nextEast = next[0] >= SPLIT_LNG;

    if (currEast) eastVerts.push(curr);
    else westVerts.push(curr);

    if (currEast && !nextEast) {
      northCross = interpolateAtSplitLng(curr, next);
    } else if (!currEast && nextEast) {
      southCross = interpolateAtSplitLng(curr, next);
    }
  }

  if (!northCross || !southCross) {
    return { dogpatch: outerRing, potrero: [] };
  }

  const dogpatch = [...eastVerts, northCross, southCross, eastVerts[0]];
  const potrero = [northCross, ...westVerts, southCross, northCross];
  return { dogpatch, potrero };
}

// ---------------------------------------------------------------------------
// Pre-built boundary cache
// ---------------------------------------------------------------------------

/**
 * Pre-computes a map of app name → outer ring coordinates (as [lng, lat][]).
 * Runs once at module load time.
 */
function buildBoundaryCache(): Map<string, number[][]> {
  const cache = new Map<string, number[][]>();

  for (const feature of geoData.features) {
    const geoName = feature.properties.nhood;
    const appName = GEOJSON_TO_APP_NAME[geoName];
    if (!appName) continue;

    const geom = feature.geometry;

    // Special case: split Potrero Hill into Potrero Hill + Dogpatch
    if (geoName === "Potrero Hill" && geom.type === "Polygon") {
      const outerRing = (geom.coordinates as number[][][])[0];
      const { dogpatch, potrero } = splitPotreroDogpatch(outerRing);
      if (dogpatch.length > 0) cache.set("Dogpatch", dogpatch);
      if (potrero.length > 0) cache.set("Potrero Hill", potrero);
      continue;
    }

    // Normal polygons — take the outer ring
    if (geom.type === "Polygon") {
      cache.set(appName, (geom.coordinates as number[][][])[0]);
    } else if (geom.type === "MultiPolygon") {
      // For MultiPolygon, use the first polygon's outer ring
      const firstPoly = (geom.coordinates as number[][][][])[0];
      cache.set(appName, firstPoly[0]);
    }
  }

  return cache;
}

const BOUNDARY_CACHE = buildBoundaryCache();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the boundary coordinates for a neighborhood, formatted for
 * `Polygon3DElement.outerCoordinates`.
 *
 * Coordinates are returned at altitude 0 (ground level) using
 * RELATIVE_TO_GROUND altitude mode.
 *
 * @param appName - The app-friendly neighborhood name (e.g. "SoMa", "Castro")
 * @returns Array of {lat, lng, altitude} or null if not found
 */
export function getNeighborhoodBoundary(appName: string): MapCoord[] | null {
  const ring = BOUNDARY_CACHE.get(appName);
  if (!ring) return null;

  return ring.map(([lng, lat]) => ({
    lat,
    lng,
    altitude: 0,
  }));
}

/**
 * Returns the full list of selectable neighborhood names.
 *
 * @returns Array of 37 SF neighborhood display names
 */
export function getAllNeighborhoodNames(): string[] {
  return SF_NEIGHBORHOODS;
}
