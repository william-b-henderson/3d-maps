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
import { createWorkMarker, removeWorkMarker } from "@/lib/markers/work-marker";
import { renderRoute, removeRoute } from "@/lib/routes/route-renderer";
import { decodePolyline } from "@/lib/routes/polyline-decoder";
import CommutePanel from "@/components/CommutePanel";
import NearbyPlacesPanel from "@/components/NearbyPlacesPanel";
import { createPlaceMarker, createSearchedAddressMarker, removePlaceMarker } from "@/lib/markers/place-marker";
import { getActiveCategories, NEARBY_CATEGORIES } from "@/lib/nearby/categories";
import type { DirectionsResponse } from "@/app/api/directions/route";
import type { NearbyPlaceResult, NearbyPlacesResponse } from "@/app/api/nearby-places/route";
import type { WorkLocation } from "@/lib/onboarding/types";

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
 * Extracts just the street address from a full formatted address string.
 * E.g. "2140 Divisadero St, San Francisco, CA 94115, USA" => "2140 Divisadero St"
 *
 * @param formattedAddress - The full address returned by the Geocoding API.
 * @returns The street portion (everything before the first comma), trimmed.
 */
function extractStreetAddress(formattedAddress: string): string {
  const commaIndex = formattedAddress.indexOf(",");
  if (commaIndex === -1) return formattedAddress.trim();
  return formattedAddress.substring(0, commaIndex).trim();
}

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

  /** Work location from the personalize flow (Step 2). */
  const [workLocation, setWorkLocation] = useState<WorkLocation | null>(null);

  /** Tracks the rendered work marker element for cleanup. */
  const workMarkerRef = useRef<HTMLElement | null>(null);

  /** Commute info (duration, distance, polyline) from the Directions API. */
  const [commuteInfo, setCommuteInfo] = useState<{
    durationText: string;
    distanceText: string;
    encodedPolyline: string;
  } | null>(null);

  /** Whether a directions request is in flight. */
  const [isCommuteLoading, setIsCommuteLoading] = useState(false);

  /** Tracks the rendered route polyline for cleanup. */
  const routePolylineRef = useRef<google.maps.maps3d.Polyline3DElement | null>(null);

  /** Nearby places results from the batch API (one per active preference). */
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceResult[]>([]);

  /** Whether a nearby places batch request is in flight. */
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);

  /** Active preference category IDs that should trigger a nearby search. */
  const [activePreferences, setActivePreferences] = useState<string[]>([]);

  /** Category currently hovered in the NearbyPlacesPanel (for route highlighting). */
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  /** Whether the commute panel is collapsed (data preserved, map elements hidden). */
  const [isCommuteCollapsed, setIsCommuteCollapsed] = useState(false);

  /** Whether the nearby places panel is collapsed (data preserved, map elements hidden). */
  const [isNearbyCollapsed, setIsNearbyCollapsed] = useState(false);

  /** Tracks the rendered searched-address marker for cleanup. */
  const searchMarkerRef = useRef<HTMLElement | null>(null);

  /** Tracks rendered place marker elements by category for cleanup. */
  const placeMarkersRef = useRef<Map<string, HTMLElement>>(new Map());

  /** Tracks rendered walking route polylines by category for cleanup. */
  const walkingRoutesRef = useRef<Map<string, google.maps.maps3d.Polyline3DElement>>(new Map());

  /** Tracks rendered polygon elements so we can add/remove individually. */
  const neighborhoodPolygonsRef = useRef<Map<string, google.maps.maps3d.Polygon3DElement>>(new Map());

  /**
   * On mount, load onboarding data from localStorage and initialise
   * the active neighborhoods and work location from the user's saved selections.
   */
  useEffect(() => {
    const data = loadOnboardingData();
    if (data) {
      setOnboardingDone(true);
      setActiveNeighborhoods(data.neighborhoods);
      setWorkLocation(data.workLocation);
      setActivePreferences(getActiveCategories(data.preferences));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Work location 3D marker
  // ---------------------------------------------------------------------------

  /**
   * Renders a 3D marker at the user's work location whenever the map is ready
   * and a work address exists. Cleans up the previous marker on re-render or
   * unmount so we never show stale pins.
   */
  useEffect(() => {
    if (!mapElement || !workLocation) return;

    let cancelled = false;

    createWorkMarker(mapElement, workLocation).then((marker) => {
      if (cancelled) {
        removeWorkMarker(marker);
        return;
      }
      workMarkerRef.current = marker;
    });

    return () => {
      cancelled = true;
      removeWorkMarker(workMarkerRef.current);
      workMarkerRef.current = null;
    };
  }, [mapElement, workLocation]);

  // ---------------------------------------------------------------------------
  // Searched-address 3D marker
  // ---------------------------------------------------------------------------

  /**
   * Renders a glass-card marker at the searched address showing just the
   * street portion (e.g. "2140 Divisadero St"). Hidden when the nearby
   * places panel is collapsed. Cleans up on collapse / re-render / unmount.
   */
  useEffect(() => {
    if (!mapElement || !lastSearchedLocation || isNearbyCollapsed) return;

    let cancelled = false;

    const street = extractStreetAddress(lastSearchedLocation.formattedAddress);

    // Compute marker altitude so it floats above the building rooftop.
    // buildingHeightMeters is absolute (above sea level) so we subtract
    // terrain elevation to get the height above ground for RELATIVE_TO_GROUND.
    const { buildingHeightMeters, elevationMeters } = lastSearchedLocation;
    let markerAltitude = 0;
    if (buildingHeightMeters != null && elevationMeters != null) {
      markerAltitude = buildingHeightMeters - elevationMeters;
    } else if (elevationMeters != null) {
      markerAltitude = 10; // default ~1 storey above ground
    }

    createSearchedAddressMarker(mapElement, {
      lat: lastSearchedLocation.lat,
      lng: lastSearchedLocation.lng,
      streetAddress: street,
      altitude: markerAltitude,
    }).then((marker) => {
      if (cancelled) {
        removePlaceMarker(marker);
        return;
      }
      searchMarkerRef.current = marker;
    });

    return () => {
      cancelled = true;
      removePlaceMarker(searchMarkerRef.current);
      searchMarkerRef.current = null;
    };
  }, [mapElement, lastSearchedLocation, isNearbyCollapsed]);

  // ---------------------------------------------------------------------------
  // Route polyline rendering
  // ---------------------------------------------------------------------------

  /**
   * Renders the driving route polyline on the map whenever commute info
   * is available and the panel is not collapsed. Cleans up the polyline
   * when collapsed, re-rendered, or unmounted.
   */
  useEffect(() => {
    if (!mapElement || !commuteInfo || isCommuteCollapsed) return;

    let cancelled = false;

    const coords = decodePolyline(commuteInfo.encodedPolyline);
    renderRoute(mapElement, coords).then((polyline) => {
      if (cancelled) {
        removeRoute(polyline);
        return;
      }
      routePolylineRef.current = polyline;
    });

    return () => {
      cancelled = true;
      removeRoute(routePolylineRef.current);
      routePolylineRef.current = null;
    };
  }, [mapElement, commuteInfo, isCommuteCollapsed]);

  // ---------------------------------------------------------------------------
  // Nearby place markers (one per active preference category)
  // ---------------------------------------------------------------------------

  /**
   * Renders a 3D marker for each nearby-place result whenever the map is
   * ready, results are available, and the panel is not collapsed. Cleans
   * up all markers when collapsed, re-rendered, or unmounted.
   */
  useEffect(() => {
    if (!mapElement || nearbyPlaces.length === 0 || isNearbyCollapsed) return;

    let cancelled = false;

    async function renderMarkers() {
      for (const result of nearbyPlaces) {
        if (cancelled) break;

        const marker = await createPlaceMarker(mapElement!, {
          lat: result.lat,
          lng: result.lng,
          name: result.name,
          category: result.category,
        });

        if (cancelled) {
          removePlaceMarker(marker);
        } else {
          placeMarkersRef.current.set(result.category, marker);
        }
      }
    }

    renderMarkers();

    return () => {
      cancelled = true;
      for (const marker of placeMarkersRef.current.values()) {
        removePlaceMarker(marker);
      }
      placeMarkersRef.current.clear();
    };
  }, [mapElement, nearbyPlaces, isNearbyCollapsed]);

  // ---------------------------------------------------------------------------
  // Walking route polylines (one per nearby place)
  // ---------------------------------------------------------------------------

  /**
   * Renders a coloured walking-route polyline for each nearby-place result
   * that has an encoded polyline. Each route uses the category-specific
   * colour defined in NEARBY_CATEGORIES. Hidden when the panel is collapsed.
   * Cleans up on collapse / re-render / unmount.
   */
  useEffect(() => {
    if (!mapElement || nearbyPlaces.length === 0 || isNearbyCollapsed) return;

    let cancelled = false;

    async function renderWalkingRoutes() {
      for (const result of nearbyPlaces) {
        if (cancelled) break;
        if (!result.encodedPolyline) continue;

        const cat = NEARBY_CATEGORIES[result.category];
        const color = cat?.routeColor ?? "rgba(107, 114, 128, 0.85)";

        const coords = decodePolyline(result.encodedPolyline);
        const polyline = await renderRoute(mapElement!, coords, {
          strokeColor: color,
          strokeWidth: 8,
        });

        if (cancelled) {
          removeRoute(polyline);
        } else {
          walkingRoutesRef.current.set(result.category, polyline);
        }
      }
    }

    renderWalkingRoutes();

    return () => {
      cancelled = true;
      for (const polyline of walkingRoutesRef.current.values()) {
        removeRoute(polyline);
      }
      walkingRoutesRef.current.clear();
    };
  }, [mapElement, nearbyPlaces, isNearbyCollapsed]);

  // ---------------------------------------------------------------------------
  // Walking route hover highlighting
  // ---------------------------------------------------------------------------

  /**
   * Highlights the walking route for the currently hovered category in the
   * NearbyPlacesPanel. The hovered route gets a wider, fully-opaque stroke
   * while all other routes are dimmed. Resets when nothing is hovered.
   */
  useEffect(() => {
    const routes = walkingRoutesRef.current;
    if (routes.size === 0) return;

    for (const [category, polyline] of routes) {
      const cat = NEARBY_CATEGORIES[category];
      const baseColor = cat?.routeColor ?? "rgba(107, 114, 128, 0.85)";

      if (hoveredCategory === null) {
        // No hover — restore all routes to their default style
        polyline.strokeWidth = 8;
        polyline.strokeColor = baseColor;
      } else if (category === hoveredCategory) {
        // Highlighted route: wider, full opacity
        polyline.strokeWidth = 14;
        polyline.strokeColor = baseColor.replace(/[\d.]+\)$/, "1)");
      } else {
        // Dimmed route: thinner, reduced opacity
        polyline.strokeWidth = 5;
        polyline.strokeColor = baseColor.replace(/[\d.]+\)$/, "0.3)");
      }
    }
  }, [hoveredCategory]);

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
   * Ref that tracks the current work location so handleLocationFound
   * can access it without being re-created when workLocation changes.
   */
  const workLocationRef = useRef<WorkLocation | null>(null);
  workLocationRef.current = workLocation;

  /**
   * Ref that tracks the current active preferences so handleLocationFound
   * can access them without being re-created when preferences change.
   */
  const activePreferencesRef = useRef<string[]>([]);
  activePreferencesRef.current = activePreferences;

  /**
   * Handles when an address is found via geocoding.
   * Uses the building outline polygon when available for a precise footprint
   * highlight; falls back to a circular highlight otherwise.
   * Also fetches driving directions to the user's work location if set.
   */
  const handleLocationFound = useCallback((location: GeocodedLocation) => {
    setLastSearchedLocation(location);

    // Clear any existing highlights and previous data
    mapRef.current?.clearHighlights();
    setCommuteInfo(null);
    setNearbyPlaces([]);
    setIsCommuteCollapsed(false);
    setIsNearbyCollapsed(false);

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

    // -----------------------------------------------------------------------
    // Fetch driving directions to the user's work location
    // -----------------------------------------------------------------------
    const work = workLocationRef.current;
    if (work) {
      setIsCommuteLoading(true);

      const params = new URLSearchParams({
        originLat: String(location.lat),
        originLng: String(location.lng),
        destLat: String(work.lat),
        destLng: String(work.lng),
      });

      fetch(`/api/directions?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: DirectionsResponse | null) => {
          if (data) {
            setCommuteInfo({
              durationText: data.durationText,
              distanceText: data.distanceText,
              encodedPolyline: data.encodedPolyline,
            });
          }
        })
        .catch((err) => console.error("Directions fetch error:", err))
        .finally(() => setIsCommuteLoading(false));
    }

    // -----------------------------------------------------------------------
    // Fetch nearby places for all active preference categories
    // -----------------------------------------------------------------------
    const cats = activePreferencesRef.current;
    if (cats.length > 0) {
      setIsNearbyLoading(true);

      const nearbyParams = new URLSearchParams({
        lat: String(location.lat),
        lng: String(location.lng),
        categories: cats.join(","),
      });

      fetch(`/api/nearby-places?${nearbyParams.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: NearbyPlacesResponse | null) => {
          if (data?.results) {
            setNearbyPlaces(data.results);
          }
        })
        .catch((err) => console.error("Nearby places fetch error:", err))
        .finally(() => setIsNearbyLoading(false));
    }
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

      {/* Bottom Left Stack: Commute + Coffee + Heatmap Controls */}
      {isMapReady && (
        <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-3">
          {/* Commute Panel - shown when directions are loading or available */}
          {(isCommuteLoading || commuteInfo) && (
            <CommutePanel
              durationText={commuteInfo?.durationText ?? ""}
              distanceText={commuteInfo?.distanceText ?? ""}
              isLoading={isCommuteLoading}
              isCollapsed={isCommuteCollapsed}
              onCollapse={() => setIsCommuteCollapsed(true)}
              onExpand={() => setIsCommuteCollapsed(false)}
            />
          )}

          {/* Nearby Places Panel - shown when batch search is loading or has results */}
          {(isNearbyLoading || nearbyPlaces.length > 0) && (
            <NearbyPlacesPanel
              results={nearbyPlaces}
              isLoading={isNearbyLoading}
              hoveredCategory={hoveredCategory}
              onHover={setHoveredCategory}
              isCollapsed={isNearbyCollapsed}
              onCollapse={() => setIsNearbyCollapsed(true)}
              onExpand={() => setIsNearbyCollapsed(false)}
            />
          )}

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
