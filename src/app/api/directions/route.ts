import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Google Routes API types
// ---------------------------------------------------------------------------

/**
 * Subset of the Routes API computeRoutes response we care about.
 */
interface RoutesApiResponse {
  routes?: Array<{
    duration?: string; // e.g. "1380s"
    distanceMeters?: number;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Exported response type (consumed by the client)
// ---------------------------------------------------------------------------

/**
 * The response body shape returned by this API route.
 */
export interface DirectionsResponse {
  /** Total driving duration in seconds. */
  durationSeconds: number;
  /** Human-readable duration string (e.g. "23 min"). */
  durationText: string;
  /** Total distance in meters. */
  distanceMeters: number;
  /** Human-readable distance string (e.g. "8.4 mi"). */
  distanceText: string;
  /** Encoded polyline representing the route geometry. */
  encodedPolyline: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Formats a duration in seconds into a human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "23 min" or "1 hr 15 min"
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Formats a distance in meters into a human-readable miles string.
 *
 * @param meters - Distance in meters
 * @returns Formatted string like "8.4 mi"
 */
function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/directions
 *
 * Computes driving directions between two points using the Google Routes API.
 * Returns duration, distance, and an encoded polyline for map rendering.
 *
 * Query params:
 *   - originLat: Origin latitude
 *   - originLng: Origin longitude
 *   - destLat: Destination latitude
 *   - destLng: Destination longitude
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originLat = searchParams.get("originLat");
  const originLng = searchParams.get("originLng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: "originLat, originLng, destLat, and destLng are all required." },
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

  try {
    const body = {
      origin: {
        location: {
          latLng: {
            latitude: parseFloat(originLat),
            longitude: parseFloat(originLng),
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: parseFloat(destLat),
            longitude: parseFloat(destLng),
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    };

    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Routes API returned ${res.status}: ${text}`);
      return NextResponse.json(
        { error: `Routes API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as RoutesApiResponse;

    if (!data.routes?.length) {
      return NextResponse.json(
        { error: "No route found between the given locations." },
        { status: 404 }
      );
    }

    const route = data.routes[0];

    // Duration comes as a string like "1380s" — parse out the number
    const durationStr = route.duration ?? "0s";
    const durationSeconds = parseInt(durationStr.replace("s", ""), 10) || 0;
    const distanceMeters = route.distanceMeters ?? 0;
    const encodedPolyline = route.polyline?.encodedPolyline ?? "";

    if (!encodedPolyline) {
      return NextResponse.json(
        { error: "Route found but no polyline data available." },
        { status: 502 }
      );
    }

    const response: DirectionsResponse = {
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      distanceMeters,
      distanceText: formatDistance(distanceMeters),
      encodedPolyline,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Directions API error:", err);
    return NextResponse.json(
      { error: "Failed to compute directions." },
      { status: 500 }
    );
  }
}
