/**
 * Minimal listing data needed to render a 3D marker on the map.
 *
 * This interface is shared between the server-side API route
 * (`/api/listings`) and the client-side marker factory so the
 * response shape stays consistent.
 */
export interface ListingMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  price: number | null;
  beds: number | null;
  baths: number | null;
  address: string | null;
  statusText: string | null;
  zpid: string;
}

/**
 * Extended listing data returned by the detail endpoint
 * (`/api/listings/[zpid]`). Includes the first listing image URL.
 */
export interface ListingDetail extends ListingMarkerData {
  imageUrl: string | null;
}

/**
 * Complete listing data for the dedicated listing detail page
 * (`/listing/[id]`). Includes every column from the listings table
 * plus all associated image URLs.
 */
export interface FullListing {
  id: string;
  zpid: string;
  detailUrl: string | null;
  statusType: string | null;
  statusText: string | null;
  address: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  yearBuilt: number | null;
  parkingSpaces: number | null;
  hasAirConditioning: boolean | null;
  hasHeating: boolean | null;
  hasDishwasher: boolean | null;
  hasWasherDryer: boolean | null;
  petsAllowed: boolean | null;
  amenities: unknown;
  petPolicy: unknown;
  crimeScore: number | null;
  trafficScore: number | null;
  overallScore: number | null;
  images: string[];
}
