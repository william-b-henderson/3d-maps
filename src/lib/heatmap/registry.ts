/**
 * Heatmap layer registry.
 *
 * Central catalogue of all available heatmap layers.  Data is loaded
 * lazily on first request and cached in memory so subsequent toggles
 * are instant.
 *
 * ## Adding a new layer
 *
 * 1. Define a generator or loader for your `HeatmapPoint[]` data.
 * 2. Add an entry to `LAYER_REGISTRY` below with:
 *    - A `config` describing rendering parameters.
 *    - A `source` that is either `{ type: "inline", points }` or
 *      `{ type: "url", url: "/api/heatmap/my-layer" }`.
 * 3. The layer will automatically appear in the UI.
 *
 * ## Consuming an external API
 *
 * Create a Next.js route handler at `src/app/api/heatmap/[layerId]/route.ts`
 * that fetches from your upstream API, transforms the response into
 * `HeatmapPoint[]` JSON, and returns it.  Then register the layer with
 * `source: { type: "url", url: "/api/heatmap/my-layer" }`.
 *
 * The registry's `loadLayerData` function handles fetching and caching
 * transparently.  For very large upstream datasets, aggregate/downsample
 * server-side to keep the client payload under ~500 points.
 */

import type {
  HeatmapPoint,
  HeatmapLayerConfig,
  RegisteredLayer,
  HeatmapDataSource,
} from "./types";
import {
  SF_BOUNDS,
  DEFAULT_BLUR_RADIUS,
  DEFAULT_GRID_RESOLUTION,
  DEFAULT_INTENSITY_THRESHOLD,
  DEFAULT_LAYER_OPACITY,
} from "./constants";
import { generateWalkabilityData, generateCrimeData } from "./sampleData";

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
      blurRadius: DEFAULT_BLUR_RADIUS,
      gridResolution: DEFAULT_GRID_RESOLUTION,
      bounds: SF_BOUNDS,
      minIntensityThreshold: DEFAULT_INTENSITY_THRESHOLD,
      opacity: DEFAULT_LAYER_OPACITY,
    },
    source: { type: "inline", points: [] }, // populated lazily
  },
  {
    config: {
      id: "crime",
      name: "Crime Density",
      description: "Relative crime incident density",
      colorScale: "inferno",
      blurRadius: DEFAULT_BLUR_RADIUS,
      gridResolution: DEFAULT_GRID_RESOLUTION,
      bounds: SF_BOUNDS,
      minIntensityThreshold: DEFAULT_INTENSITY_THRESHOLD,
      opacity: DEFAULT_LAYER_OPACITY,
    },
    source: { type: "inline", points: [] },
  },
];

/**
 * Map of inline generators keyed by layer ID.
 * These are called once; afterwards the result lives in `dataCache`.
 */
const INLINE_GENERATORS: Record<string, () => HeatmapPoint[]> = {
  walkability: generateWalkabilityData,
  crime: generateCrimeData,
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** In-memory cache: layerId → loaded points.  Survives across toggles. */
const dataCache = new Map<string, HeatmapPoint[]>();

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
  layerId: string
): HeatmapLayerConfig | undefined {
  return LAYER_REGISTRY.find((entry) => entry.config.id === layerId)?.config;
}

/**
 * Lazily load (and cache) the data points for a heatmap layer.
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
  layerId: string
): Promise<HeatmapPoint[]> {
  // Return from cache if available
  const cached = dataCache.get(layerId);
  if (cached) return cached;

  const entry = LAYER_REGISTRY.find((e) => e.config.id === layerId);
  if (!entry) throw new Error(`Heatmap layer "${layerId}" not found in registry`);

  let points: HeatmapPoint[];

  if (entry.source.type === "inline") {
    // Run the generator if one exists; otherwise use whatever is in `points`
    const gen = INLINE_GENERATORS[layerId];
    points = gen ? gen() : (entry.source as { type: "inline"; points: HeatmapPoint[] }).points;
  } else {
    // Fetch from URL
    points = await fetchLayerData(entry.source);
  }

  dataCache.set(layerId, points);
  return points;
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
 * Fetch heatmap point data from a URL source.
 *
 * Currently supports JSON responses in the shape `HeatmapPoint[]`.
 * Extend the parser switch below for CSV or binary formats.
 *
 * @param source - The URL data source descriptor
 * @returns Parsed array of heatmap points
 */
async function fetchLayerData(
  source: Extract<HeatmapDataSource, { type: "url" }>
): Promise<HeatmapPoint[]> {
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch heatmap data from ${source.url}: ${res.status}`
    );
  }

  const parser = source.parser ?? "json";

  switch (parser) {
    case "json":
      return (await res.json()) as HeatmapPoint[];

    case "csv":
      // TODO: implement CSV parsing if needed
      throw new Error("CSV parser not yet implemented");

    case "binary":
      // TODO: implement binary Float32Array parsing if needed
      throw new Error("Binary parser not yet implemented");

    default:
      throw new Error(`Unknown parser: ${parser}`);
  }
}
