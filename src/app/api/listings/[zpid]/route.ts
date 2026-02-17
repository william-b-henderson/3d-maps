import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listings, listingImages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { ListingDetail } from "@/lib/types/listing";

// ---------------------------------------------------------------------------
// Exported response type (consumed by the client)
// ---------------------------------------------------------------------------

export interface ListingDetailResponse {
  listing: ListingDetail | null;
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
// GET /api/listings/[zpid]
// ---------------------------------------------------------------------------

/**
 * Returns a single listing with detail fields and its first image URL.
 *
 * Uses the `zpid` parameter from the URL path. Joins with `listing_images`
 * via the `zpid` foreign key and picks the first available image.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ zpid: string }> }
) {
  try {
    const { zpid } = await params;

    // Fetch the listing row
    const [row] = await db
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
      .where(eq(listings.zpid, zpid))
      .limit(1);

    if (!row) {
      return NextResponse.json<ListingDetailResponse>({ listing: null });
    }

    // Fetch the first image for this listing
    const [image] = await db
      .select({ imageUrl: listingImages.imageUrl })
      .from(listingImages)
      .where(eq(listingImages.zpid, zpid))
      .limit(1);

    const detail: ListingDetail = {
      id: row.id,
      latitude: toNumber(row.latitude)!,
      longitude: toNumber(row.longitude)!,
      price: toNumber(row.price),
      beds: toNumber(row.beds),
      baths: toNumber(row.baths),
      address: row.address,
      statusText: row.statusText,
      zpid: row.zpid,
      imageUrl: image?.imageUrl ?? null,
    };

    return NextResponse.json<ListingDetailResponse>({ listing: detail });
  } catch (error) {
    console.error("[/api/listings/zpid] Error fetching listing detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing detail" },
      { status: 500 }
    );
  }
}
