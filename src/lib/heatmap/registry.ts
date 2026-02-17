/**
 * Heatmap layer registry.
 *
 * Central catalogue of all available heatmap layers.  Data is loaded
 * lazily on first request and cached in memory so subsequent toggles
 * are instant.
 *
 * ## Adding a new layer
 *
 * 1. Define a generator or loader for your data.
 * 2. Add an entry to `LAYER_REGISTRY` below with:
 *    - A `config` describing rendering parameters and `renderMode`.
 *    - A `source` matching the render mode:
 *      - `"grid"` → `{ type: "inline" }` or `{ type: "url" }`
 *      - `"streets"` → `{ type: "streets", url }` (returns `StreetSegment[]`)
 *      - `"intersections"` → `{ type: "intersections", url }` (returns `ScoredIntersection[]`)
 * 3. The layer will automatically appear in the UI.
 */

import type {
  HeatmapPoint,
  HeatmapLayerConfig,
  RegisteredLayer,
  HeatmapDataSource,
  StreetSegment,
  ScoredIntersection,
} from "./types";
import {
  SF_BOUNDS,
  DEFAULT_BLUR_RADIUS,
  DEFAULT_GRID_RESOLUTION,
  DEFAULT_INTENSITY_THRESHOLD,
  DEFAULT_LAYER_OPACITY,
} from "./constants";
import { generateWalkabilityData } from "./sampleData";

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

/**
 * Master list of registered heatmap layers.
 *
 * For inline sources we use a lazy wrapper — the generator function runs
 * only when `loadLayerData` is called for the first time.
 */
const LAYER_REGISTRY: RegisteredLayer[] = [
  {
    config: {
      id: "walkability",
      name: "Walkability",
      description: "Walking-friendliness score by neighbourhood",
      colorScale: "thermal",
      renderMode: "grid",
      blurRadius: DEFAULT_BLUR_RADIUS,
      gridResolution: DEFAULT_GRID_RESOLUTION,
      bounds: SF_BOUNDS,
      minIntensityThreshold: DEFAULT_INTENSITY_THRESHOLD,
      opacity: DEFAULT_LAYER_OPACITY,
      legendLowLabel: "Low",
      legendHighLabel: "High",
    },
    source: { type: "inline", points: [] },
  },
  {
    config: {
      id: "crime",
      name: "Crime Density",
      description: "Crime score at each intersection",
      colorScale: "inferno",
      renderMode: "intersections",
      blurRadius: DEFAULT_BLUR_RADIUS,
      gridResolution: DEFAULT_GRID_RESOLUTION,
      bounds: SF_BOUNDS,
      minIntensityThreshold: DEFAULT_INTENSITY_THRESHOLD,
      opacity: DEFAULT_LAYER_OPACITY,
      legendLowLabel: "Safe",
      legendHighLabel: "Dangerous",
    },
    source: { type: "intersections", url: "/api/heatmap/intersections" },
  },
  {
    config: {
      id: "traffic",
      name: "Traffic Density",
      description: "Traffic volume by street segment",
      colorScale: "thermal",
      renderMode: "streets",
      blurRadius: DEFAULT_BLUR_RADIUS,
      gridResolution: DEFAULT_GRID_RESOLUTION,
      bounds: SF_BOUNDS,
      minIntensityThreshold: DEFAULT_INTENSITY_THRESHOLD,
      opacity: DEFAULT_LAYER_OPACITY,
      legendLowLabel: "Quiet",
      legendHighLabel: "Busy",
    },
    source: { type: "streets", url: "/api/heatmap/streets" },
  },
];

/**
 * Map of inline generators keyed by layer ID.
 * These are called once; afterwards the result lives in `dataCache`.
 */
