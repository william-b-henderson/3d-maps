"use client";

/**
 * HeatmapPanel — floating UI for toggling heatmap layers and adjusting opacity.
 *
 * Matches the existing glass-morphism design language used in page.tsx's
 * control panel overlay.
 */

import type { HeatmapLayerConfig } from "@/lib/heatmap/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeatmapPanelProps {
  /** All registered layers (displayed as toggle buttons). */
  layers: HeatmapLayerConfig[];
  /** Currently active layer ID, or `null` if none. */
  activeLayerId: string | null;
  /** Whether a layer is loading / computing. */
  isLoading: boolean;
  /** Current opacity (0-1). */
  opacity: number;
  /** Called when the user taps a layer button. */
  onToggleLayer: (layerId: string) => void;
  /** Called when the user drags the opacity slider. */
  onOpacityChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HeatmapPanel({
  layers,
  activeLayerId,
  isLoading,
  opacity,
  onToggleLayer,
  onOpacityChange,
}: HeatmapPanelProps) {
  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 max-w-sm">
      {/* Section header */}
      <label className="text-xs font-medium text-white/60 uppercase tracking-wide mb-2 block">
        Heatmap Layers
      </label>

      {/* Layer toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {layers.map((layer) => {
          const isActive = activeLayerId === layer.id;
          const isThisLoading = isLoading && activeLayerId === layer.id;

          return (
            <button
              key={layer.id}
              onClick={() => onToggleLayer(layer.id)}
              disabled={isLoading && !isActive}
              title={layer.description}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                isActive
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              } ${isLoading && !isActive ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isThisLoading && (
                <span className="inline-block w-3 h-3 border border-white/80 border-t-transparent rounded-full animate-spin" />
              )}
              {layer.name}
            </button>
          );
        })}
      </div>

      {/* Opacity slider — only visible when a layer is active */}
      {activeLayerId && !isLoading && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-white/60">Opacity</label>
            <span className="text-xs text-white/60 tabular-nums">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer
              bg-white/20
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:h-3
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:border-0"
          />
        </div>
      )}
    </div>
  );
}
