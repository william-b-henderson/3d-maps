"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type MutableRefObject,
} from "react";

import { HEATMAP_ALTITUDE } from "@/lib/heatmap/constants";

/**
 * Camera position for fly animations
 */
export interface CameraPosition {
  lat: number;
  lng: number;
  altitude: number;
  tilt?: number;
  heading?: number;
  range?: number;
}

/**
 * Options for highlighting a location with a circular fallback
 */
export interface HighlightOptions {
  /** Radius of the highlight in meters (default: 15) */
  radius?: number;
  /** Height of the 3D extrusion in meters above ground (default: 3) */
  height?: number;
  /** Fill color with alpha */
  fillColor?: string;
  /** Stroke/outline color */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
}

/**
 * A coordinate ring for a building outline polygon.
 * Each ring is an array of {lat, lng} points.
 */
export interface BuildingOutlineData {
  rings: Array<Array<{ lat: number; lng: number }>>;
}

/**
 * Bounding box for a building (sw/ne corners).
 */
export interface BuildingBoundsData {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

/**
 * Options for highlighting a building with its actual footprint or bounding box.
 */
export interface BuildingHighlightOptions {
  /** Height of the 3D extrusion in meters above ground (default: 10).
   *  This should match the actual building roof height for a wrapping effect. */
  height?: number;
  /** Fill color with alpha */
  fillColor?: string;
  /** Stroke/outline color */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
}

/**
 * Methods exposed by the Map3D component via ref
 */
export interface Map3DRef {
  /** Fly the camera to a specific location with animation */
  flyTo: (position: CameraPosition, durationMs?: number) => Promise<void>;
  /** Stop any ongoing camera animation */
  stopAnimation: () => void;
  /**
   * Fly to a property and begin a slow orbit around it.
   * The camera is positioned at the specified range (default 100m) and tilt
   * (default 60°), then continuously orbits the property until the user
   * manually interacts with the map.
   *
   * @param position - Target property location
   * @param flyDurationMs - Duration of the initial fly-to animation (default 3000ms)
   */
  orbitProperty: (position: CameraPosition, flyDurationMs?: number) => void;
  /** Highlight a location with a circular 3D extruded polygon (fallback) */
  highlightLocation: (
    lat: number,
    lng: number,
    options?: HighlightOptions
  ) => void;
  /** Highlight a building using its actual footprint polygon */
  highlightBuilding: (
    outline: BuildingOutlineData,
    options?: BuildingHighlightOptions
  ) => void;
  /** Highlight a building using a bounding box rectangle */
  highlightBounds: (
    bounds: BuildingBoundsData,
    options?: BuildingHighlightOptions
  ) => void;
  /** Clear all highlights from the map */
  clearHighlights: () => void;
  /**
   * Show or hide the elevated outline that renders above the heatmap.
   * When the heatmap is toggled off the outline should be hidden since
   * it floats at an artificial altitude only needed to clear the heatmap.
   *
   * @param visible - Whether the elevated outline should be visible
   */
  setElevatedOutlineVisible: (visible: boolean) => void;
  /** Get the underlying Map3DElement for direct access (e.g. heatmap overlays) */
  getMapElement: () => google.maps.maps3d.Map3DElement | null;
}

/**
 * Props for the Map3D component
 */
interface Map3DProps {
  /** Center coordinates with latitude, longitude, and altitude (meters above ground) */
  center?: { lat: number; lng: number; altitude: number };
  /** Camera tilt in degrees (0 = looking straight down, 90 = looking at horizon) */
  tilt?: number;
  /** Compass heading in degrees (0 = north) */
  heading?: number;
  /** Distance from camera to center point in meters */
  range?: number;
  /** Map mode: "hybrid" (streets overlay) or "satellite" */
  mode?: "hybrid" | "satellite";
  /** Additional CSS classes */
  className?: string;
  /** Callback when map is ready */
  onReady?: () => void;
}

/**
 * Extends the global Window interface to include Google Maps types
 */
declare global {
  interface Window {
    google: typeof google;
  }
}

/**
 * Generates circular polygon coordinates around a center point.
 * Used as a fallback when no building data is available.
 *
 * @param centerLat - Center latitude
 * @param centerLng - Center longitude
 * @param radiusMeters - Radius in meters
 * @param numPoints - Number of points to generate (more = smoother circle)
 * @returns Array of {lat, lng} coordinates forming a closed ring
 */
function generateCircleCoordinates(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  numPoints: number = 32
): Array<{ lat: number; lng: number }> {
  const coordinates: Array<{ lat: number; lng: number }> = [];
  const earthRadius = 6371000;
  const radiusRadians = radiusMeters / earthRadius;
  const centerLatRadians = (centerLat * Math.PI) / 180;
  const centerLngRadians = (centerLng * Math.PI) / 180;

  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const pointLatRadians = Math.asin(
      Math.sin(centerLatRadians) * Math.cos(radiusRadians) +
        Math.cos(centerLatRadians) * Math.sin(radiusRadians) * Math.cos(angle)
    );
    const pointLngRadians =
      centerLngRadians +
      Math.atan2(
        Math.sin(angle) * Math.sin(radiusRadians) * Math.cos(centerLatRadians),
        Math.cos(radiusRadians) -
          Math.sin(centerLatRadians) * Math.sin(pointLatRadians)
      );
    coordinates.push({
      lat: (pointLatRadians * 180) / Math.PI,
      lng: (pointLngRadians * 180) / Math.PI,
    });
  }