const INLINE_GENERATORS: Record<string, () => HeatmapPoint[]> = {
  walkability: generateWalkabilityData,
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** In-memory cache: layerId → loaded data (points, segments, or intersections). */
const dataCache = new Map<string, unknown>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the configuration metadata for all registered layers (without
 * loading their data).  Suitable for populating the UI toggle list.
 *
 * @returns Array of layer configs
 */
export function getAvailableLayers(): HeatmapLayerConfig[] {
  return LAYER_REGISTRY.map((entry) => entry.config);
}

/**
 * Get the full config for a specific layer by ID.
 *
 * @param layerId - Unique layer identifier
 * @returns The layer config, or `undefined` if not found
 */
export function getLayerConfig(
  layerId: string,
): HeatmapLayerConfig | undefined {
  return LAYER_REGISTRY.find((entry) => entry.config.id === layerId)?.config;
}

/**
 * Get the data source descriptor for a specific layer.
 *
 * @param layerId - Unique layer identifier
 * @returns The source descriptor, or `undefined` if not found
 */
export function getLayerSource(
  layerId: string,
): HeatmapDataSource | undefined {
  return LAYER_REGISTRY.find((entry) => entry.config.id === layerId)?.source;
}

/**
 * Lazily load (and cache) the data points for a grid-mode heatmap layer.
 *
 * - **Inline sources** with a registered generator run the generator once.
 * - **URL sources** fetch from the network once and cache the result.
 *
 * Subsequent calls return the cached data instantly.
 *
 * @param layerId - Unique layer identifier
 * @returns The array of heatmap data points
 * @throws If the layer is not found in the registry
 */
export async function loadLayerData(
  layerId: string,
): Promise<HeatmapPoint[]> {
  const cached = dataCache.get(layerId);
  if (cached) return cached as HeatmapPoint[];

  const entry = LAYER_REGISTRY.find((e) => e.config.id === layerId);
  if (!entry) throw new Error(`Heatmap layer "${layerId}" not found in registry`);

  let points: HeatmapPoint[];

  if (entry.source.type === "inline") {
    const gen = INLINE_GENERATORS[layerId];
    points = gen ? gen() : (entry.source as { type: "inline"; points: HeatmapPoint[] }).points;
  } else if (entry.source.type === "url") {
    points = await fetchJSON<HeatmapPoint[]>(entry.source.url);
  } else {
    throw new Error(`loadLayerData called on non-grid layer "${layerId}"`);
  }

  dataCache.set(layerId, points);
  return points;
}

/**
 * Lazily load (and cache) street segment data for a streets-mode layer.
 *
 * @param layerId - Unique layer identifier
 * @returns The array of street segments
 */
export async function loadStreetData(
  layerId: string,
): Promise<StreetSegment[]> {
  const cached = dataCache.get(layerId);
  if (cached) return cached as StreetSegment[];

  const entry = LAYER_REGISTRY.find((e) => e.config.id === layerId);
  if (!entry || entry.source.type !== "streets") {
    throw new Error(`Layer "${layerId}" is not a streets source`);
  }

  const segments = await fetchJSON<StreetSegment[]>(entry.source.url);
  dataCache.set(layerId, segments);
  return segments;
}

/**
 * Lazily load (and cache) intersection data for an intersections-mode layer.
 *
 * @param layerId - Unique layer identifier
 * @returns The array of scored intersections
 */
export async function loadIntersectionData(
  layerId: string,
): Promise<ScoredIntersection[]> {
  const cached = dataCache.get(layerId);
  if (cached) return cached as ScoredIntersection[];

  const entry = LAYER_REGISTRY.find((e) => e.config.id === layerId);
  if (!entry || entry.source.type !== "intersections") {
    throw new Error(`Layer "${layerId}" is not an intersections source`);
  }

  const intersections = await fetchJSON<ScoredIntersection[]>(entry.source.url);
  dataCache.set(layerId, intersections);
  return intersections;
}

/**
 * Clear the data cache for a specific layer (or all layers).
 * Useful when data should be re-fetched from the server.
 *
 * @param layerId - Layer to invalidate, or omit to clear everything
 */
export function invalidateCache(layerId?: string): void {
  if (layerId) {
    dataCache.delete(layerId);
  } else {
    dataCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch JSON data from a URL.
 *
 * @param url - The URL to fetch from
 * @returns Parsed JSON response
 */
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch heatmap data from ${url}: ${res.status}`);
  }
  return (await res.json()) as T;
}
