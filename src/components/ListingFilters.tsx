"use client";

/**
 * ListingFilters — floating panel for filtering map listings by price range
 * and neighborhood.
 *
 * Uses the same glass-morphism design language as HeatmapPanel with
 * toggle-button rows for price buckets and neighborhood checkboxes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Preset price range bucket. `null` values mean "no bound". */
export interface PriceRange {
  label: string;
  min: number | null;
  max: number | null;
}

/** All available price range presets. */
export const PRICE_RANGES: PriceRange[] = [
  { label: "All", min: null, max: null },
  { label: "Under $3K", min: null, max: 3000 },
  { label: "$3K–$5K", min: 3000, max: 5000 },
  { label: "$5K–$8K", min: 5000, max: 8000 },
  { label: "$8K+", min: 8000, max: null },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingFiltersProps {
  /** Currently selected price range (matched by reference from PRICE_RANGES). */
  priceRange: PriceRange;
  /** Callback when the user taps a price toggle. */
  onPriceRangeChange: (range: PriceRange) => void;
  /** All available neighborhood names (from onboarding). */
  neighborhoods: string[];
  /** Currently checked neighborhood names. */
  selectedNeighborhoods: string[];
  /** Callback when the user toggles a neighborhood checkbox. */
  onNeighborhoodChange: (neighborhoods: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListingFilters({
  priceRange,
  onPriceRangeChange,
  neighborhoods,
  selectedNeighborhoods,
  onNeighborhoodChange,
}: ListingFiltersProps) {
  /**
   * Toggles a single neighborhood on or off in the selected list.
   *
   * @param name - The neighborhood name to toggle.
   */
  function handleNeighborhoodToggle(name: string) {
    if (selectedNeighborhoods.includes(name)) {
      onNeighborhoodChange(selectedNeighborhoods.filter((n) => n !== name));
    } else {
      onNeighborhoodChange([...selectedNeighborhoods, name]);
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 max-w-xs">
      {/* Price range toggles */}
      <label className="text-xs font-medium text-white/60 uppercase tracking-wide mb-2 block">
        Price Range
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PRICE_RANGES.map((range) => {
          const isActive =
            priceRange.min === range.min && priceRange.max === range.max;
          return (
            <button
              key={range.label}
              type="button"
              onClick={() => onPriceRangeChange(range)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* Neighborhood checkboxes (only shown if neighborhoods are available) */}
      {neighborhoods.length > 0 && (
        <div className="mt-3">
          <label className="text-xs font-medium text-white/60 uppercase tracking-wide mb-2 block">
            Neighborhoods
          </label>
          <div className="flex flex-wrap gap-1.5">
            {neighborhoods.map((name) => {
              const isActive = selectedNeighborhoods.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleNeighborhoodToggle(name)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/30 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
