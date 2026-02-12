/**
 * Gaussian KDE heatmap engine.
 *
 * Renders data points onto an offscreen `<canvas>` using radial gradient
 * circles (a fast approximation of Gaussian kernel density estimation).
 * The resulting image is sampled at a configurable grid resolution and
 * each cell is mapped through a colour LUT to produce an RGBA string
 * ready for polygon rendering.
 *
 * Performance notes:
 *  - 512×512 canvas + 500 points → ~5-10 ms on modern hardware.
 *  - The expensive part (polygon creation) is handled by renderer.ts.
 */

import type {
  HeatmapPoint,
  HeatmapGrid,
  HeatmapLayerConfig,
  ColorScaleId,
  GeoBounds,
} from "./types";
import { buildColorLUT } from "./colorScales";
import { KDE_CANVAS_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point: takes raw data points + a layer config and returns a
 * pre-computed grid of RGBA colour strings ready for the renderer.
 *
 * @param points - Array of weighted lat/lng data points
 * @param config - Layer configuration (bounds, resolution, blur, colours …)
 * @returns A `HeatmapGrid` with colour strings per cell (or null for skipped cells)
 */
export function computeHeatmapGrid(
  points: HeatmapPoint[],
  config: HeatmapLayerConfig
): HeatmapGrid {
  const imageData = renderKDE(
    points,
    KDE_CANVAS_SIZE,
    config.blurRadius,
    config.bounds
  );

  const cells = sampleGrid(
    imageData,
    config.gridResolution,
    config.gridResolution,
    config.colorScale,
    config.opacity,
    config.minIntensityThreshold
  );

  return {
    layerId: config.id,
    bounds: config.bounds,
    cols: config.gridResolution,
    rows: config.gridResolution,
    cells,
  };
}

// ---------------------------------------------------------------------------
// KDE rendering
// ---------------------------------------------------------------------------

/**
 * Renders a Gaussian KDE onto an offscreen canvas.
 *
 * Each data point becomes a radial-gradient circle.  The canvas's built-in
 * alpha compositing naturally blends overlapping circles, producing the
 * smooth heat effect.
 *
 * We draw in greyscale (white on black) — intensity is encoded purely in
 * the alpha channel.  This makes it trivial to read back a single intensity
 * value per pixel later.
 *
 * @param points     - Data points with lat, lng, and normalised intensity
 * @param canvasSize - Width & height of the offscreen canvas in pixels
 * @param blurRadius - Radius of each radial gradient in canvas pixels
 * @param bounds     - Geographic bounding box the canvas maps to
 * @returns Raw `ImageData` from the canvas
 */
function renderKDE(
  points: HeatmapPoint[],
  canvasSize: number,
  blurRadius: number,
  bounds: GeoBounds
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;

  // Start with a black canvas — zero intensity everywhere
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Use additive blending so overlapping gaussians accumulate
  ctx.globalCompositeOperation = "lighter";

  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Convert geo coordinates to canvas pixel coordinates
    const x = ((p.lng - bounds.west) / lngRange) * canvasSize;
    const y = ((bounds.north - p.lat) / latRange) * canvasSize; // y is flipped

    // Draw a radial gradient circle — intensity maps to alpha of white
    const grad = ctx.createRadialGradient(x, y, 0, x, y, blurRadius);
    const alpha = Math.min(1, p.intensity);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, blurRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  return ctx.getImageData(0, 0, canvasSize, canvasSize);
}

// ---------------------------------------------------------------------------
// Grid sampling
// ---------------------------------------------------------------------------

/**
 * Samples the KDE image at a regular grid and maps each cell's intensity
 * through the colour LUT.
 *
 * Cells whose intensity falls below `threshold` are set to `null` and the
 * renderer will skip them entirely — this is one of the biggest performance
 * wins since most heatmaps have large empty / near-zero areas.
 *
 * @param imageData  - The raw pixel data from `renderKDE`
 * @param rows       - Number of grid rows
 * @param cols       - Number of grid columns
 * @param scaleId    - Which colour scale to use
 * @param opacity    - Base opacity (0-1)
 * @param threshold  - Minimum intensity (0-255) to keep a cell
 * @returns Array of `rows × cols` entries (row-major), each an RGBA string or null
 */
function sampleGrid(
  imageData: ImageData,
  rows: number,
  cols: number,
  scaleId: ColorScaleId,
  opacity: number,
  threshold: number
): (string | null)[] {
  const lut = buildColorLUT(scaleId, opacity);
  const { data, width, height } = imageData;
  const cells: (string | null)[] = new Array(rows * cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Map grid cell centre to canvas pixel
      const px = Math.floor(((col + 0.5) / cols) * width);
      const py = Math.floor(((row + 0.5) / rows) * height);
      const idx = (py * width + px) * 4;

      // We drew in greyscale via "lighter" blending, so the red channel
      // (or any channel) represents the accumulated intensity.
      // Clamp to 255 in case additive blending pushed it higher.
      const intensity = Math.min(255, data[idx]);

      if (intensity < threshold) {
        cells[row * cols + col] = null;
      } else {
        cells[row * cols + col] = lut[intensity];
      }
    }
  }

  return cells;
}
