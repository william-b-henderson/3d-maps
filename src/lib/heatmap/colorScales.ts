/**
 * Color scale utilities for heatmap rendering.
 *
 * Each scale is defined as a set of colour stops.  At build time we
 * pre-compute a 256-entry look-up table (LUT) so that mapping an intensity
 * value (0-255) to an RGBA string is a single array access — O(1).
 */

import type { ColorScaleId } from "./types";

// ---------------------------------------------------------------------------
// Colour stop definition
// ---------------------------------------------------------------------------

interface ColorStop {
  /** Position in the gradient, 0-1. */
  pos: number;
  /** RGB channels, each 0-255. */
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// Built-in gradient definitions
// ---------------------------------------------------------------------------

/**
 * Thermal: transparent → blue → cyan → green → yellow → red.
 * Classic heatmap palette — immediately recognisable.
 */
const THERMAL_STOPS: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 0 },
  { pos: 0.15, r: 0, g: 0, b: 255 },
  { pos: 0.35, r: 0, g: 255, b: 255 },
  { pos: 0.55, r: 0, g: 255, b: 0 },
  { pos: 0.75, r: 255, g: 255, b: 0 },
  { pos: 1.0, r: 255, g: 0, b: 0 },
];

/**
 * Viridis: perceptually uniform, colour-blind friendly.
 * Sampled from the matplotlib viridis palette.
 */
const VIRIDIS_STOPS: ColorStop[] = [
  { pos: 0.0, r: 68, g: 1, b: 84 },
  { pos: 0.25, r: 59, g: 82, b: 139 },
  { pos: 0.5, r: 33, g: 145, b: 140 },
  { pos: 0.75, r: 94, g: 201, b: 98 },
  { pos: 1.0, r: 253, g: 231, b: 37 },
];

/**
 * Inferno: dark → red → yellow → white.
 * Dramatic palette, great for emphasising hot-spots.
 */
const INFERNO_STOPS: ColorStop[] = [
  { pos: 0.0, r: 0, g: 0, b: 4 },
  { pos: 0.25, r: 87, g: 16, b: 110 },
  { pos: 0.5, r: 188, g: 55, b: 84 },
  { pos: 0.75, r: 249, g: 142, b: 9 },
  { pos: 1.0, r: 252, g: 255, b: 164 },
];

/** Map of scale IDs to their gradient stops. */
const SCALE_STOPS: Record<ColorScaleId, ColorStop[]> = {
  thermal: THERMAL_STOPS,
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS,
};

// ---------------------------------------------------------------------------
// Interpolation helpers
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate between two numbers.
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sample a gradient defined by colour stops at a normalised position.
 *
 * @param stops - Sorted array of colour stops
 * @param t - Position in the gradient (0-1)
 * @returns Interpolated [r, g, b] tuple
 */
function sampleGradient(
  stops: ColorStop[],
  t: number
): [number, number, number] {
  // Clamp
  if (t <= stops[0].pos) return [stops[0].r, stops[0].g, stops[0].b];
  const last = stops[stops.length - 1];
  if (t >= last.pos) return [last.r, last.g, last.b];

  // Find the two stops that bracket `t`
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.pos && t <= b.pos) {
      const localT = (t - a.pos) / (b.pos - a.pos);
      return [
        Math.round(lerp(a.r, b.r, localT)),
        Math.round(lerp(a.g, b.g, localT)),
        Math.round(lerp(a.b, b.b, localT)),
      ];
    }
  }

  return [last.r, last.g, last.b];
}

// ---------------------------------------------------------------------------
// LUT cache
// ---------------------------------------------------------------------------

/**
 * Cache key = `${scaleId}-${opacity}` (opacity rounded to 2 decimals).
 * Prevents rebuilding the LUT on every render when parameters haven't changed.
 */
const lutCache = new Map<string, string[]>();

/**
 * Build (or retrieve from cache) a 256-entry colour look-up table.
 *
 * Index 0 corresponds to zero intensity (fully transparent regardless of
 * the colour scale) and index 255 corresponds to maximum intensity.
 *
 * @param scaleId - Which built-in colour scale to use
 * @param opacity - Base opacity multiplier (0-1)
 * @returns 256-element array where each entry is an `"rgba(r,g,b,a)"` string
 */
export function buildColorLUT(scaleId: ColorScaleId, opacity: number): string[] {
  const key = `${scaleId}-${opacity.toFixed(2)}`;
  const cached = lutCache.get(key);
  if (cached) return cached;

  const lut: string[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; // normalised position
    const [r, g, b] = sampleGradient(SCALE_STOPS[scaleId], t);
    // Alpha ramps from 0 at intensity=0 to `opacity` at intensity=255.
    // This keeps low-intensity cells nearly invisible, reinforcing the
    // smooth fade-to-nothing effect at the edges of the heatmap.
    const a = (t * opacity).toFixed(3);
    lut[i] = `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  lutCache.set(key, lut);
  return lut;
}

/**
 * Clear the LUT cache.  Useful when colour scale parameters change and
 * stale entries should be garbage-collected.
 */
export function clearColorCache(): void {
  lutCache.clear();
}
