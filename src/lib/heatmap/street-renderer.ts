/**
 * Street overlay renderer.
 *
 * Renders `StreetSegment[]` data as coloured `Polyline3DElement` instances
 * clamped to the ground.  Each street is coloured according to its normalised
 * score using the same colour LUT system as the grid renderer.
 *
 * Key performance strategies:
 *  - **Batched creation** — polylines are created in chunks per
 *    `requestAnimationFrame` so the main thread is never blocked.
 *  - **Element pooling** — when re-rendering, existing polylines are
 *    recycled (colour + coordinates updated) before new ones are created.
 */

import type { StreetSegment, ColorScaleId, LayerRenderer } from "./types";
import { buildColorLUT } from "./colorScales";
import { POLYGON_BATCH_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stroke width in pixels for street polylines. */
const STREET_STROKE_WIDTH = 6;

// ---------------------------------------------------------------------------
// Renderer class
// ---------------------------------------------------------------------------

export class StreetRenderer implements LayerRenderer {
  private polylines: google.maps.maps3d.Polyline3DElement[] = [];
  private mapElement: google.maps.maps3d.Map3DElement;
  private colorScale: ColorScaleId;
  private opacity: number;
  private renderAbort: AbortController | null = null;

  constructor(
    mapElement: google.maps.maps3d.Map3DElement,
    colorScale: ColorScaleId,
    opacity: number,
  ) {
    this.mapElement = mapElement;
    this.colorScale = colorScale;
    this.opacity = opacity;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Render street segments as coloured polylines on the map.
   *
   * @param data - Array of `StreetSegment` objects (typed as `unknown`
   *               to satisfy the `LayerRenderer` interface)
   */
  async render(data: unknown): Promise<void> {
    const segments = data as StreetSegment[];

    this.renderAbort?.abort();
    this.renderAbort = new AbortController();
    const { signal } = this.renderAbort;

    const lut = buildColorLUT(this.colorScale, this.opacity);

    const { Polyline3DElement } = (await google.maps.importLibrary(
      "maps3d",
    )) as google.maps.Maps3DLibrary;

    if (signal.aborted) return;

    const poolSize = this.polylines.length;
    let idx = 0;

    while (idx < segments.length) {
      if (signal.aborted) return;

      const batchEnd = Math.min(idx + POLYGON_BATCH_SIZE, segments.length);

      for (let i = idx; i < batchEnd; i++) {
        const seg = segments[i];
        const colorIdx = Math.round(seg.score * 255);
        const color = lut[colorIdx];
        const coords = seg.coordinates.map((c) => ({
          lat: c.lat,
          lng: c.lng,
          altitude: 0,
        }));

        if (i < poolSize) {
          const poly = this.polylines[i];
          poly.coordinates = coords;
          poly.strokeColor = color;
        } else {
          const poly = new Polyline3DElement({
            altitudeMode: "CLAMP_TO_GROUND" as google.maps.maps3d.AltitudeMode,
            strokeColor: color,
            strokeWidth: STREET_STROKE_WIDTH,
            drawsOccludedSegments: true,
          });
          poly.coordinates = coords;
          this.mapElement.appendChild(poly);
          this.polylines.push(poly);
        }
      }

      idx = batchEnd;

      if (idx < segments.length) {
        await this.yieldFrame();
      }
    }

    // Remove excess pooled polylines
    if (segments.length < poolSize) {
      for (let i = poolSize - 1; i >= segments.length; i--) {
        this.polylines[i].remove();
      }
      this.polylines.length = segments.length;
    }
  }

  /**
   * Update opacity of all rendered street polylines in-place.
   *
   * @param opacity - New opacity value (0-1)
   */
  setOpacity(opacity: number): void {
    this.opacity = opacity;
    for (const poly of this.polylines) {
      const current = poly.strokeColor as string;
      if (!current) continue;
      const match = current.match(
        /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
      );
      if (match) {
        const [, r, g, b] = match;
        const baseA = parseFloat(match[4]);
        const newA = Math.min(opacity, baseA > 0 ? opacity : 0).toFixed(3);
        poly.strokeColor = `rgba(${r}, ${g}, ${b}, ${newA})`;
      }
    }
  }

  /**
   * Remove all street polylines from the map.
   */
  clear(): void {
    this.renderAbort?.abort();
    for (const poly of this.polylines) {
      poly.remove();
    }
    this.polylines = [];
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Yield execution back to the browser for one animation frame.
   *
   * @returns Promise that resolves on the next animation frame
   */
  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
