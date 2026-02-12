"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Map3D, { Map3DRef } from "@/components/Map3D";
import AddressSearch, { GeocodedLocation } from "@/components/AddressSearch";
import HeatmapPanel from "@/components/HeatmapPanel";
import NeighborhoodPanel from "@/components/NeighborhoodPanel";
import { useHeatmapLayers } from "@/hooks/useHeatmapLayers";
import { loadOnboardingData } from "@/lib/onboarding/constants";
import { getNeighborhoodBoundary } from "@/lib/neighborhoods/boundaries";
import { ensureGoogleMapsLoaded } from "@/lib/google-maps-loader";

/**
 * Predefined locations for quick navigation
 */
const LOCATIONS = [
  {
    name: "San Francisco",
    center: { lat: 37.7749, lng: -122.4194, altitude: 0 },
    range: 2000,
    tilt: 67,
    heading: 0,
  },
  {
    name: "New York",
    center: { lat: 40.7128, lng: -74.006, altitude: 0 },
    range: 2500,
    tilt: 60,
    heading: 45,
  },
  {
    name: "Tokyo",
    center: { lat: 35.6762, lng: 139.6503, altitude: 0 },
    range: 3000,
    tilt: 55,
    heading: 90,
  },
  {
    name: "London",
    center: { lat: 51.5074, lng: -0.1278, altitude: 0 },
    range: 2000,
    tilt: 65,
    heading: 180,
  },
  {
    name: "Grand Canyon",
    center: { lat: 36.0544, lng: -112.1401, altitude: 1000 },
    range: 5000,
    tilt: 70,
    heading: 270,
  },
];

/**
 * Home page component displaying a full-screen 3D map with location controls
 */
