/**
 * Heatmap polygon grid renderer.
 *
 * Manages the lifecycle of `Polygon3DElement` instances that visualise a
 * pre-computed `HeatmapGrid` on the 3D map.
 *
 * Key performance strategies:
 *  - **Batched creation** — polygons are created in chunks per
 *    `requestAnimationFrame` so the main thread is never blocked.
 *  - **Element pooling** — when switching layers the renderer reuses
 *    existing polygon DOM elements (updating coords + colour) instead of
 *    tearing down and recreating thousands of elements.
 *  - **Null-cell skipping** — cells below the intensity threshold are
 *    never instantiated.
 *  - **Zero stroke** — no borders between cells for a seamless look.
 */

import type { HeatmapGrid } from "./types";
import { POLYGON_BATCH_SIZE, HEATMAP_ALTITUDE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal info needed to create or update a polygon. */
interface CellData {
  coords: Array<{ lat: number; lng: number; altitude: number }>;
  fillColor: string;
}

// ---------------------------------------------------------------------------
// Renderer class
// ---------------------------------------------------------------------------

export class HeatmapRenderer {
  /** Active polygon elements currently attached to the map. */
  private polygons: google.maps.maps3d.Polygon3DElement[] = [];

  /** Reference to the host Map3DElement. */
  private mapElement: google.maps.maps3d.Map3DElement;

  /** Abort controller for in-flight batched renders. */
  private renderAbort: AbortController | null = null;

  constructor(mapElement: google.maps.maps3d.Map3DElement) {
    this.mapElement = mapElement;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Render a pre-computed heatmap grid onto the map.
   *
   * If a previous render is still in-flight it is cancelled first.
   * Polygons are created (or recycled from the pool) in batches to keep
   * the main thread responsive.
   *
   * @param grid - Pre-computed grid from the KDE engine
   */
  async render(grid: HeatmapGrid): Promise<void> {
    // Cancel any in-flight render
    this.renderAbort?.abort();
    this.renderAbort = new AbortController();
    const { signal } = this.renderAbort;

    // Build the list of cells that actually need a polygon
    const cellsToRender = this.buildCellData(grid);

    // Resolve the Polygon3DElement constructor once
    const { Polygon3DElement } = (await google.maps.importLibrary(
      "maps3d"
    )) as google.maps.Maps3DLibrary;

    if (signal.aborted) return;

    // Decide whether to pool or create fresh
    const poolSize = this.polygons.length;
    let cellIdx = 0;

    // Process in batches
    while (cellIdx < cellsToRender.length) {
      if (signal.aborted) return;

      const batchEnd = Math.min(
        cellIdx + POLYGON_BATCH_SIZE,
        cellsToRender.length
      );

      for (let i = cellIdx; i < batchEnd; i++) {
        const cell = cellsToRender[i];

        if (i < poolSize) {
          // ---- RECYCLE an existing polygon ----
          const poly = this.polygons[i];
          poly.outerCoordinates = cell.coords;
          poly.fillColor = cell.fillColor;
        } else {
          // ---- CREATE a new polygon ----
          // Use RELATIVE_TO_GROUND with a small altitude so the polygon
          // renders as a thin extruded slab on the terrain surface.
          // extruded: true is required for the 3D renderer to draw the fill.
          const poly = new Polygon3DElement({
            altitudeMode: "RELATIVE_TO_GROUND",
            fillColor: cell.fillColor,
            strokeColor: "rgba(0, 0, 0, 0)",
            strokeWidth: 0,
            extruded: true,
            drawsOccludedSegments: true,
          });
          poly.outerCoordinates = cell.coords;
          this.mapElement.appendChild(poly);
          this.polygons.push(poly);
        }
      }

      cellIdx = batchEnd;

      // Yield to the browser between batches
      if (cellIdx < cellsToRender.length) {
        await this.yieldFrame();
      }
    }

    // Remove excess pooled polygons that are no longer needed
    if (cellsToRender.length < poolSize) {
      for (let i = poolSize - 1; i >= cellsToRender.length; i--) {
        this.polygons[i].remove();
      }
      this.polygons.length = cellsToRender.length;
    }
  }

  /**
   * Update the opacity of all currently rendered polygons without
   * recreating them.  This parses each cell's existing colour, swaps the
   * alpha value, and writes it back.
   *
   * @param opacity - New opacity value (0-1)
   */
  setOpacity(opacity: number): void {
    for (const poly of this.polygons) {
      const current = poly.fillColor as string;
      if (!current) continue;
      // Replace the alpha component in "rgba(r, g, b, a)"
      const match = current.match(
        /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/
      );
      if (match) {
        const [, r, g, b, oldA] = match;
        // Scale: the LUT encodes intensity-based alpha; we scale proportionally
        const baseA = parseFloat(oldA);
        // We don't know the original opacity that was baked in, so we just
        // set to the new desired alpha. The colour scale already ramps alpha
        // by intensity, so we cap at the requested opacity.
        const newA = Math.min(opacity, baseA > 0 ? opacity : 0).toFixed(3);
        poly.fillColor = `rgba(${r}, ${g}, ${b}, ${newA})`;
      }
    }
  }

  /**
   * Remove all heatmap polygons from the map and reset the pool.
   */
  clear(): void {
    this.renderAbort?.abort();
    for (const poly of this.polygons) {
      poly.remove();
    }
    this.polygons = [];
  }

  /**
   * Returns the current number of active polygon elements.
   * Useful for debugging / performance monitoring.
   */
  get polygonCount(): number {
    return this.polygons.length;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Convert a `HeatmapGrid` into an array of `CellData` objects, skipping
   * null (below-threshold) cells.
   *
   * Each cell is a small rectangle defined by four lat/lng corners with
   * altitude 0 (clamped to ground).
   *
   * @param grid - The pre-computed heatmap grid
   * @returns Array of non-null cell data ready for polygon creation
   */
  private buildCellData(grid: HeatmapGrid): CellData[] {
    const { bounds, rows, cols, cells } = grid;
    const latStep = (bounds.north - bounds.south) / rows;
    const lngStep = (bounds.east - bounds.west) / cols;
    const result: CellData[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = cells[row * cols + col];
        if (color === null) continue;

        const south = bounds.north - (row + 1) * latStep;
        const north = bounds.north - row * latStep;
        const west = bounds.west + col * lngStep;
        const east = bounds.west + (col + 1) * lngStep;

        result.push({
          coords: [
            { lat: south, lng: west, altitude: HEATMAP_ALTITUDE },
            { lat: south, lng: east, altitude: HEATMAP_ALTITUDE },
            { lat: north, lng: east, altitude: HEATMAP_ALTITUDE },
            { lat: north, lng: west, altitude: HEATMAP_ALTITUDE },
            { lat: south, lng: west, altitude: HEATMAP_ALTITUDE }, // close the ring
          ],
          fillColor: color,
        });
      }
    }

    return result;
  }

  /**
   * Yield execution back to the browser for one animation frame.
   * Used between polygon-creation batches to keep the UI responsive.
   *
   * @returns Promise that resolves on the next animation frame
   */
  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
