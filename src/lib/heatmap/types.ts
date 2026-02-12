/**
 * Heatmap type definitions.
 *
 * Shared interfaces used across the heatmap engine, renderer, registry,
 * and UI components.
 */

// ---------------------------------------------------------------------------
// Data primitives
// ---------------------------------------------------------------------------

/** A single weighted data point for the heatmap. */
export interface HeatmapPoint {
  lat: number;
  lng: number;
  /** Normalised intensity in the range [0, 1]. */
  intensity: number;
}

/** Axis-aligned geographic bounding box. */
export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ---------------------------------------------------------------------------
// Color scales
// ---------------------------------------------------------------------------

/** Built-in color scale identifiers. */
export type ColorScaleId = "thermal" | "viridis" | "inferno";

// ---------------------------------------------------------------------------
// Layer configuration
// ---------------------------------------------------------------------------

/** Full configuration for a single heatmap layer. */
export interface HeatmapLayerConfig {
  /** Unique layer identifier (e.g. "walkability"). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Short description shown as a tooltip or subtitle. */
  description: string;
  /** Which color scale to use for rendering. */
  colorScale: ColorScaleId;
  /** Gaussian blur radius in canvas pixels (larger = smoother). */
  blurRadius: number;
  /** Grid resolution — the grid will be `gridResolution × gridResolution`. */
  gridResolution: number;
  /** Geographic bounds that the heatmap covers. */
  bounds: GeoBounds;
  /** Pixel intensity (0-255) below which cells are skipped entirely. */
  minIntensityThreshold: number;
  /** Base opacity for the layer (0-1), adjustable by the user. */
  opacity: number;
}

// ---------------------------------------------------------------------------
// Pre-computed grid
// ---------------------------------------------------------------------------

/** Pre-computed grid ready for polygon rendering. */
export interface HeatmapGrid {
  /** ID of the layer this grid was computed from. */
  layerId: string;
  /** Geographic bounds the grid covers. */
  bounds: GeoBounds;
  /** Number of columns in the grid. */
  cols: number;
  /** Number of rows in the grid. */
  rows: number;
  /**
   * RGBA colour string per cell in row-major order.
   * `null` means the cell is below the intensity threshold and should be
   * skipped (never rendered).
   */
  cells: (string | null)[];
}

// ---------------------------------------------------------------------------
// Data sources
// ---------------------------------------------------------------------------

/**
 * Describes where heatmap data comes from.
 *
 * - `"inline"` — data is provided directly (or generated in-memory).
 * - `"url"`    — data is fetched from a URL at runtime.
 */
export type HeatmapDataSource =
  | { type: "inline"; points: HeatmapPoint[] }
  | { type: "url"; url: string; parser?: "json" | "csv" | "binary" };

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

/** A layer entry in the heatmap registry. */
export interface RegisteredLayer {
  config: HeatmapLayerConfig;
  source: HeatmapDataSource;
}
