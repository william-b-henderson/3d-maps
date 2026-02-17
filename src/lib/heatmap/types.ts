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

/** A street segment with line coordinates and a normalised score. */
export interface StreetSegment {
  /** Ordered lat/lng points forming the street line. */
  coordinates: Array<{ lat: number; lng: number }>;
  /** Normalised score in the range [0, 1]. */
  score: number;
}

/** A scored intersection point. */
export interface ScoredIntersection {
  lat: number;
  lng: number;
  /** Normalised score in the range [0, 1]. */
  score: number;
}

// ---------------------------------------------------------------------------
// Color scales
// ---------------------------------------------------------------------------

/** Built-in color scale identifiers. */
export type ColorScaleId = "thermal" | "viridis" | "inferno";

// ---------------------------------------------------------------------------
// Render modes
// ---------------------------------------------------------------------------

/**
 * Determines which renderer pipeline a layer uses.
 *
 * - `"grid"` — KDE-based polygon grid (e.g. walkability).
 * - `"streets"` — coloured polylines along real street geometry.
 * - `"intersections"` — coloured dots at intersection points.
 */
export type RenderMode = "grid" | "streets" | "intersections";

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
  /** Which renderer pipeline to use. */
  renderMode: RenderMode;
  /** Gaussian blur radius in canvas pixels (larger = smoother). Grid mode only. */
  blurRadius: number;
  /** Grid resolution — the grid will be `gridResolution × gridResolution`. Grid mode only. */
  gridResolution: number;
  /** Geographic bounds that the heatmap covers. */
  bounds: GeoBounds;
  /** Pixel intensity (0-255) below which cells are skipped entirely. Grid mode only. */
  minIntensityThreshold: number;
  /** Base opacity for the layer (0-1), adjustable by the user. */
  opacity: number;
  /** Label shown at the low end of the legend gradient (e.g. "Safe"). */
  legendLowLabel?: string;
  /** Label shown at the high end of the legend gradient (e.g. "Dangerous"). */
  legendHighLabel?: string;
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
 * - `"url"` — HeatmapPoint[] fetched from a URL (for KDE grid pipeline).
 * - `"streets"` — StreetSegment[] fetched from a URL.
 * - `"intersections"` — ScoredIntersection[] fetched from a URL.
 */
export type HeatmapDataSource =
  | { type: "inline"; points: HeatmapPoint[] }
  | { type: "url"; url: string; parser?: "json" | "csv" | "binary" }
  | { type: "streets"; url: string }
  | { type: "intersections"; url: string };

// ---------------------------------------------------------------------------
// Common renderer interface
// ---------------------------------------------------------------------------

/**
 * Common interface for all layer renderers.
 * Allows the hook to swap between grid, street, and intersection renderers.
 */
export interface LayerRenderer {
  /** Render the layer data onto the map. */
  render(data: unknown): Promise<void>;
  /** Update opacity of all rendered elements in-place. */
  setOpacity(opacity: number): void;
  /** Remove all rendered elements from the map. */
  clear(): void;
}

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

/** A layer entry in the heatmap registry. */
export interface RegisteredLayer {
  config: HeatmapLayerConfig;
  source: HeatmapDataSource;
}
