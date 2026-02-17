import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listings, listingImages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { FullListing } from "@/lib/types/listing";

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface FullListingResponse {
  listing: FullListing | null;
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
// GET /api/listings/detail/[id]
// ---------------------------------------------------------------------------

/**
 * Returns the full listing data (all columns) plus every associated image URL.
 * Queries by UUID primary key.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [row] = await db
      .select({
        id: listings.id,
        zpid: listings.zpid,
        detailUrl: listings.detailUrl,
        statusType: listings.statusType,
        statusText: listings.statusText,
        address: listings.address,
        addressStreet: listings.addressStreet,
        addressCity: listings.addressCity,
        addressState: listings.addressState,
        addressZipcode: listings.addressZipcode,
        price: listings.price,
        beds: listings.beds,
        baths: listings.baths,
        area: listings.area,
        latitude: listings.latitude,
        longitude: listings.longitude,
        description: listings.description,
        yearBuilt: listings.yearBuilt,
        parkingSpaces: listings.parkingSpaces,
        hasAirConditioning: listings.hasAirConditioning,
        hasHeating: listings.hasHeating,
        hasDishwasher: listings.hasDishwasher,
        hasWasherDryer: listings.hasWasherDryer,
        petsAllowed: listings.petsAllowed,
        amenities: listings.amenities,
        petPolicy: listings.petPolicy,
        crimeScore: listings.crimeScore,
        trafficScore: listings.trafficScore,
        overallScore: listings.overallScore,
      })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json<FullListingResponse>({ listing: null });
    }

    // Fetch all images for this listing
    const imageRows = await db
      .select({ imageUrl: listingImages.imageUrl })
      .from(listingImages)
      .where(eq(listingImages.zpid, row.zpid));

    const listing: FullListing = {
      id: row.id,
      zpid: row.zpid,
      detailUrl: row.detailUrl,
      statusType: row.statusType,
      statusText: row.statusText,
      address: row.address,
      addressStreet: row.addressStreet,
      addressCity: row.addressCity,
      addressState: row.addressState,
      addressZipcode: row.addressZipcode,
      price: toNumber(row.price),
      beds: toNumber(row.beds),
      baths: toNumber(row.baths),
      area: row.area,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
      description: row.description,
      yearBuilt: row.yearBuilt,
      parkingSpaces: row.parkingSpaces,
      hasAirConditioning: row.hasAirConditioning,
      hasHeating: row.hasHeating,
      hasDishwasher: row.hasDishwasher,
      hasWasherDryer: row.hasWasherDryer,
      petsAllowed: row.petsAllowed,
      amenities: row.amenities,
      petPolicy: row.petPolicy,
      crimeScore: row.crimeScore,
      trafficScore: row.trafficScore,
      overallScore: row.overallScore,
      images: imageRows.map((r) => r.imageUrl),
    };

    return NextResponse.json<FullListingResponse>({ listing });
  } catch (error) {
    console.error("[/api/listings/detail] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}
