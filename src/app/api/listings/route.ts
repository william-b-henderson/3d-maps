import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listings } from "@/lib/schema";
import { eq, and, gte, lte, isNotNull, sql } from "drizzle-orm";
import type { ListingMarkerData } from "@/lib/types/listing";

// ---------------------------------------------------------------------------
// Exported response type (consumed by the client)
// ---------------------------------------------------------------------------

export interface ListingsResponse {
  listings: ListingMarkerData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely converts a Drizzle `numeric` string to a JS number, or null.
 *
 * @param value - The string value returned by Drizzle for a numeric column.
 * @returns The parsed number, or null if the value is falsy or NaN.
 */
function toNumber(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// GET /api/listings
// ---------------------------------------------------------------------------

/**
 * Returns live listings with only the columns needed for map markers.
 *
 * Optional query params:
 *   - minLat, maxLat, minLng, maxLng — bounding-box viewport filter
 *   - minPrice, maxPrice — price range filter
 *   - neighborhoods — comma-separated neighborhood names for PostGIS
 *     spatial filter (uses ST_Contains against the neighborhoods table)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const minLat = searchParams.get("minLat");
    const maxLat = searchParams.get("maxLat");
    const minLng = searchParams.get("minLng");
    const maxLng = searchParams.get("maxLng");

    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const neighborhoodsCsv = searchParams.get("neighborhoods");

    // Base conditions: must be live with valid coordinates
    const conditions = [
      eq(listings.isLive, true),
      isNotNull(listings.latitude),
      isNotNull(listings.longitude),
    ];

    // Bounding-box viewport filter
    if (minLat && maxLat && minLng && maxLng) {
      conditions.push(
        gte(listings.latitude, minLat),
        lte(listings.latitude, maxLat),
        gte(listings.longitude, minLng),
        lte(listings.longitude, maxLng)
      );
    }

    // Price range filter
    if (minPrice) {
      conditions.push(gte(listings.price, minPrice));
    }
    if (maxPrice) {
      conditions.push(lte(listings.price, maxPrice));
    }

    // Neighborhood spatial filter using PostGIS ST_Contains.
    // When provided, only return listings whose coordinates fall within
    // at least one of the specified neighborhoods.
    if (neighborhoodsCsv) {
      const names = neighborhoodsCsv
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length > 0) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM neighborhoods n
            WHERE n.name = ANY(${names})
              AND ST_Contains(n.the_geom, ${listings.coordinates})
          )`
        );
      }
    }

    const rows = await db
      .select({
        id: listings.id,
        latitude: listings.latitude,
        longitude: listings.longitude,
        price: listings.price,
        beds: listings.beds,
        baths: listings.baths,
        address: listings.address,
        statusText: listings.statusText,
        zpid: listings.zpid,
      })
      .from(listings)
      .where(and(...conditions));

    const result: ListingMarkerData[] = rows.map((row) => ({
      id: row.id,
      latitude: toNumber(row.latitude)!,
      longitude: toNumber(row.longitude)!,
      price: toNumber(row.price),
      beds: toNumber(row.beds),
      baths: toNumber(row.baths),
      address: row.address,
      statusText: row.statusText,
      zpid: row.zpid,
    }));

    return NextResponse.json<ListingsResponse>({ listings: result });
  } catch (error) {
    console.error("[/api/listings] Error fetching listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}
