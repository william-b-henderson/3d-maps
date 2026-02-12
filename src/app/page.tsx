"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Map3D, { Map3DRef } from "@/components/Map3D";
import AddressSearch, { GeocodedLocation } from "@/components/AddressSearch";
import HeatmapPanel from "@/components/HeatmapPanel";
import { useHeatmapLayers } from "@/hooks/useHeatmapLayers";

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
