/**
 * Heatmap constants — geographic bounds, grid sizing, and performance tuning.
 *
 * All magic numbers live here so they can be tuned in one place without
 * touching the engine or renderer.
 */

import type { GeoBounds } from "./types";

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

/** Bounding box that covers San Francisco proper. */
export const SF_BOUNDS: GeoBounds = {
  north: 37.812,
  south: 37.708,
  east: -122.357,
  west: -122.517,
};

// ---------------------------------------------------------------------------
// KDE computation
// ---------------------------------------------------------------------------

/**
 * Internal resolution (px) of the offscreen canvas used for Gaussian KDE.
 * Higher = smoother gradients but marginally slower `getImageData`.
 * 512 is a sweet spot: ~5-10 ms to render 500 points.
 */
export const KDE_CANVAS_SIZE = 512;

/**
 * Default Gaussian blur radius in canvas pixels.
 * Controls how far each data point's influence spreads.
 */
export const DEFAULT_BLUR_RADIUS = 25;

// ---------------------------------------------------------------------------
// Grid sampling
// ---------------------------------------------------------------------------

/**
 * Default grid resolution.
 * The grid is `N × N` cells.  75 × 75 = 5 625 max cells.
 * After threshold filtering, typically 2 000-3 500 actual polygons.
 */
export const DEFAULT_GRID_RESOLUTION = 75;

/**
 * Pixel intensity (0-255) below which a cell is skipped entirely.
 * Raising this number reduces polygon count at the cost of coverage.
 */
export const DEFAULT_INTENSITY_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Rendering performance
// ---------------------------------------------------------------------------

/**
 * Number of `Polygon3DElement` instances created per `requestAnimationFrame`
 * batch.  200 keeps each frame well under 16 ms budget.
 */
export const POLYGON_BATCH_SIZE = 200;

/**
 * Default layer opacity (0-1).
 * Can be overridden per-layer or changed at runtime via the opacity slider.
 */
export const DEFAULT_LAYER_OPACITY = 0.55;

/**
 * Altitude (meters above ground) for heatmap polygons.
 * Must be > 0 for the extruded polygon to actually render.
 * 3m is thin enough to look flat from the typical city-overview distance
 * (range 1000-5000m) while still being visible to the 3D renderer.
 */
export const HEATMAP_ALTITUDE = 3;
