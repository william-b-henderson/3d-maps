import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Google API response types
// ---------------------------------------------------------------------------

interface PlacesTextSearchResponse {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }>;
  routingSummaries?: Array<{
    legs?: Array<{
      duration?: string;
      distanceMeters?: number;
    }>;
  }>;
}

interface RoutesApiResponse {
  routes?: Array<{
    polyline?: { encodedPolyline?: string };
  }>;
}

// ---------------------------------------------------------------------------
// Exported response types (consumed by the client)
// ---------------------------------------------------------------------------

/**
 * A single nearby-place result for one category.
 */
export interface NearbyPlaceResult {
  /** Preference category ID (e.g. "fitness"). */
  category: string;
  /** Display name of the place. */
  name: string;
  /** Formatted address. */
  address: string;
  /** Latitude of the place. */
  lat: number;
  /** Longitude of the place. */
  lng: number;
  /** Walking duration in seconds. */
  walkingSeconds: number;
  /** Human-readable walking duration (e.g. "8 min walk"). */
  walkingText: string;
  /** Human-readable walking distance (e.g. "0.3 mi"). */
  walkingDistanceText: string;
  /** Encoded polyline for the walking route. */
  encodedPolyline: string;
}

/**
 * The response body shape returned by this API route.
 */
export interface NearbyPlacesResponse {
  results: NearbyPlaceResult[];
}

// ---------------------------------------------------------------------------
// Category → query mapping (duplicated from lib to avoid client import)
// ---------------------------------------------------------------------------

const CATEGORY_QUERIES: Record<string, string> = {
  fitness: "gym",
  outdoors: "park",
  daily_rituals: "coffee shop",
  food_social: "restaurant",
  nightlife: "bar",
  convenience: "grocery store",
  walkability: "transit station",
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Formats a duration in seconds into a human-readable walking string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "6 min walk"
 */
function formatWalkingDuration(seconds: number): string {
  if (seconds < 60) return "1 min walk";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min walk`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr walk`;
  return `${hours} hr ${remainingMinutes} min walk`;
}

/**
 * Formats a distance in meters into a human-readable string.
 *
 * @param meters - Distance in meters
 * @returns Formatted string like "0.3 mi"
 */
function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.281)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Fetches a walking route polyline between two points via the Routes API.
 *
 * @returns Encoded polyline string, or empty string on failure.
 */
async function fetchWalkingPolyline(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<string> {
  try {
    const body = {
      origin: {
        location: { latLng: { latitude: originLat, longitude: originLng } },
      },
      destination: {
        location: { latLng: { latitude: destLat, longitude: destLng } },
      },
      travelMode: "WALK",
    };

    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) return "";
    const data = (await res.json()) as RoutesApiResponse;
    return data.routes?.[0]?.polyline?.encodedPolyline ?? "";
  } catch {
    return "";
  }
}

/**
 * Searches for the nearest place matching a text query near a location,
 * then fetches the walking route polyline to it.
 *
 * @param category - The preference category ID.
 * @param query - The Places text-search query string.
 * @param lat - Origin latitude.
 * @param lng - Origin longitude.
 * @param apiKey - Google Maps API key.
 * @returns A NearbyPlaceResult, or null if no place was found.
 */
async function searchCategory(
  category: string,
  query: string,
  lat: number,
  lng: number,
  apiKey: string
): Promise<NearbyPlaceResult | null> {
  try {
    const body = {
      textQuery: query,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 1500 },
      },
      maxResultCount: 1,
      routingParameters: {
        origin: { latitude: lat, longitude: lng },
        travelMode: "WALK",
      },
    };

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,routingSummaries",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as PlacesTextSearchResponse;
    if (!data.places?.length) return null;

    const place = data.places[0];
    const leg = data.routingSummaries?.[0]?.legs?.[0];

    const durationStr = leg?.duration ?? "0s";
    const walkingSeconds = parseInt(durationStr.replace("s", ""), 10) || 0;
    const walkingMeters = leg?.distanceMeters ?? 0;

    const placeLat = place.location?.latitude ?? lat;
    const placeLng = place.location?.longitude ?? lng;

    // Fetch walking polyline
    const encodedPolyline = await fetchWalkingPolyline(
      lat,
      lng,
      placeLat,
      placeLng,
      apiKey
    );

    return {
      category,
      name: place.displayName?.text ?? query,
      address: place.formattedAddress ?? "",
      lat: placeLat,
      lng: placeLng,
      walkingSeconds,
      walkingText: formatWalkingDuration(walkingSeconds),
      walkingDistanceText: formatDistance(walkingMeters),
      encodedPolyline,
    };
  } catch (err) {
    console.error(`Nearby places error for ${category}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/nearby-places
 *
 * Batch-finds the nearest place for each requested category using the Google
 * Places API Text Search (New) with walking routing summaries, then fetches
 * walking polylines via the Routes API. All categories run in parallel.
 *
 * Query params:
 *   - lat: Origin latitude
 *   - lng: Origin longitude
 *   - categories: Comma-separated list of category IDs (e.g. "fitness,daily_rituals")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const categoriesParam = searchParams.get("categories");

  if (!lat || !lng || !categoriesParam) {
    return NextResponse.json(
      { error: "lat, lng, and categories query params are required." },
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

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  // Filter to only valid categories
  const categories = categoriesParam
    .split(",")
    .filter((c) => c in CATEGORY_QUERIES);

  if (categories.length === 0) {
    return NextResponse.json(
      { error: "No valid categories provided." },
      { status: 400 }
    );
  }

  // Search all categories in parallel
  const promises = categories.map((cat) =>
    searchCategory(cat, CATEGORY_QUERIES[cat], latitude, longitude, apiKey)
  );

  const settled = await Promise.all(promises);
  const results = settled.filter(
    (r): r is NearbyPlaceResult => r !== null
  );

  const response: NearbyPlacesResponse = { results };
  return NextResponse.json(response);
}