  // Close the ring
  coordinates.push(coordinates[0]);
  return coordinates;
}

/**
 * Converts a bounding box (sw/ne) into a closed rectangular coordinate ring.
 *
 * @param bounds - The bounding box with sw and ne corners
 * @returns Array of 5 {lat, lng} coordinates forming a closed rectangle
 */
function boundsToRectangle(
  bounds: BuildingBoundsData
): Array<{ lat: number; lng: number }> {
  return [
    { lat: bounds.sw.lat, lng: bounds.sw.lng }, // SW
    { lat: bounds.sw.lat, lng: bounds.ne.lng }, // SE
    { lat: bounds.ne.lat, lng: bounds.ne.lng }, // NE
    { lat: bounds.ne.lat, lng: bounds.sw.lng }, // NW
    { lat: bounds.sw.lat, lng: bounds.sw.lng }, // Close back to SW
  ];
}

/**
 * Altitude mode for polygon rendering.
 * - "ABSOLUTE": altitude is meters above sea level (use with Solar API heights)
 * - "RELATIVE_TO_GROUND": altitude is meters above the terrain (use for fallbacks)
 */
type PolygonAltitudeMode = "ABSOLUTE" | "RELATIVE_TO_GROUND";

/**
 * Creates a 3D extruded polygon element on the map.
 * The polygon is drawn at the specified altitude and extruded downward to the
 * ground, creating a box/wrapper effect around a building.
 *
 * @param Polygon3DElement - The Google Maps Polygon3DElement constructor
 * @param coords - Array of {lat, lng} coordinates forming the polygon ring
 * @param altitude - Altitude for the polygon top (interpretation depends on altitudeMode)
 * @param altitudeMode - Whether altitude is above sea level or above ground
 * @param fillColor - Fill color with alpha
 * @param strokeColor - Stroke outline color
 * @param strokeWidth - Stroke width in pixels
 * @returns The created Polygon3DElement
 */
function createExtrudedPolygon(
  Polygon3DElement: typeof google.maps.maps3d.Polygon3DElement,
  coords: Array<{ lat: number; lng: number }>,
  altitude: number,
  altitudeMode: PolygonAltitudeMode,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
): google.maps.maps3d.Polygon3DElement {
  const outerCoordinates = coords.map((coord) => ({
    lat: coord.lat,
    lng: coord.lng,
    altitude,
  }));

  const polygon = new Polygon3DElement({
    altitudeMode,
    fillColor,
    strokeColor,
    strokeWidth,
    extruded: true,
    drawsOccludedSegments: true,
  });

  polygon.outerCoordinates = outerCoordinates;
  return polygon;
}

