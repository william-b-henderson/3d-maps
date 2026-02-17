"use client";

/**
 * NearbyPlacesPanel — consolidated glass-morphism card that lists the
 * nearest match for every active preference category (gym, park, coffee,
 * restaurant, etc.) alongside walking times and distances.
 *
 * Matches the existing design language (backdrop-blur, border-white/20,
 * rounded-2xl) used by CommutePanel, HeatmapPanel, and NeighborhoodPanel.
 */

import { NEARBY_CATEGORIES } from "@/lib/nearby/categories";
import type { NearbyPlaceResult } from "@/app/api/nearby-places/route";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NearbyPlacesPanelProps {
  /** Array of nearby-place results to display. */
  results: NearbyPlaceResult[];
  /** Whether the batch request is still in-flight. */
  isLoading?: boolean;
  /** The category ID currently being hovered, or null. */
  hoveredCategory?: string | null;
  /** Called when the user hovers/unhovers a result row. */
  onHover?: (category: string | null) => void;
  /** Whether the panel is collapsed to a pill. */
  isCollapsed?: boolean;
  /** Called when the user clicks the X to collapse the panel. */
  onCollapse: () => void;
  /** Called when the user clicks the pill to expand the panel. */
  onExpand: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NearbyPlacesPanel({
  results,
  isLoading = false,
  hoveredCategory = null,
  onHover,
  isCollapsed = false,
  onCollapse,
  onExpand,
}: NearbyPlacesPanelProps) {
  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="
          flex items-center gap-2 px-3 py-2
          bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          text-sm font-medium text-white/90
          hover:bg-white/20 hover:border-white/30
          active:scale-95 transition-all duration-200
        "
        title="Show nearby places panel"
      >
        <svg
          className="w-4 h-4 text-white/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
        Nearby Places
        {results.length > 0 && (
          <span className="bg-white/20 text-white/90 text-xs px-1.5 py-0.5 rounded-full">
            {results.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
          Nearby Places
        </label>
        <button
          type="button"
          onClick={onCollapse}
          className="text-white/40 hover:text-white/80 transition-colors duration-200 -mr-1 -mt-1 p-1"
          aria-label="Collapse nearby places panel"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {isLoading ? (
        /* Loading state */
        <div className="flex items-center gap-2 py-1">
          <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-white/70">Finding nearby places...</span>
        </div>
      ) : results.length === 0 ? (
        /* Empty state */
        <p className="text-sm text-white/50 py-1">No nearby places found.</p>
      ) : (
        /* Results list */
        <ul className="space-y-2.5">
          {results.map((r) => {
            const cat = NEARBY_CATEGORIES[r.category];
            const isHovered = hoveredCategory === r.category;
            return (
              <li
                key={r.category}
                className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-150 cursor-default ${
                  isHovered ? "bg-white/15" : "hover:bg-white/5"
                }`}
                onMouseEnter={() => onHover?.(r.category)}
                onMouseLeave={() => onHover?.(null)}
              >
                {/* Category icon */}
                <span className="text-base leading-5 shrink-0 mt-0.5">
                  {cat?.icon ?? "📍"}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Place name */}
                  <p
                    className={`text-sm font-semibold truncate transition-colors duration-150 ${
                      isHovered ? "text-white" : "text-white/90"
                    }`}
                  >
                    {r.name}
                  </p>

                  {/* Walking time + distance */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs transition-colors duration-150 ${
                        isHovered ? "text-white/90" : "text-white/70"
                      }`}
                    >
                      {r.walkingText}
                    </span>
                    <div className="w-px h-3 bg-white/20" />
                    <span
                      className={`text-xs transition-colors duration-150 ${
                        isHovered ? "text-white/70" : "text-white/50"
                      }`}
                    >
                      {r.walkingDistanceText}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
