/**
 * Work location 3D marker helper.
 *
 * Creates and removes a Google Maps `Marker3DElement` to highlight the user's
 * work address on the 3D map. The marker is extruded (a vertical line connects
 * the pin to the ground) and labelled "Work" so it's immediately identifiable.
 *
 * Note: `Marker3DElement` is part of the `maps3d` library but is not yet
 * included in `@types/google.maps`, so we use type assertions when
 * destructuring it from the library.
 */

import type { WorkLocation } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Marker3DElement type shim
// ---------------------------------------------------------------------------

/**
 * Minimal type definition for Google Maps Marker3DElement constructor options.
 * Only the properties we actually use are listed here.
 */
interface Marker3DOptions {
  position: { lat: number; lng: number; altitude: number };
  altitudeMode: string;
  extruded: boolean;
  label: string;
  collisionBehavior: string;
  drawsWhenOccluded: boolean;
}

/**
 * Extended Maps3D library that includes the Marker3DElement constructor.
 * The official `@types/google.maps` does not expose this yet.
 */
interface Maps3DLibraryWithMarker extends google.maps.Maps3DLibrary {
  Marker3DElement: new (options: Marker3DOptions) => HTMLElement;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a 3D marker on the map at the given work location.
 *
 * The marker uses `RELATIVE_TO_GROUND` altitude mode and `extruded: true` so
 * a vertical line connects the pin to the terrain, making it highly visible
 * in the photorealistic 3D view.
 *
 * @param mapElement - The live `Map3DElement` to append the marker to.
 * @param workLocation - The user's work address with lat/lng coordinates.
 * @returns The created marker element (an `HTMLElement`) for later cleanup.
 */
export async function createWorkMarker(
  mapElement: google.maps.maps3d.Map3DElement,
  workLocation: WorkLocation
): Promise<HTMLElement> {
  const lib = (await google.maps.importLibrary(
    "maps3d"
  )) as Maps3DLibraryWithMarker;

  const marker = new lib.Marker3DElement({
    position: {
      lat: workLocation.lat,
      lng: workLocation.lng,
      altitude: 0,
    },
    altitudeMode: "RELATIVE_TO_GROUND",
    extruded: true,
    label: "Work",
    collisionBehavior: "REQUIRED",
    drawsWhenOccluded: true,
  });

  mapElement.appendChild(marker);
  return marker;
}

/**
 * Removes a previously created work marker from the map.
 *
 * Safe to call with `null` — the call is a no-op in that case.
 *
 * @param marker - The marker element returned by `createWorkMarker`, or `null`.
 */
export function removeWorkMarker(marker: HTMLElement | null): void {
  if (marker) {
    marker.remove();
  }
}