/**
 * Loads the Google Maps JavaScript API script dynamically
 * @param apiKey - The Google Maps API key
 * @returns Promise that resolves when the script is loaded
 */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.maps3d) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d,geocoding`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps API"));
    document.head.appendChild(script);
  });
}

/**
 * Ensures a coordinate ring is closed (last point equals first point).
 *
 * @param ring - Array of {lat, lng} coordinates
 * @returns A closed ring with the first point duplicated at the end if needed
 */
function ensureClosedRing(
  ring: Array<{ lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return ring;
  return [...ring, { lat: first.lat, lng: first.lng }];
}

/**
 * Shared logic for rendering a building highlight polygon on the map.
 * Used by highlightBuilding, highlightBounds, and highlightLocation.
 *
 * Creates two polygons:
 * 1. An extruded polygon at the building's roof height (always visible).
 * 2. An elevated flat outline above the heatmap altitude so the stroke
 *    is not tinted by the heatmap.  This outline can be shown/hidden
 *    independently via the elevatedOutlineRef.
 *
 * @param mapElement - The Map3DElement to attach polygons to
 * @param highlightElements - Ref array tracking added elements for cleanup
 * @param elevatedOutlineRef - Mutable ref that receives the elevated outline element
 * @param coords - Closed coordinate ring for the polygon
 * @param altitude - Altitude for the polygon top
 * @param altitudeMode - Whether altitude is above sea level or above ground
 * @param fillColor - Fill color
 * @param strokeColor - Stroke color
 * @param strokeWidth - Stroke width
 */
async function renderBuildingPolygon(
  mapElement: google.maps.maps3d.Map3DElement,
  highlightElements: HTMLElement[],
  elevatedOutlineRef: MutableRefObject<google.maps.maps3d.Polygon3DElement | null>,
  coords: Array<{ lat: number; lng: number }>,
  altitude: number,
  altitudeMode: PolygonAltitudeMode,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
) {
  const { Polygon3DElement } = (await google.maps.importLibrary(
    "maps3d"
  )) as google.maps.Maps3DLibrary;

  // Clear existing highlights
  highlightElements.forEach((el) => el.remove());
  highlightElements.length = 0;
  elevatedOutlineRef.current = null;

  // Main polygon at building roof height, extruded down to ground
  const polygon = createExtrudedPolygon(
    Polygon3DElement,
    coords,
    altitude,
    altitudeMode,
    fillColor,
    strokeColor,
    strokeWidth
  );
  mapElement.appendChild(polygon);
  highlightElements.push(polygon);

  // Elevated flat outline that renders above the heatmap layer.
  // Sits at HEATMAP_ALTITUDE + 10m (RELATIVE_TO_GROUND) so it is always
  // above the heatmap polygons, giving a crisp untainted stroke.
  const elevatedCoords = coords.map((coord) => ({
    lat: coord.lat,
    lng: coord.lng,
    altitude: HEATMAP_ALTITUDE + 10,
  }));

  const outlinePolygon = new Polygon3DElement({
    altitudeMode: "RELATIVE_TO_GROUND",
    fillColor: "rgba(0, 0, 0, 0)",
    strokeColor,
    strokeWidth,
    extruded: false,
    drawsOccludedSegments: true,
  });
  outlinePolygon.outerCoordinates = elevatedCoords;
  // Don't append to the DOM yet — the outline starts detached.
  // setElevatedOutlineVisible(true) is the only path that attaches it,
  // ensuring it only shows when the heatmap layer is active.
  highlightElements.push(outlinePolygon);
  elevatedOutlineRef.current = outlinePolygon;
}

/**
 * Map3D Component - Renders a Google Maps 3D view
 *
 * Uses Google's Maps JavaScript API 3D Maps feature to display
 * an interactive 3D globe with photorealistic imagery.
 */
const Map3D = forwardRef<Map3DRef, Map3DProps>(function Map3D(
  {
    center = { lat: 37.7749, lng: -122.4194, altitude: 0 },
    tilt = 67,
    heading = 0,
    range = 1000,
    mode = "hybrid",
    className = "",
    onReady,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const highlightElementsRef = useRef<HTMLElement[]>([]);
  /** Tracks the elevated outline polygon so it can be shown/hidden
   *  independently when the heatmap is toggled on/off. */
  const elevatedOutlineRef = useRef<google.maps.maps3d.Polygon3DElement | null>(null);
  /** Tracks the current orbit animation-end listener so it can be removed if
   *  `orbitProperty` is called again before the fly-to completes. */
  const orbitListenerRef = useRef<(() => void) | null>(null);
  /** Tracks the abort controller for user-interaction listeners that stop the orbit. */
  const interactionAbortRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Removes any active user-interaction listeners (mousedown, touchstart, wheel)
   * that were registered to stop the orbit animation on user input.
   */
  const cleanupInteractionListeners = () => {
    if (interactionAbortRef.current) {
      interactionAbortRef.current.abort();
      interactionAbortRef.current = null;
    }
  };

  /**
   * Attaches user-interaction listeners (mousedown, touchstart, wheel) on the
   * map container. When any fires, the orbit animation is stopped and all
   * listeners are cleaned up so normal map interaction resumes.
   */
  const attachInteractionListeners = () => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    // Clean up any prior listeners before attaching new ones
    cleanupInteractionListeners();

    const controller = new AbortController();
    interactionAbortRef.current = controller;

    const stopOrbit = () => {
      map.stopCameraAnimation();

      // Also clean up any pending orbit animation-end listener
      if (orbitListenerRef.current) {
        map.removeEventListener("gmp-animationend", orbitListenerRef.current);
        orbitListenerRef.current = null;
      }

      cleanupInteractionListeners();
    };

    const opts: AddEventListenerOptions = {
      signal: controller.signal,
      capture: true,
    };

    container.addEventListener("mousedown", stopOrbit, opts);
    container.addEventListener("touchstart", stopOrbit, opts);
    container.addEventListener("wheel", stopOrbit, opts);
    container.addEventListener("pointerdown", stopOrbit, opts);
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    flyTo: async (position: CameraPosition, durationMs = 2000) => {
      if (!mapRef.current) {
        console.warn("Map not ready for flyTo");
        return;
      }
      mapRef.current.flyCameraTo({
        endCamera: {
          center: {
            lat: position.lat,
            lng: position.lng,
            altitude: position.altitude,
          },
          tilt: position.tilt ?? 65,
          heading: position.heading ?? 0,
          range: position.range ?? 800,
        },
        durationMillis: durationMs,
      });
    },

    stopAnimation: () => {
      if (mapRef.current) {
        mapRef.current.stopCameraAnimation();
      }
      // Also clean up orbit-related listeners
      if (orbitListenerRef.current && mapRef.current) {
        mapRef.current.removeEventListener("gmp-animationend", orbitListenerRef.current);
        orbitListenerRef.current = null;
      }
      cleanupInteractionListeners();
    },

    orbitProperty: (position: CameraPosition, flyDurationMs = 3000) => {
      const map = mapRef.current;
      if (!map) {
        console.warn("Map not ready for orbitProperty");
        return;
      }

      // Clean up any pending orbit listener from a previous call
      if (orbitListenerRef.current) {
        map.removeEventListener("gmp-animationend", orbitListenerRef.current);
        orbitListenerRef.current = null;
      }

      // Clean up any active user-interaction listeners from a previous orbit
      cleanupInteractionListeners();

      // Stop any in-progress animation before starting the new fly-to
      map.stopCameraAnimation();

      const targetCamera = {
        center: {
          lat: position.lat,
          lng: position.lng,
          altitude: position.altitude,
        },
        tilt: position.tilt ?? 60,
        heading: position.heading ?? 0,
        range: position.range ?? 100,
      };

      // Use a setTimeout to let any stale gmp-animationend events from
      // stopCameraAnimation flush before we register our listener and
      // start the fly-to animation. This avoids the race condition where
      // a { once: true } listener gets consumed by a stale event.
      setTimeout(() => {
        // Phase 2 handler: when fly-to completes, begin a slow continuous orbit
        const onAnimationEnd = () => {
          map.removeEventListener("gmp-animationend", onAnimationEnd);
          orbitListenerRef.current = null;

          map.flyCameraAround({
            camera: targetCamera,
            durationMillis: 60000, // 60 seconds per full revolution
            repeatCount: 999, // effectively infinite
          });

          // Attach user-interaction listeners to stop the orbit on any input
          attachInteractionListeners();
        };

        orbitListenerRef.current = onAnimationEnd;
        map.addEventListener("gmp-animationend", onAnimationEnd);

        // Phase 1: Fly to the property
        map.flyCameraTo({
          endCamera: targetCamera,
          durationMillis: flyDurationMs,
        });
      }, 100);
    },

    /**
     * Highlight a location with a circular polygon (fallback).
     * Uses RELATIVE_TO_GROUND since we don't know the sea-level altitude.
     */
    highlightLocation: async (
      lat: number,
      lng: number,
      options: HighlightOptions = {}
    ) => {
      if (!mapRef.current) return;

      const {
        radius = 15,
        height = 3,
        fillColor = "rgba(59, 130, 246, 0.4)",
        strokeColor = "#3b82f6",
        strokeWidth = 3,
      } = options;

      try {
        const circleCoords = generateCircleCoordinates(lat, lng, radius, 48);
        await renderBuildingPolygon(
          mapRef.current,
          highlightElementsRef.current,
          elevatedOutlineRef,
          circleCoords,
          height,
          "RELATIVE_TO_GROUND",
          fillColor,
          strokeColor,
          strokeWidth
        );
      } catch (err) {
        console.error("Failed to create circle highlight:", err);
      }
    },

    /**
     * Highlight a building using its actual footprint polygon.
     * Uses ABSOLUTE altitude mode since the height from the Solar API
     * is meters above sea level.
     */
    highlightBuilding: async (
      outline: BuildingOutlineData,
      options: BuildingHighlightOptions = {}
    ) => {
      if (!mapRef.current) return;

      const {
        height = 10,
        fillColor = "rgba(59, 130, 246, 0.35)",
        strokeColor = "#60a5fa",
        strokeWidth = 3,
      } = options;

      try {
        const ring = outline.rings[0];
        if (!ring || ring.length < 3) return;

        const closedRing = ensureClosedRing(ring);
        await renderBuildingPolygon(
          mapRef.current,
          highlightElementsRef.current,
          elevatedOutlineRef,
          closedRing,
          height,
          "ABSOLUTE",
          fillColor,
          strokeColor,
          strokeWidth
        );
      } catch (err) {
        console.error("Failed to create building highlight:", err);
      }
    },

    /**
     * Highlight a building using a bounding box rectangle.
     * Uses ABSOLUTE altitude mode since the height from the Solar API
     * is meters above sea level.
     */
    highlightBounds: async (
      bounds: BuildingBoundsData,
      options: BuildingHighlightOptions = {}
    ) => {
      if (!mapRef.current) return;

      const {
        height = 10,
        fillColor = "rgba(59, 130, 246, 0.35)",
        strokeColor = "#60a5fa",
        strokeWidth = 3,
      } = options;

      try {
        const rectCoords = boundsToRectangle(bounds);
        await renderBuildingPolygon(
          mapRef.current,
          highlightElementsRef.current,
          elevatedOutlineRef,
          rectCoords,
          height,
          "ABSOLUTE",
          fillColor,
          strokeColor,
          strokeWidth
        );
      } catch (err) {
        console.error("Failed to create bounds highlight:", err);
      }
    },

    clearHighlights: () => {
      highlightElementsRef.current.forEach((el) => el.remove());
      highlightElementsRef.current = [];
      elevatedOutlineRef.current = null;
    },

    setElevatedOutlineVisible: (visible: boolean) => {
      const outline = elevatedOutlineRef.current;
      if (!outline) return;

      if (visible) {
        // Re-attach to the map if it was previously detached
        if (!outline.parentElement && mapRef.current) {
          mapRef.current.appendChild(outline);
        }
      } else {
        // Detach from the map DOM to hide it without destroying it
        outline.remove();
      }
    },

    getMapElement: () => mapRef.current,
  }));

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setError(
        "Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables."
      );
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function initMap() {
      try {
        await loadGoogleMapsScript(apiKey!);
        if (!mounted || !containerRef.current) return;

        const { Map3DElement } = (await google.maps.importLibrary(
          "maps3d"
        )) as google.maps.Maps3DLibrary;

        if (!mounted || !containerRef.current) return;

        const map3DElement = new Map3DElement({
          center: {
            lat: center.lat,
            lng: center.lng,
            altitude: center.altitude,
          },
          tilt,
          heading,
          range,
          mode: mode === "hybrid" ? "HYBRID" : "SATELLITE",
        });

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(map3DElement);
        mapRef.current = map3DElement;

        setIsLoading(false);
        onReady?.();
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize map"
          );
          setIsLoading(false);
        }
      }
    }

    initMap();
    return () => {
      mounted = false;
      cleanupInteractionListeners();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, center.altitude, tilt, heading, range, mode, onReady]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-900 text-white p-4 ${className}`}
      >
        <div className="text-center">
          <p className="text-red-400 font-medium mb-2">Error</p>
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading 3D Map...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default Map3D;
