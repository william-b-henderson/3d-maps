/**
 * 3D route polyline renderer.
 *
 * Creates and removes a `Polyline3DElement` on the Google Maps 3D map to
 * visualise a driving route. The polyline is clamped to the ground so it
 * follows terrain, and `drawsOccludedSegments` is enabled so the line
 * remains visible even when buildings sit between the camera and the route.
 *
 * Note: `Polyline3DElement` is part of the `maps3d` library and *is*
 * included in `@types/google.maps` via `Maps3DLibrary`.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for customising the rendered route polyline.
 */
export interface RenderRouteOptions {
  /** Stroke colour (any CSS colour string). Defaults to blue-500. */
  strokeColor?: string;
  /** Stroke width in pixels. Defaults to 10. */
  strokeWidth?: number;
}

/**
 * Renders a route on the 3D map as a styled polyline.
 *
 * @param mapElement - The live `Map3DElement` to append the polyline to.
 * @param coords - Array of {lat, lng} coordinates representing the route path.
 * @param options - Optional style overrides (colour, width).
 * @returns The created `Polyline3DElement` for later cleanup.
 */
export async function renderRoute(
  mapElement: google.maps.maps3d.Map3DElement,
  coords: Array<{ lat: number; lng: number }>,
  options?: RenderRouteOptions
): Promise<google.maps.maps3d.Polyline3DElement> {
  const { Polyline3DElement } = (await google.maps.importLibrary(
    "maps3d"
  )) as google.maps.Maps3DLibrary;

  const polyline = new Polyline3DElement({
    altitudeMode: "CLAMP_TO_GROUND" as google.maps.maps3d.AltitudeMode,
    strokeColor: options?.strokeColor ?? "rgba(59, 130, 246, 0.9)", // blue-500
    strokeWidth: options?.strokeWidth ?? 10,
    drawsOccludedSegments: true,
  });

  // Polyline3DElement expects coordinates with altitude
  polyline.coordinates = coords.map((c) => ({
    lat: c.lat,
    lng: c.lng,
    altitude: 0,
  }));

  mapElement.appendChild(polyline);
  return polyline;
}

/**
 * Removes a previously rendered route polyline from the map.
 *
 * Safe to call with `null` — the call is a no-op in that case.
 *
 * @param polyline - The polyline element returned by `renderRoute`, or `null`.
 */
export function removeRoute(
  polyline: google.maps.maps3d.Polyline3DElement | null
): void {
  if (polyline) {
    polyline.remove();
  }
}
