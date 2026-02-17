"use client";

/**
 * ListingInfoCard — bottom-centred glass-card overlay that displays details
 * about a selected listing: address, beds/baths, price, and the first photo.
 *
 * Clicking the card navigates to the full listing detail page.
 * Shows a skeleton loading state while the detail API is being fetched.
 */

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils/format";
import type { ListingMarkerData } from "@/lib/types/listing";
import type { ListingDetail } from "@/lib/types/listing";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingInfoCardProps {
  /** Base marker data (always available immediately on click). */
  listing: ListingMarkerData;
  /** Full detail data including image (null while loading). */
  detail: ListingDetail | null;
  /** Whether the detail API request is in flight. */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListingInfoCard({
  listing,
  detail,
  isLoading,
}: ListingInfoCardProps) {
  const imageUrl = detail?.imageUrl;
  const beds = listing.beds;
  const baths = listing.baths;

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="flex bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 gap-3 max-w-sm w-full cursor-pointer hover:bg-white/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
    >
      {/* Image or placeholder */}
      <div className="shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-white/10">
        {isLoading ? (
          <div className="w-full h-full animate-pulse bg-white/10 rounded-xl" />
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={listing.address ?? "Listing photo"}
            width={112}
            height={112}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9.5L12 4l9 5.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 22V12h6v10"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col justify-center min-w-0">
        {/* Price */}
        <p className="text-lg font-bold text-white leading-tight">
          {formatPrice(listing.price)}
        </p>

        {/* Address */}
        {listing.address && (
          <p className="text-sm font-semibold text-white/90 mt-0.5 truncate">
            {listing.address}
          </p>
        )}

        {/* Beds / Baths */}
        {(beds != null || baths != null) && (
          <p className="text-xs text-white/70 mt-1">
            {beds != null ? `${beds} bed` : ""}
            {beds != null && baths != null ? " / " : ""}
            {baths != null ? `${baths} bath` : ""}
          </p>
        )}

        {/* Status */}
        {listing.statusText && (
          <p className="text-xs text-white/50 mt-0.5">{listing.statusText}</p>
        )}
      </div>
    </Link>
  );
}
