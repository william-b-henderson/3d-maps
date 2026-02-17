/**
 * Listing 3D marker helper.
 *
 * Creates and removes Google Maps `Marker3DInteractiveElement` instances to
 * display property listings on the 3D map. Each marker renders a circular
 * price badge as a pre-rendered canvas image.
 *
 * `Marker3DInteractiveElement` (rather than the plain `Marker3DElement`) is
 * required for click handling — only the interactive variant fires the
 * `gmp-click` event.
 *
 * Note: `Marker3DInteractiveElement` is part of the `maps3d` library but is
 * not yet included in `@types/google.maps`, so we use type assertions when
 * destructuring it from the library.
 */

import type { ListingMarkerData } from "@/lib/types/listing";
import { formatPrice } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Marker3DInteractiveElement type shim
// ---------------------------------------------------------------------------

/**
 * Minimal type definition for the interactive marker constructor options.
 */
interface Marker3DInteractiveOptions {
  position: { lat: number; lng: number; altitude: number };
  altitudeMode: string;
  extruded: boolean;
  collisionBehavior: string;
  drawsWhenOccluded: boolean;
}

/**
 * Extended Maps3D library that includes the Marker3DInteractiveElement
 * constructor. The official `@types/google.maps` does not expose this yet.
 */
interface Maps3DLibraryWithInteractiveMarker extends google.maps.Maps3DLibrary {
  Marker3DInteractiveElement: new (
    options: Marker3DInteractiveOptions
  ) => HTMLElement;
}

// ---------------------------------------------------------------------------
// Canvas rendering — circular price badge
// ---------------------------------------------------------------------------

/** Diameter (in canvas pixels) for the circular marker. */
const PIN_SIZE = 36;

/**
 * Renders a circular price badge as a canvas-backed `<template>` element.
 * The badge is a filled circle with the price text centred inside.
 *
 * @param priceText - The formatted price string (e.g. "$3K").
 * @returns A `<template>` element containing the `<img>`, ready for a marker.
 */
function buildCirclePinTemplate(priceText: string): HTMLTemplateElement {
  const canvas = document.createElement("canvas");
  canvas.width = PIN_SIZE;
  canvas.height = PIN_SIZE;

  const ctx = canvas.getContext("2d")!;
  const cx = PIN_SIZE / 2;
  const cy = PIN_SIZE / 2;
  const radius = PIN_SIZE / 2;

  // Filled circle background
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fill();

  // Subtle border ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Price text (centred)
  ctx.font =
    '700 9px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(priceText, cx, cy + 0.5);

  // Wrap in <template> > <img>
  const dataUrl = canvas.toDataURL("image/png");
  const img = document.createElement("img");
  img.src = dataUrl;

  const template = document.createElement("template");
  template.content.appendChild(img);
  return template;
}

// ---------------------------------------------------------------------------
// Re-export formatPrice from shared utility
// ---------------------------------------------------------------------------

export { formatPrice } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates an interactive 3D marker on the map for a listing, rendered as a
 * circular price badge. Uses `Marker3DInteractiveElement` so the `gmp-click`
 * event fires when the user taps the marker.
 *
 * @param mapElement - The live `Map3DElement` to append the marker to.
 * @param listing - The listing's marker data (coordinates, price, etc.).
 * @param onClick - Optional callback invoked with the listing when clicked.
 * @returns The created marker element for later cleanup.
 */
export async function createListingMarker(
  mapElement: google.maps.maps3d.Map3DElement,
  listing: ListingMarkerData,
  onClick?: (listing: ListingMarkerData) => void
): Promise<HTMLElement> {
  const lib = (await google.maps.importLibrary(
    "maps3d"
  )) as Maps3DLibraryWithInteractiveMarker;

  const marker = new lib.Marker3DInteractiveElement({
    position: {
      lat: listing.latitude,
      lng: listing.longitude,
      altitude: 0,
    },
    altitudeMode: "RELATIVE_TO_GROUND",
    extruded: true,
    collisionBehavior: "REQUIRED",
    drawsWhenOccluded: true,
  });

  const template = buildCirclePinTemplate(formatPrice(listing.price));
  marker.appendChild(template);

  if (onClick) {
    marker.addEventListener("gmp-click", () => onClick(listing));
  }

  mapElement.appendChild(marker);
  return marker;
}

/**
 * Removes a single listing marker from the map.
 *
 * Safe to call with `null` — the call is a no-op in that case.
 *
 * @param marker - The marker element returned by `createListingMarker`, or `null`.
 */
export function removeListingMarker(marker: HTMLElement | null): void {
  if (marker) {
    marker.remove();
  }
}

/**
 * Removes all listing markers from the map and clears the array.
 *
 * @param markers - Array of marker elements to remove. Will be emptied in place.
 */
export function removeAllListingMarkers(markers: HTMLElement[]): void {
  for (const marker of markers) {
    marker.remove();
  }
  markers.length = 0;
}
