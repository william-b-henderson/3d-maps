"use client";

/**
 * React hook for managing heatmap layer state and rendering lifecycle.
 *
 * Orchestrates three rendering pipelines based on `renderMode`:
 *   - `"grid"` — KDE grid pipeline (walkability)
 *   - `"streets"` — coloured street polylines (traffic)
 *   - `"intersections"` — coloured intersection dots (crime)
 *
 * Also exposes an opacity setter that updates existing elements in-place
 * without re-running any computation or recreating DOM elements.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { HeatmapLayerConfig, HeatmapGrid, LayerRenderer } from "@/lib/heatmap/types";
import {
  getAvailableLayers,
  getLayerConfig,
  loadLayerData,
  loadStreetData,
  loadIntersectionData,
} from "@/lib/heatmap/registry";
import { computeHeatmapGrid } from "@/lib/heatmap/engine";
import { HeatmapRenderer } from "@/lib/heatmap/renderer";
import { StreetRenderer } from "@/lib/heatmap/street-renderer";
import { IntersectionRenderer } from "@/lib/heatmap/intersection-renderer";

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

/** Options for externally-managed heatmap state (e.g. URL search params). */
export interface UseHeatmapLayersOptions {
  /** Currently active layer ID (managed externally, e.g. via URL param). */
  activeLayerId: string | null;
  /** Setter to update the active layer ID. */
  setActiveLayerId: (id: string | null) => void;
  /** Current opacity value (managed externally, e.g. via URL param). */
  opacity: number;
  /** Setter to update the opacity value. */
  setOpacity: (value: number) => void;
}

/**
 * Manages heatmap layer rendering lifecycle using externally-managed state.
 *
 * The caller owns `activeLayerId` and `opacity` (typically backed by URL
 * search params) and passes them in via `options`. This hook handles the
 * renderer creation, data loading, caching, and cleanup.
 *
 * @param mapElement - The Google Maps `Map3DElement` to render onto.
 *                     Pass `null` until the map is ready.
 * @param options    - Externally-managed state and setters.
 * @returns Controls and state for the heatmap panel UI
 */
export function useHeatmapLayers(
  mapElement: google.maps.maps3d.Map3DElement | null,
  options: UseHeatmapLayersOptions,
): UseHeatmapLayersReturn {
  const { activeLayerId, setActiveLayerId, opacity, setOpacity: setOpacityExternal } = options;
  const [isLoading, setIsLoading] = useState(false);

  // Active renderer — can be any of the three types.
  const rendererRef = useRef<LayerRenderer | null>(null);

  // Cache computed grids (grid mode) and fetched data (streets/intersections).
  const dataCacheRef = useRef<Map<string, unknown>>(new Map());

  // Track whether initial restoration has run to avoid double-activation.
  const restoredRef = useRef(false);

  // Clean up renderer when map element changes.
  useEffect(() => {
    restoredRef.current = false;
    return () => {
      rendererRef.current?.clear();
      rendererRef.current = null;
    };
  }, [mapElement]);

  // -----------------------------------------------------------------------
  // Renderer factory
  // -----------------------------------------------------------------------

  /**
   * Creates the appropriate renderer for a layer's render mode.
   * Clears the previous renderer first.
   *
   * @param config - The layer configuration
   * @returns A new renderer instance
   */
  const createRenderer = useCallback(
    (config: HeatmapLayerConfig): LayerRenderer | null => {
      if (!mapElement) return null;

      rendererRef.current?.clear();

      switch (config.renderMode) {
        case "grid":
          return new HeatmapRenderer(mapElement);
        case "streets":
          return new StreetRenderer(mapElement, config.colorScale, opacity);
        case "intersections":
          return new IntersectionRenderer(mapElement, config.colorScale, opacity);
        default:
          return null;
      }
    },
    [mapElement, opacity],
  );

  // -----------------------------------------------------------------------
  // Core activation logic (shared by toggleLayer and restore effect)
  // -----------------------------------------------------------------------

  /**
   * Activates a layer's renderer, loading data if needed.
   * Does NOT check whether the layer is already active — callers
   * are responsible for that guard.
   *
   * @param layerId - The layer to activate
   */
  const activateLayer = useCallback(
    async (layerId: string) => {
      if (!mapElement) return;

      setIsLoading(true);
      setActiveLayerId(layerId);

      try {
        const config = getLayerConfig(layerId);
        if (!config) throw new Error(`Layer "${layerId}" config not found`);

        const renderer = createRenderer(config);
        if (!renderer) throw new Error("Failed to create renderer");
        rendererRef.current = renderer;

        switch (config.renderMode) {
          case "grid": {
            let grid = dataCacheRef.current.get(layerId) as HeatmapGrid | undefined;
            if (!grid) {
              const points = await loadLayerData(layerId);
              grid = computeHeatmapGrid(points, { ...config, opacity });
              dataCacheRef.current.set(layerId, grid);
            }
            await renderer.render(grid);
            break;
          }

          case "streets": {
            let segments = dataCacheRef.current.get(layerId);
            if (!segments) {
              segments = await loadStreetData(layerId);
              dataCacheRef.current.set(layerId, segments);
            }
            await renderer.render(segments);
            break;
          }

          case "intersections": {
            let intersections = dataCacheRef.current.get(layerId);
            if (!intersections) {
              intersections = await loadIntersectionData(layerId);
              dataCacheRef.current.set(layerId, intersections);
            }
            await renderer.render(intersections);
            break;
          }
        }
      } catch (err) {
        console.error(`[Heatmap] Failed to activate layer "${layerId}":`, err);
        rendererRef.current?.clear();
        rendererRef.current = null;
        setActiveLayerId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [opacity, mapElement, createRenderer, setActiveLayerId],
  );

  // -----------------------------------------------------------------------
  // Toggle a layer on/off
  // -----------------------------------------------------------------------

  const toggleLayer = useCallback(
    async (layerId: string) => {
      if (!mapElement) return;

      // If the requested layer is already active → turn it off
      if (activeLayerId === layerId) {
        rendererRef.current?.clear();
        rendererRef.current = null;
        setActiveLayerId(null);
        return;
      }

      await activateLayer(layerId);
    },
    [activeLayerId, mapElement, activateLayer, setActiveLayerId],
  );

  // -----------------------------------------------------------------------
  // Restore active layer from URL on mount / map change
  // -----------------------------------------------------------------------

  /**
   * When the map becomes ready and there is already an activeLayerId
   * (restored from URL search params), activate that layer's renderer.
   * Only runs once per map element to avoid re-triggering on every
   * activeLayerId change.
   */
  useEffect(() => {
    if (!mapElement || !activeLayerId || restoredRef.current) return;
    restoredRef.current = true;
    activateLayer(activeLayerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapElement, activateLayer]);

  // -----------------------------------------------------------------------
  // Opacity adjustment
  // -----------------------------------------------------------------------

  const setOpacity = useCallback(
    (value: number) => {
      setOpacityExternal(value);

      const renderer = rendererRef.current;
      if (!renderer || !activeLayerId) return;

      // Fast path: just update existing element colours
      renderer.setOpacity(value);

      // Invalidate the cached data so the next toggle recomputes with new opacity
      dataCacheRef.current.delete(activeLayerId);
    },
    [activeLayerId, setOpacityExternal],
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
