import { NextRequest, NextResponse } from "next/server";

/**
 * A single polygon ring: array of [lng, lat] coordinate pairs.
 * Follows GeoJSON convention (longitude first).
 */
type PolygonRing = number[][];

/**
 * GeoJSON-style polygon geometry returned by the Geocoding API
 * for building outlines.
 */
interface DisplayPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: PolygonRing[] | PolygonRing[][];
}

/**
 * Shape of a single building outline entry in the API response.
 */
interface BuildingOutline {
  display_polygon: DisplayPolygon;
}

/**
 * Shape of a single building entry in the API response.
 */
interface BuildingEntry {
  place_id: string;
  building_outlines: BuildingOutline[];
}

/**
 * The raw geocoding result shape we care about from the REST API response.
 */
interface GeocodingResult {
  formatted_address: string;
  place_id: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  types: string[];
}

/**
 * Full REST API response shape from the Google Geocoding API
 * when called with extra_computations=BUILDING_AND_ENTRANCES.
 */
interface GeocodingApiResponse {
  status: string;
  results: GeocodingResult[];
  buildings?: BuildingEntry[];
}

// ── Solar API types ──────────────────────────────────────────────────────

/**
 * A lat/lng pair as returned by the Solar API.
 */
interface SolarLatLng {
  latitude: number;
  longitude: number;
}

/**
 * Bounding box as returned by the Solar API.
 */
interface SolarLatLngBox {
  sw: SolarLatLng;
  ne: SolarLatLng;
}

/**
 * Roof segment stats from the Solar API buildingInsights response.
 */
interface RoofSegmentStats {
  planeHeightAtCenterMeters: number;
  pitchDegrees: number;
  azimuthDegrees: number;
  boundingBox: SolarLatLngBox;
  center: SolarLatLng;
}

/**
 * Subset of the Solar API buildingInsights response we care about.
 */
interface BuildingInsightsResponse {
  center: SolarLatLng;
  boundingBox: SolarLatLngBox;
  solarPotential?: {
    roofSegmentStats?: RoofSegmentStats[];
    buildingStats?: {
      areaMeters2: number;
      groundAreaMeters2: number;
    };
  };
}

// ── Exported response types ──────────────────────────────────────────────

/**
 * Normalized building outline returned to the client.
 * Coordinates are in [lat, lng] order (Google Maps convention),
 * converted from GeoJSON's [lng, lat] order.
 */
export interface BuildingOutlineResult {
  /** Array of coordinate rings. Each ring is an array of {lat, lng} objects. */
  rings: Array<Array<{ lat: number; lng: number }>>;
}

/**
 * Bounding box for a building, normalized to {lat, lng} convention.
 */
export interface BuildingBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

/**
 * The response body shape returned by this API route.
 */
export interface GeocodeResponse {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  /** Building outline polygon from Geocoding API, if available. */
  buildingOutline: BuildingOutlineResult | null;
  /** Bounding box around the building from the Solar API, if available. */
  buildingBounds: BuildingBounds | null;
  /** Building height in meters above ground from the Solar API, if available. */
  buildingHeightMeters: number | null;
}

// ── Helper functions ─────────────────────────────────────────────────────

/**
 * Converts a GeoJSON display_polygon into our normalized BuildingOutlineResult.
 * GeoJSON uses [lng, lat] order; we convert to {lat, lng} objects.
 *
 * @param polygon - The GeoJSON polygon from Google's API
 * @returns Normalized building outline with lat/lng coordinate rings
 */
function normalizePolygon(polygon: DisplayPolygon): BuildingOutlineResult {
  if (polygon.type === "Polygon") {
    const rings = (polygon.coordinates as PolygonRing[]).map((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng }))
    );
    return { rings };
  }

  // MultiPolygon: flatten all polygons' rings
  const allRings = (polygon.coordinates as PolygonRing[][]).flatMap(
    (polygonRings) =>
      polygonRings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
  );
  return { rings: allRings };
}

