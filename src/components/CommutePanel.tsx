"use client";

/**
 * CommutePanel — floating glass-morphism card showing the driving commute
 * time and distance from the searched address to the user's work location.
 *
 * Matches the existing design language used by HeatmapPanel and
 * NeighborhoodPanel (backdrop-blur, border-white/20, rounded-2xl).
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommutePanelProps {
  /** Human-readable drive duration (e.g. "23 min"). */
  durationText: string;
  /** Human-readable distance (e.g. "8.4 mi"). */
  distanceText: string;
  /** Whether the directions request is still loading. */
  isLoading?: boolean;
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

export default function CommutePanel({
  durationText,
  distanceText,
  isLoading = false,
  isCollapsed = false,
  onCollapse,
  onExpand,
}: CommutePanelProps) {
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
        title="Show commute panel"
      >
        <svg
          className="w-4 h-4 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0h-2.25m0 0V5.625c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v6.938m6 0h-6"
          />
        </svg>
        Commute
      </button>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 max-w-sm">
      {/* Header with label and close button */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
          Commute to Work
        </label>
        <button
          type="button"
          onClick={onCollapse}
          className="text-white/40 hover:text-white/80 transition-colors duration-200 -mr-1 -mt-1 p-1"
          aria-label="Collapse commute panel"
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
          <span className="text-sm text-white/70">
            Calculating route...
          </span>
        </div>
      ) : (
        /* Result */
        <div className="flex items-center gap-4">
          {/* Duration */}
          <div className="flex items-center gap-2">
            {/* Car icon */}
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0h-2.25m0 0V5.625c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v6.938m6 0h-6"
              />
            </svg>
            <span className="text-lg font-semibold text-white">
              {durationText}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/20" />

          {/* Distance */}
          <span className="text-sm text-white/70">{distanceText}</span>
        </div>
      )}
    </div>
  );
}