export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [mapMode, setMapMode] = useState<"hybrid" | "satellite">("hybrid");
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastSearchedLocation, setLastSearchedLocation] =
    useState<GeocodedLocation | null>(null);
  const mapRef = useRef<Map3DRef>(null);
  const [mapElement, setMapElement] = useState<google.maps.maps3d.Map3DElement | null>(null);

  /**
   * Called when the 3D map is ready (or re-initializes after prop changes).
   * Updates both the readiness flag and the live Map3DElement reference
   * so the heatmap renderer always targets the current DOM element.
   */
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    setMapElement(mapRef.current?.getMapElement() ?? null);
  }, []);

  const {
    availableLayers,
    activeLayerId,
    isLoading: isHeatmapLoading,
    opacity: heatmapOpacity,
    toggleLayer,
    setOpacity: setHeatmapOpacity,
  } = useHeatmapLayers(mapElement);

  // ---------------------------------------------------------------------------
  // Neighborhood outlines
  // ---------------------------------------------------------------------------

  /** Neighborhoods currently displayed as outlines on the 3D map. */
  const [activeNeighborhoods, setActiveNeighborhoods] = useState<string[]>([]);

  /** Whether onboarding has been completed (checked client-side). */
  const [onboardingDone, setOnboardingDone] = useState(false);

  /** Tracks rendered polygon elements so we can add/remove individually. */
  const neighborhoodPolygonsRef = useRef<Map<string, google.maps.maps3d.Polygon3DElement>>(new Map());

  /**
   * On mount, load onboarding data from localStorage and initialise
   * the active neighborhoods from the user's saved selections.
   */
  useEffect(() => {
    const data = loadOnboardingData();
    if (data) {
      setOnboardingDone(true);
      setActiveNeighborhoods(data.neighborhoods);
    }
  }, []);

  /**
   * Sync polygon elements on the map whenever activeNeighborhoods or
   * the mapElement changes. Adds polygons for newly active neighborhoods
   * and removes polygons for deactivated ones.
   */
  useEffect(() => {
    if (!mapElement) return;

    const currentPolygons = neighborhoodPolygonsRef.current;
    const activeSet = new Set(activeNeighborhoods);

    // Remove polygons that are no longer active
    for (const [name, poly] of currentPolygons) {
      if (!activeSet.has(name)) {
        poly.remove();
        currentPolygons.delete(name);
      }
    }

    // Add polygons for newly active neighborhoods
    async function addNewPolygons() {
      await ensureGoogleMapsLoaded();
      const { Polygon3DElement } = (await google.maps.importLibrary(
        "maps3d"
      )) as google.maps.Maps3DLibrary;

      for (const name of activeNeighborhoods) {
        if (currentPolygons.has(name)) continue;

        const coords = getNeighborhoodBoundary(name);
        if (!coords) continue;

        const poly = new Polygon3DElement({
          altitudeMode: "RELATIVE_TO_GROUND" as google.maps.maps3d.AltitudeMode,
          fillColor: "rgba(0, 0, 0, 0)",
          strokeColor: "rgba(59, 130, 246, 0.6)",
          strokeWidth: 4,
          extruded: false,
          drawsOccludedSegments: true,
        });
        poly.outerCoordinates = coords;
        mapElement!.appendChild(poly);
        currentPolygons.set(name, poly);
      }
    }

    addNewPolygons();
  }, [activeNeighborhoods, mapElement]);

  /**
   * Toggles a neighborhood outline on or off on the map.
   *
   * @param name - The neighborhood name to toggle
   */
  const handleNeighborhoodToggle = useCallback((name: string) => {
    setActiveNeighborhoods((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Neighborhood hover highlight (elevated polygon above buildings)
  // ---------------------------------------------------------------------------

  /** The neighborhood currently being hovered in the panel. */
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState<string | null>(null);

  /** Single reusable polygon element for the hover highlight. */
  const hoverPolygonRef = useRef<google.maps.maps3d.Polygon3DElement | null>(null);

  /**
   * Sets the hovered neighborhood name (or null to clear).
   */
  const handleNeighborhoodHover = useCallback((name: string | null) => {
    setHoveredNeighborhood(name);
  }, []);

  /**
   * Creates / removes an elevated semi-transparent polygon above the
   * buildings when the user hovers a neighborhood in the panel.
   * Uses the same altitude as the heatmap layer (~30m RELATIVE_TO_GROUND).
   */
  useEffect(() => {
    if (!mapElement) return;

    // Remove any existing hover polygon
    if (hoverPolygonRef.current) {
      hoverPolygonRef.current.remove();
      hoverPolygonRef.current = null;
    }

    if (!hoveredNeighborhood) return;

    const coords = getNeighborhoodBoundary(hoveredNeighborhood);
    if (!coords) return;

    // Lift coordinates to heatmap altitude (30m above ground)
    const elevatedCoords = coords.map((c) => ({
      ...c,
      altitude: 30,
    }));

    async function createHoverPolygon() {
      await ensureGoogleMapsLoaded();
      const { Polygon3DElement } = (await google.maps.importLibrary(
        "maps3d"
      )) as google.maps.Maps3DLibrary;

      const poly = new Polygon3DElement({
        altitudeMode: "RELATIVE_TO_GROUND" as google.maps.maps3d.AltitudeMode,
        fillColor: "rgba(59, 130, 246, 0.5)",
        strokeColor: "rgba(59, 130, 246, 0.8)",
        strokeWidth: 2,
        extruded: false,
        drawsOccludedSegments: true,
      });
      poly.outerCoordinates = elevatedCoords;
      if (mapElement) {
        mapElement.appendChild(poly);
        hoverPolygonRef.current = poly;
      }
    }

    createHoverPolygon();

    return () => {
      if (hoverPolygonRef.current) {
        hoverPolygonRef.current.remove();
        hoverPolygonRef.current = null;
      }
    };
  }, [hoveredNeighborhood, mapElement]);

  // ---------------------------------------------------------------------------
  // Heatmap state helpers
  // ---------------------------------------------------------------------------

  /**
   * Ref that tracks whether a heatmap layer is currently active.
   * Used inside callbacks (like handleLocationFound) to avoid stale
   * closures over the activeLayerId state value.
   */
  const heatmapActiveRef = useRef(false);
  heatmapActiveRef.current = activeLayerId !== null;

  /**
   * Show the elevated outline (above the heatmap) only when a heatmap layer
   * is active.  When the heatmap is off, the floating outline at 40m would
   * look out of place, so we hide it.
   */
  useEffect(() => {
    mapRef.current?.setElevatedOutlineVisible(activeLayerId !== null);
  }, [activeLayerId]);

  /**
   * Handles when an address is found via geocoding.
   * Uses the building outline polygon when available for a precise footprint
   * highlight; falls back to a circular highlight otherwise.
   */
  const handleLocationFound = useCallback((location: GeocodedLocation) => {
    setLastSearchedLocation(location);

    // Clear any existing highlights
    mapRef.current?.clearHighlights();

    // Compute orbit center altitude (meters above sea level) so the camera
    // doesn't clip through terrain or buildings. Priority:
    //   1) Rooftop height from Solar API + 10m buffer (best)
    //   2) Terrain elevation from Elevation API + 30m above ground (good)
    //   3) Fixed 50m fallback (last resort)
    const orbitAltitude = location.buildingHeightMeters
      ? location.buildingHeightMeters + 10
      : location.elevationMeters != null
        ? location.elevationMeters + 30
        : 50;

    // Fly to the property and begin a slow orbit around it
    mapRef.current?.orbitProperty(
      {
        lat: location.lat,
        lng: location.lng,
        altitude: orbitAltitude,
        tilt: 60,
        heading: 0,
        range: 100, // 100m from property
      },
      3000 // 3 second fly-to animation
    );

    // Debug: log what building data the API returned
    console.log("[3D Maps] Building data:", {
      outline: location.buildingOutline
        ? `${location.buildingOutline.rings.length} ring(s)`
        : "none",
      bounds: location.buildingBounds ? "available" : "none",
      height: location.buildingHeightMeters
        ? `${location.buildingHeightMeters.toFixed(1)}m`
        : "none",
    });

    // Use actual roof height from Solar API (meters above sea level) with a
    // small buffer so the polygon sits just above the rooftop, not clipping it.
    // Falls back to 10m RELATIVE_TO_GROUND for the circular fallback.
    const roofHeight = location.buildingHeightMeters
      ? location.buildingHeightMeters + 2
      : 10;

    const highlightStyle = {
      fillColor: "rgba(0, 0, 0, 0)",
      strokeColor: "#FFFFFF",
      strokeWidth: 4,
    };

    // Add highlight after a short delay to let the camera start moving.
    // The callback is async so we can await the highlight method (which
    // internally awaits renderBuildingPolygon) before toggling the
    // elevated outline visibility based on whether the heatmap is active.
    // Priority: 1) outline+height  2) bounds+height  3) circular fallback
    setTimeout(async () => {
      if (location.buildingOutline) {
        // Best: precise building footprint from Geocoding API
        await mapRef.current?.highlightBuilding(location.buildingOutline, {
          height: roofHeight,
          ...highlightStyle,
        });
      } else if (location.buildingBounds) {
        // Good: bounding box rectangle from Solar API
        await mapRef.current?.highlightBounds(location.buildingBounds, {
          height: roofHeight,
          ...highlightStyle,
        });
      } else {
        // Fallback: circular highlight when no building data is available
        await mapRef.current?.highlightLocation(location.lat, location.lng, {
          radius: 12,
          height: roofHeight,
          ...highlightStyle,
        });
      }

      // Show the elevated outline only if a heatmap layer is currently active
      mapRef.current?.setElevatedOutlineVisible(heatmapActiveRef.current);
    }, 500);
  }, []);

  /**
   * Handles clicking a preset location button
   * Flies to the location instead of instant teleport
   */
  const handleLocationClick = useCallback((location: (typeof LOCATIONS)[0]) => {
    setSelectedLocation(location);
    setLastSearchedLocation(null);

    // Stop any active orbit animation and clear highlights
    mapRef.current?.stopAnimation();
    mapRef.current?.clearHighlights();

    mapRef.current?.flyTo(
      {
        lat: location.center.lat,
        lng: location.center.lng,
        altitude: location.center.altitude,
        tilt: location.tilt,
        heading: location.heading,
        range: location.range,
      },
      2500
    );
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Map - Full Screen */}
      <Map3D
        ref={mapRef}
        center={selectedLocation.center}
        tilt={selectedLocation.tilt}
        heading={selectedLocation.heading}
        range={selectedLocation.range}
        mode={mapMode}
        className="w-full h-full"
        onReady={handleMapReady}
      />

      {/* Floating Address Search - Top Center */}
      <div className="absolute top-4 left-4 right-4 z-30 flex justify-center">
        <AddressSearch
          onLocationFound={handleLocationFound}
          placeholder="Search any address..."
          disabled={!isMapReady}
        />
      </div>

      {/* Last searched address indicator - clickable to re-fly */}
      {lastSearchedLocation && (
        <div className="absolute top-20 left-4 right-4 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => handleLocationFound(lastSearchedLocation)}
            className="bg-black/40 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full cursor-pointer hover:bg-black/60 active:scale-95 transition-all duration-200"
          >
            📍 {lastSearchedLocation.formattedAddress}
          </button>
        </div>
      )}

      {/* Heatmap Layer Controls - Bottom Left */}
      {isMapReady && (
        <div className="absolute bottom-4 left-4 z-20">
          <HeatmapPanel
            layers={availableLayers}
            activeLayerId={activeLayerId}
            isLoading={isHeatmapLoading}
            opacity={heatmapOpacity}
            onToggleLayer={toggleLayer}
            onOpacityChange={setHeatmapOpacity}
          />
        </div>
      )}

      {/* Neighborhood Panel - Top Right */}
      {isMapReady && onboardingDone && (
        <div className="absolute top-20 right-4 z-20">
          <NeighborhoodPanel
            activeNeighborhoods={activeNeighborhoods}
            onToggle={handleNeighborhoodToggle}
            onHover={handleNeighborhoodHover}
          />
        </div>
      )}

      {/* Personalize Button - Bottom Right */}
      <div className="absolute bottom-24 right-4 z-20">
        <Link
          href="/onboarding"
          className="
            flex items-center gap-2 px-4 py-2.5
            bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl
            shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            text-sm font-medium text-white/90
            hover:bg-white/20 hover:border-white/30
            active:scale-95 transition-all duration-200
          "
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
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Personalize
        </Link>
      </div>

      {/* Instructions Overlay - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 max-w-xs">
          <p className="text-xs text-white/70">
            <span className="font-medium text-white/90">Controls:</span> Drag to
            rotate • Scroll to zoom • Shift+drag to pan
          </p>
        </div>
      </div>
    </div>
  );
}