/**
 * Fetches building insights from the Solar API for a given lat/lng.
 * Returns bounding box and max roof height, or nulls if unavailable.
 *
 * @param lat - Latitude of the building
 * @param lng - Longitude of the building
 * @param apiKey - Google Maps API key
 * @returns Object with buildingBounds and buildingHeightMeters
 */
async function fetchBuildingInsights(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ buildingBounds: BuildingBounds | null; buildingHeightMeters: number | null }> {
  try {
    const params = new URLSearchParams({
      "location.latitude": lat.toFixed(6),
      "location.longitude": lng.toFixed(6),
      requiredQuality: "LOW",
      key: apiKey,
    });

    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`Solar API returned ${res.status} for ${lat},${lng}`);
      return { buildingBounds: null, buildingHeightMeters: null };
    }

    const data = (await res.json()) as BuildingInsightsResponse;

    // Extract bounding box
    let buildingBounds: BuildingBounds | null = null;
    if (data.boundingBox) {
      buildingBounds = {
        sw: {
          lat: data.boundingBox.sw.latitude,
          lng: data.boundingBox.sw.longitude,
        },
        ne: {
          lat: data.boundingBox.ne.latitude,
          lng: data.boundingBox.ne.longitude,
        },
      };
    }

    // Extract max roof height across all segments
    let buildingHeightMeters: number | null = null;
    const segments = data.solarPotential?.roofSegmentStats;
    if (segments && segments.length > 0) {
      buildingHeightMeters = Math.max(
        ...segments.map((s) => s.planeHeightAtCenterMeters)
      );
    }

    return { buildingBounds, buildingHeightMeters };
  } catch (err) {
    console.error("Solar API error:", err);
    return { buildingBounds: null, buildingHeightMeters: null };
  }
}

// ── Route handler ────────────────────────────────────────────────────────

/**
 * GET /api/geocode
 *
 * Geocodes an address or place ID using the Google Geocoding REST API with
 * the BUILDING_AND_ENTRANCES extra computation, and enriches the result
 * with building bounding box and height from the Solar API.
 *
 * Query params:
 *   - address: The address string to geocode (mutually exclusive with placeId)
 *   - placeId: A Google place ID to geocode (mutually exclusive with address)
 *
 * Returns a GeocodeResponse JSON body.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const placeId = searchParams.get("placeId");

  if (!address && !placeId) {
    return NextResponse.json(
      { error: "Either 'address' or 'placeId' query param is required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured." },
      { status: 500 }
    );
  }

  // Build the Geocoding REST API URL
  const geocodeParams = new URLSearchParams({
    key: apiKey,
    extra_computations: "BUILDING_AND_ENTRANCES",
  });

  if (placeId) {
    geocodeParams.set("place_id", placeId);
  } else if (address) {
    geocodeParams.set("address", address);
  }

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams.toString()}`;

  try {
    const res = await fetch(geocodeUrl);
    const data = (await res.json()) as GeocodingApiResponse;

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json(
        { error: `Geocoding failed: ${data.status}` },
        { status: 404 }
      );
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    // Extract building outline if present
    let buildingOutline: BuildingOutlineResult | null = null;
    if (data.buildings && data.buildings.length > 0) {
      const building = data.buildings[0];
      if (building.building_outlines?.length > 0) {
        const outline = building.building_outlines[0];
        buildingOutline = normalizePolygon(outline.display_polygon);
      }
    }

    // Fetch building bounds and height from Solar API (in parallel with nothing — it's after geocoding)
    const { buildingBounds, buildingHeightMeters } =
      await fetchBuildingInsights(lat, lng, apiKey);

    const response: GeocodeResponse = {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      buildingOutline,
      buildingBounds,
      buildingHeightMeters,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Geocode API error:", err);
    return NextResponse.json(
      { error: "Failed to geocode address." },
      { status: 500 }
    );
  }
}
