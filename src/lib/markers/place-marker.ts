/**
 * Generic nearby-place 3D marker helper.
 *
 * Creates and removes Google Maps `Marker3DElement` instances to highlight
 * nearby places (gyms, parks, coffee shops, etc.) and the searched address
 * on the 3D map. Each marker renders a compact glass-card as a pre-rendered
 * canvas image (PNG data URL) for crisp text at any zoom level.
 *
 * The canvas approach bypasses the SVG/foreignObject path entirely, giving
 * full control over the rasterisation resolution. The resulting `<img>`
 * element is a natively accepted type for `Marker3DElement` templates.
 *
 * Note: `Marker3DElement` is part of the `maps3d` library but is not yet
 * included in `@types/google.maps`, so we use type assertions when
 * destructuring it from the library.
 */

import { NEARBY_CATEGORIES } from "@/lib/nearby/categories";

// ---------------------------------------------------------------------------
// Marker3DElement type shim
// ---------------------------------------------------------------------------

/**
 * Minimal type definition for Google Maps Marker3DElement constructor options.
 */
interface Marker3DOptions {
  position: { lat: number; lng: number; altitude: number };
  altitudeMode: string;
  extruded: boolean;
  collisionBehavior: string;
  drawsWhenOccluded: boolean;
}

/**
 * Extended Maps3D library that includes the Marker3DElement constructor.
 */
interface Maps3DLibraryWithMarker extends google.maps.Maps3DLibrary {
  Marker3DElement: new (options: Marker3DOptions) => HTMLElement;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Location data needed to place a generic nearby-place marker on the map.
 */
export interface PlaceMarkerLocation {
  lat: number;
  lng: number;
  name: string;
  /** Preference category ID (e.g. "fitness") used to look up the emoji. */
  category: string;
}

/**
 * Location data needed to place a searched-address marker on the map.
 */
export interface SearchedAddressLocation {
  lat: number;
  lng: number;
  /** Just the street portion, e.g. "2140 Divisadero St". */
  streetAddress: string;
  /** Optional altitude in meters above ground to position the marker. */
  altitude?: number;
}

// ---------------------------------------------------------------------------
// Canvas rendering helpers
// ---------------------------------------------------------------------------

/**
 * Canvas pixel dimensions. The 3D map renderer uses the intrinsic PNG pixel
 * size directly as the marker texture, so these values control the actual
 * on-map size of the marker.
 */
const CANVAS_W = 120;
const CANVAS_H = 28;

/**
 * Draws a rounded rectangle path on the canvas context.
 *
 * @param ctx - The 2D canvas context.
 * @param x - Top-left x coordinate.
 * @param y - Top-left y coordinate.
 * @param w - Rectangle width.
 * @param h - Rectangle height.
 * @param r - Corner radius.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Truncates a string with an ellipsis if it exceeds the given pixel width
 * when measured with the current canvas font.
 *
 * @param ctx - The 2D canvas context (font must already be set).
 * @param text - The original text.
 * @param maxWidth - Maximum allowed width in canvas pixels.
 * @returns The (possibly truncated) string.
 */
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

/**
 * Renders a compact glass-card image with an icon on the left and a text
 * label on the right, returning an `<img>` element wrapping the PNG data URL.
 *
 * @param icon - The emoji or symbol string shown on the left.
 * @param label - The text label shown on the right.
 * @returns A `<template>` element containing the `<img>`, ready to append
 *   to a Marker3DElement.
 */
export function buildGlassCardTemplate(icon: string, label: string): HTMLTemplateElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const ctx = canvas.getContext("2d")!;

  // -- Background: semi-transparent rounded rect with subtle border ----------
  const borderW = 1;
  const radius = 6;

  // Fill
  roundedRect(ctx, 0, 0, CANVAS_W, CANVAS_H, radius);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fill();

  // Border (inset by half the stroke width)
  const half = borderW / 2;
  roundedRect(ctx, half, half, CANVAS_W - borderW, CANVAS_H - borderW, radius - half);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = borderW;
  ctx.stroke();

