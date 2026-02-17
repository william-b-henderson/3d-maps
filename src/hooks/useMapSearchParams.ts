"use client";

/**
 * Centralised URL search-param definitions for the main map page.
 *
 * Each param is declared with a `nuqs` parser so the value is automatically
 * serialised to / deserialised from the browser URL bar. This means state
 * survives page navigations (e.g. going to a listing detail page and pressing
 * back) and is shareable via URL.
 *
 * All params use `{ shallow: true }` so changes never trigger a server-side
 * re-render, and `{ history: "push" }` so the browser back button restores
 * previous states.
 */

import { useQueryState, parseAsString, parseAsFloat, parseAsArrayOf } from "nuqs";
import { PRICE_RANGES, type PriceRange } from "@/components/ListingFilters";
import { DEFAULT_LAYER_OPACITY } from "@/lib/heatmap/constants";

/** Shared options applied to every param in this hook. */
const SHARED_OPTIONS = { shallow: true, history: "push" as const };

/**
 * Looks up a `PriceRange` object by its label string.
 *
 * @param label - The label to search for (e.g. "Under $3K").
 * @returns The matching `PriceRange`, or the first entry ("All") if not found.
 */
function findPriceRange(label: string | null): PriceRange {
  if (!label) return PRICE_RANGES[0];
  return PRICE_RANGES.find((r) => r.label === label) ?? PRICE_RANGES[0];
}

/**
 * Hook that exposes every persistable map-page state value as a URL
 * search-param pair `[value, setValue]`.
 *
 * @returns An object with getters/setters for each param.
 */
export function useMapSearchParams() {
  // -- Price range (stored as the human-readable label) --------------------
  const [priceLabel, setPriceLabel] = useQueryState(
    "price",
    parseAsString.withOptions(SHARED_OPTIONS),
  );
  const priceRange = findPriceRange(priceLabel);

  /**
   * Updates the price-range URL param.  Passing the default ("All") clears
   * the param from the URL to keep it tidy.
   */
  const setPriceRange = (range: PriceRange) => {
    setPriceLabel(range.label === PRICE_RANGES[0].label ? null : range.label);
  };

  // -- Neighborhood filter (comma-separated list) --------------------------
  const [filterNeighborhoodsRaw, setFilterNeighborhoodsRaw] = useQueryState(
    "neighborhoods",
    parseAsArrayOf(parseAsString, ",").withOptions(SHARED_OPTIONS),
  );

  /**
   * Updates the neighborhood filter URL param. Passing an empty array
   * clears the param from the URL to keep it tidy.
   */
  const setFilterNeighborhoods = (neighborhoods: string[]) => {
    setFilterNeighborhoodsRaw(neighborhoods.length > 0 ? neighborhoods : null);
  };

  // -- Selected listing zpid -----------------------------------------------
  const [selectedZpid, setSelectedZpid] = useQueryState(
    "listing",
    parseAsString.withOptions(SHARED_OPTIONS),
  );

  // -- Active heatmap layer ------------------------------------------------
  const [activeHeatmapId, setActiveHeatmapId] = useQueryState(
    "heatmap",
    parseAsString.withOptions(SHARED_OPTIONS),
  );

  // -- Heatmap opacity -----------------------------------------------------
  const [heatmapOpacity, setHeatmapOpacity] = useQueryState(
    "opacity",
    parseAsFloat.withDefault(DEFAULT_LAYER_OPACITY).withOptions(SHARED_OPTIONS),
  );

  return {
    /** Derived PriceRange object (never null). */
    priceRange,
    /** Set the active price range (updates URL). */
    setPriceRange,

    /** Currently selected neighborhood names (empty array when none). */
    filterNeighborhoods: filterNeighborhoodsRaw ?? [],
    /** Replace the full neighborhood selection (updates URL). */
    setFilterNeighborhoods,

    /** zpid of the currently selected listing, or `null`. */
    selectedZpid,
    /** Set or clear the selected listing zpid (updates URL). */
    setSelectedZpid,

    /** ID of the active heatmap layer, or `null`. */
    activeHeatmapId,
    /** Set or clear the active heatmap layer (updates URL). */
    setActiveHeatmapId,

    /** Current heatmap opacity (defaults to DEFAULT_LAYER_OPACITY). */
    heatmapOpacity,
    /** Set the heatmap opacity (updates URL). */
    setHeatmapOpacity,
  };
}
