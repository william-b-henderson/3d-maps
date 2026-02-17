/**
 * Intersection dot renderer.
 *
 * Renders `ScoredIntersection[]` data as small coloured circular polygons
 * at each intersection point on the 3D map.  Each dot is coloured according
 * to its normalised score using the colour LUT system.
 *
 * Key performance strategies:
 *  - **Batched creation** — polygons are created in chunks per
 *    `requestAnimationFrame` so the main thread is never blocked.
 *  - **Element pooling** — when re-rendering, existing polygons are
 *    recycled before new ones are created.
 */

import type { ScoredIntersection, ColorScaleId, LayerRenderer } from "./types";
import { buildColorLUT } from "./colorScales";
import { POLYGON_BATCH_SIZE, HEATMAP_ALTITUDE } from "./constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Radius of each intersection dot in metres. */
const DOT_RADIUS_METERS = 25;

/** Number of vertices per circle polygon. 12 gives a smooth-enough circle. */
const CIRCLE_VERTICES = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a circle of lat/lng coordinates centred on a point.
 *
 * Uses a flat-Earth approximation (valid at city scale) where 1 degree
 * latitude ≈ 111,320 m and 1 degree longitude ≈ 111,320 * cos(lat) m.
 *
 * @param lat - Centre latitude
 * @param lng - Centre longitude
 * @param radiusM - Radius in metres
 * @param numVertices - Number of vertices in the circle
 * @returns Array of coordinates forming a closed ring
 */
function circleCoords(
  lat: number,
  lng: number,
  radiusM: number,
  numVertices: number,
): Array<{ lat: number; lng: number; altitude: number }> {
  const coords: Array<{ lat: number; lng: number; altitude: number }> = [];
  const latDeg = radiusM / 111_320;
  const lngDeg = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= numVertices; i++) {
    const angle = (2 * Math.PI * i) / numVertices;
    coords.push({
      lat: lat + latDeg * Math.sin(angle),
      lng: lng + lngDeg * Math.cos(angle),
      altitude: HEATMAP_ALTITUDE,
    });
  }

  return coords;
}

// ---------------------------------------------------------------------------
// Renderer class
// ---------------------------------------------------------------------------

export class IntersectionRenderer implements LayerRenderer {
  private polygons: google.maps.maps3d.Polygon3DElement[] = [];
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
   * Render intersection dots as coloured circle polygons on the map.
   *
   * @param data - Array of `ScoredIntersection` objects (typed as `unknown`
   *               to satisfy the `LayerRenderer` interface)
   */
  async render(data: unknown): Promise<void> {
    const intersections = data as ScoredIntersection[];

    this.renderAbort?.abort();
    this.renderAbort = new AbortController();
    const { signal } = this.renderAbort;

    const lut = buildColorLUT(this.colorScale, this.opacity);

    const { Polygon3DElement } = (await google.maps.importLibrary(
      "maps3d",
    )) as google.maps.Maps3DLibrary;

    if (signal.aborted) return;

    const poolSize = this.polygons.length;
    let idx = 0;

    while (idx < intersections.length) {
      if (signal.aborted) return;

      const batchEnd = Math.min(
        idx + POLYGON_BATCH_SIZE,
        intersections.length,
      );

      for (let i = idx; i < batchEnd; i++) {
        const pt = intersections[i];
        const colorIdx = Math.round(pt.score * 255);
        const color = lut[colorIdx];
        const coords = circleCoords(
          pt.lat,
          pt.lng,
          DOT_RADIUS_METERS,
          CIRCLE_VERTICES,
        );

        if (i < poolSize) {
          const poly = this.polygons[i];
          poly.outerCoordinates = coords;
          poly.fillColor = color;
        } else {
          const poly = new Polygon3DElement({
            altitudeMode: "RELATIVE_TO_GROUND",
            fillColor: color,
            strokeColor: "rgba(0, 0, 0, 0)",
            strokeWidth: 0,
            extruded: false,
            drawsOccludedSegments: true,
          });
          poly.outerCoordinates = coords;
          this.mapElement.appendChild(poly);
          this.polygons.push(poly);
        }
      }

      idx = batchEnd;

      if (idx < intersections.length) {
        await this.yieldFrame();
      }
    }

    // Remove excess pooled polygons
    if (intersections.length < poolSize) {
      for (let i = poolSize - 1; i >= intersections.length; i--) {
        this.polygons[i].remove();
      }
      this.polygons.length = intersections.length;
    }
  }

  /**
   * Update opacity of all rendered intersection dots in-place.
   *
   * @param opacity - New opacity value (0-1)
   */
  setOpacity(opacity: number): void {
    this.opacity = opacity;
    for (const poly of this.polygons) {
      const current = poly.fillColor as string;
      if (!current) continue;
      const match = current.match(
        /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
      );
      if (match) {
        const [, r, g, b] = match;
        const baseA = parseFloat(match[4]);
        const newA = Math.min(opacity, baseA > 0 ? opacity : 0).toFixed(3);
        poly.fillColor = `rgba(${r}, ${g}, ${b}, ${newA})`;
      }
    }
  }

  /**
   * Remove all intersection dots from the map.
   */
  clear(): void {
    this.renderAbort?.abort();
    for (const poly of this.polygons) {
      poly.remove();
    }
    this.polygons = [];
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