  // -- Emoji icon on the left ------------------------------------------------
  const paddingX = 6;
  const gap = 4;

  ctx.font = '14px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(icon, paddingX, CANVAS_H / 2);

  const emojiWidth = ctx.measureText(icon).width;

  // -- Place name on the right -----------------------------------------------
  ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = "white";

  const nameX = paddingX + emojiWidth + gap;
  const maxNameWidth = CANVAS_W - nameX - paddingX;
  const displayName = truncateText(ctx, label, maxNameWidth);
  ctx.fillText(displayName, nameX, CANVAS_H / 2 + 1);

  // -- Convert to <img> inside a <template> ----------------------------------
  const dataUrl = canvas.toDataURL("image/png");

  const img = document.createElement("img");
  img.src = dataUrl;

  const template = document.createElement("template");
  template.content.appendChild(img);

  return template;
}

// ---------------------------------------------------------------------------
// Marker3DElement factory
// ---------------------------------------------------------------------------

/**
 * Creates a `Marker3DElement` at the given coordinates, ready for a custom
 * template to be appended.
 *
 * @param lib - The maps3d library reference.
 * @param lat - Latitude.
 * @param lng - Longitude.
 * @param altitude - Altitude in meters above ground (default 0).
 * @returns The newly created marker element.
 */
function createBaseMarker(
  lib: Maps3DLibraryWithMarker,
  lat: number,
  lng: number,
  altitude: number = 0
): HTMLElement {
  return new lib.Marker3DElement({
    position: { lat, lng, altitude },
    altitudeMode: "RELATIVE_TO_GROUND",
    extruded: true,
    collisionBehavior: "REQUIRED",
    drawsWhenOccluded: true,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a 3D marker on the map at the given place location, rendered as
 * a compact glass-card with the category emoji and place name.
 *
 * @param mapElement - The live `Map3DElement` to append the marker to.
 * @param location - The place's coordinates, display name, and category.
 * @returns The created marker element for later cleanup.
 */
export async function createPlaceMarker(
  mapElement: google.maps.maps3d.Map3DElement,
  location: PlaceMarkerLocation
): Promise<HTMLElement> {
  const lib = (await google.maps.importLibrary(
    "maps3d"
  )) as Maps3DLibraryWithMarker;

  const marker = createBaseMarker(lib, location.lat, location.lng);

  // Look up the category emoji; fall back to a generic pin icon.
  const cat = NEARBY_CATEGORIES[location.category];
  const icon = cat?.icon ?? "📍";

  const template = buildGlassCardTemplate(icon, location.name);
  marker.appendChild(template);

  mapElement.appendChild(marker);
  return marker;
}

/**
 * Creates a 3D marker at the searched address, showing a pin icon and the
 * street address in a compact glass card.
 *
 * @param mapElement - The live `Map3DElement` to append the marker to.
 * @param location - The searched address coordinates and street name.
 * @returns The created marker element for later cleanup.
 */
export async function createSearchedAddressMarker(
  mapElement: google.maps.maps3d.Map3DElement,
  location: SearchedAddressLocation
): Promise<HTMLElement> {
  const lib = (await google.maps.importLibrary(
    "maps3d"
  )) as Maps3DLibraryWithMarker;

  const marker = createBaseMarker(lib, location.lat, location.lng, location.altitude ?? 0);

  const template = buildGlassCardTemplate("📍", location.streetAddress);
  marker.appendChild(template);

  mapElement.appendChild(marker);
  return marker;
}

/**
 * Removes a previously created place marker from the map.
 *
 * Safe to call with `null` — the call is a no-op in that case.
 *
 * @param marker - The marker element returned by `createPlaceMarker` or
 *   `createSearchedAddressMarker`, or `null`.
 */
export function removePlaceMarker(marker: HTMLElement | null): void {
  if (marker) {
    marker.remove();
  }
}
