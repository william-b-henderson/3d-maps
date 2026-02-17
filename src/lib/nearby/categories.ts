/**
 * Nearby place category definitions.
 *
 * Maps onboarding preference IDs to Google Places search queries, display
 * labels, icons, and walking-route colours. Categories that represent
 * neighbourhood qualities rather than searchable places (safety, noise) are
 * intentionally excluded.
 */

import type { ImportanceRating } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

/**
 * Configuration for a single nearby-place category.
 */
export interface NearbyCategory {
  /** Google Places text-search query string. */
  query: string;
  /** Short display label (e.g. "Gym"). */
  label: string;
  /** Emoji icon shown in the panel. */
  icon: string;
  /** CSS colour string for the walking-route polyline. */
  routeColor: string;
}

/**
 * All supported nearby-place categories, keyed by onboarding preference ID.
 */
export const NEARBY_CATEGORIES: Record<string, NearbyCategory> = {
  fitness: {
    query: "gym",
    label: "Gym",
    icon: "💪",
    routeColor: "rgba(34, 197, 94, 0.85)",
  },
  outdoors: {
    query: "park",
    label: "Park",
    icon: "🌿",
    routeColor: "rgba(22, 163, 74, 0.85)",
  },
  daily_rituals: {
    query: "coffee shop",
    label: "Coffee",
    icon: "☕",
    routeColor: "rgba(139, 90, 43, 0.85)",
  },
  food_social: {
    query: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    routeColor: "rgba(239, 68, 68, 0.85)",
  },
  nightlife: {
    query: "bar",
    label: "Bar",
    icon: "🌙",
    routeColor: "rgba(168, 85, 247, 0.85)",
  },
  convenience: {
    query: "grocery store",
    label: "Grocery",
    icon: "🛒",
    routeColor: "rgba(20, 184, 166, 0.85)",
  },
  walkability: {
    query: "transit station",
    label: "Transit",
    icon: "🚶",
    routeColor: "rgba(107, 114, 128, 0.85)",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the preference IDs that the user rated >= 3 (interested / very
 * important) AND that have a matching entry in NEARBY_CATEGORIES.
 *
 * @param preferences - The user's importance ratings from onboarding Step 3.
 * @returns Array of category IDs that should trigger a nearby-place search.
 */
export function getActiveCategories(
  preferences: Record<string, ImportanceRating>
): string[] {
  return Object.entries(preferences)
    .filter(([id, rating]) => rating >= 3 && id in NEARBY_CATEGORIES)
    .map(([id]) => id);
}
