"use client";

/**
 * React hook for managing heatmap layer state and rendering lifecycle.
 *
 * Orchestrates the full pipeline:
 *   toggle → lazy-load data → compute KDE grid → batch-render polygons
 *
 * Also exposes an opacity setter that updates existing polygons in-place
 * without re-running the KDE or recreating DOM elements.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { HeatmapLayerConfig, HeatmapGrid } from "@/lib/heatmap/types";
import { getAvailableLayers, getLayerConfig, loadLayerData } from "@/lib/heatmap/registry";
import { computeHeatmapGrid } from "@/lib/heatmap/engine";
import { HeatmapRenderer } from "@/lib/heatmap/renderer";
import { DEFAULT_LAYER_OPACITY } from "@/lib/heatmap/constants";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseHeatmapLayersReturn {
  /** Metadata for all registered layers (for rendering the UI list). */
  availableLayers: HeatmapLayerConfig[];
  /** ID of the currently active (visible) layer, or `null`. */
  activeLayerId: string | null;
  /** Whether data is being loaded / grid is being computed. */
  isLoading: boolean;
  /** Current opacity value (0-1). */
  opacity: number;
  /** Toggle a layer on or off.  Only one layer can be active at a time. */
  toggleLayer: (layerId: string) => void;
  /** Adjust the opacity of the active layer without re-computing. */
  setOpacity: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages heatmap layer state: active layer, opacity, loading, and the
 * renderer lifecycle.
 *
 * @param mapElement - The Google Maps `Map3DElement` to render onto.
 *                     Pass `null` until the map is ready.
 * @returns Controls and state for the heatmap panel UI
 */
export function useHeatmapLayers(
  mapElement: google.maps.maps3d.Map3DElement | null
): UseHeatmapLayersReturn {
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opacity, setOpacityState] = useState(DEFAULT_LAYER_OPACITY);

  // Persistent renderer instance — lives as long as the map element does.
  const rendererRef = useRef<HeatmapRenderer | null>(null);

  // Cache computed grids so re-toggling is instant (no re-computation).
  const gridCacheRef = useRef<Map<string, HeatmapGrid>>(new Map());

  // Ensure the renderer is (re-)created when the map element changes.
  useEffect(() => {
    if (mapElement) {
      // If the map element changed, discard the old renderer
      rendererRef.current?.clear();
      rendererRef.current = new HeatmapRenderer(mapElement);
    }
    return () => {
      rendererRef.current?.clear();
      rendererRef.current = null;
    };
  }, [mapElement]);

  // -----------------------------------------------------------------------
  // Toggle a layer on/off
  // -----------------------------------------------------------------------

  const toggleLayer = useCallback(
    async (layerId: string) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      // If the requested layer is already active → turn it off
      if (activeLayerId === layerId) {
        renderer.clear();
        setActiveLayerId(null);
        return;
      }

      // Activate the new layer
      setIsLoading(true);
      setActiveLayerId(layerId);

      try {
        // 1. Check grid cache first
        let grid = gridCacheRef.current.get(layerId);

        if (!grid) {
          // 2. Lazy-load data (from generator or network)
          const points = await loadLayerData(layerId);

          // 3. Resolve layer config
          const config = getLayerConfig(layerId);
          if (!config) throw new Error(`Layer "${layerId}" config not found`);

          // 4. Compute the smooth KDE grid
          grid = computeHeatmapGrid(points, { ...config, opacity });
          gridCacheRef.current.set(layerId, grid);
        }

        // 5. Render onto the map (batched polygon creation)
        await renderer.render(grid);
      } catch (err) {
        console.error(`[Heatmap] Failed to activate layer "${layerId}":`, err);
        renderer.clear();
        setActiveLayerId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [activeLayerId, opacity]
  );

  // -----------------------------------------------------------------------
  // Opacity adjustment
  // -----------------------------------------------------------------------

  const setOpacity = useCallback(
    (value: number) => {
      setOpacityState(value);

      const renderer = rendererRef.current;
      if (!renderer || !activeLayerId) return;

      // Fast path: just update existing polygon colours
      renderer.setOpacity(value);

      // Invalidate the cached grid so the next toggle recomputes with new opacity
      gridCacheRef.current.delete(activeLayerId);
    },
    [activeLayerId]
  );

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    availableLayers: getAvailableLayers(),
    activeLayerId,
    isLoading,
    opacity,
    toggleLayer,
    setOpacity,
  };
}
