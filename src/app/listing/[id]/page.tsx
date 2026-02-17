"use client";

/**
 * Listing detail page — displays all information about a single listing
 * including photos, description, features, scores, and a link to the
 * original Zillow listing. Uses a light glass-morphism theme.
 */

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatPriceFull } from "@/lib/utils/format";
import PhotoLightbox from "@/components/PhotoLightbox";
import ListingMiniMap from "@/components/ListingMiniMap";
import type { FullListing } from "@/lib/types/listing";
import type { FullListingResponse } from "@/app/api/listings/detail/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a full address string from individual address components.
 *
 * @returns e.g. "123 Main St, San Francisco, CA 94102" or falls back to
 *   the generic `address` field.
 */
function buildFullAddress(listing: FullListing): string {
  const parts: string[] = [];
  if (listing.addressStreet) parts.push(listing.addressStreet);
  const cityStateZip = [
    listing.addressCity,
    listing.addressState,
    listing.addressZipcode,
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) parts.push(cityStateZip);
  return parts.length > 0 ? parts.join(", ") : listing.address ?? "";
}

/**
 * Returns a Tailwind colour class for a 0-10 score where lower is better.
 *
 * @param score - Score from 0 to 10.
 */
function scoreColor(score: number): string {
  if (score <= 3) return "bg-emerald-500";
  if (score <= 6) return "bg-amber-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Feature pill data
// ---------------------------------------------------------------------------

interface FeaturePill {
  label: string;
  available: boolean | null;
}

/**
 * Builds an array of feature pills from the listing's boolean fields.
 */
function getFeatures(listing: FullListing): FeaturePill[] {
  return [
    { label: "A/C", available: listing.hasAirConditioning },
    { label: "Heating", available: listing.hasHeating },
    { label: "Dishwasher", available: listing.hasDishwasher },
    { label: "Washer / Dryer", available: listing.hasWasherDryer },
    { label: "Pets Allowed", available: listing.petsAllowed },
    {
      label: `${listing.parkingSpaces ?? 0} Parking`,
      available: listing.parkingSpaces != null && listing.parkingSpaces > 0,
    },
  ];
}

/**
 * Builds the quick-stats array, omitting entries with null values.
 */
function getStats(
  listing: FullListing
): { label: string; value: string | number }[] {
  const stats: { label: string; value: string | number }[] = [];
  if (listing.beds != null) stats.push({ label: "Beds", value: listing.beds });
  if (listing.baths != null)
    stats.push({ label: "Baths", value: listing.baths });
  if (listing.area != null)
    stats.push({ label: "Sq Ft", value: listing.area.toLocaleString() });
  if (listing.yearBuilt != null)
    stats.push({ label: "Built", value: listing.yearBuilt });
  return stats;
}

// ---------------------------------------------------------------------------
// Page params
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListingPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [listing, setListing] = useState<FullListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/detail/${id}`);
        if (!res.ok) return;
        const data: FullListingResponse = await res.json();
        setListing(data.listing);
      } catch (err) {
        console.error("Failed to load listing:", err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [id]);

  /** Move carousel to the previous image (wraps). */
  const carouselPrev = useCallback(() => {
    if (!listing) return;
    setCarouselIndex((i) => (i - 1 + listing.images.length) % listing.images.length);
  }, [listing]);

  /** Move carousel to the next image (wraps). */
  const carouselNext = useCallback(() => {
    if (!listing) return;
    setCarouselIndex((i) => (i + 1) % listing.images.length);
  }, [listing]);

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 space-y-4 animate-pulse max-w-2xl mx-auto">
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-5 w-72 bg-gray-200 rounded-lg" />
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 flex-1 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-32 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-500">Listing not found</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 bg-white/70 backdrop-blur-md border border-gray-200 hover:bg-white rounded-xl text-sm text-gray-700 transition-colors shadow-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const fullAddress = buildFullAddress(listing);
  const features = getFeatures(listing);
  const hasFeatures = features.some((f) => f.available === true);
  const amenitiesList: string[] = Array.isArray(listing.amenities)
    ? (listing.amenities as string[])
    : [];
  const stats = getStats(listing);
  const gridCols =
    stats.length <= 2
      ? "grid-cols-2"
      : stats.length === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  const descTruncateLength = 300;
  const descNeedsTruncation =
    listing.description != null &&
    listing.description.length > descTruncateLength;
  const displayDescription =
    descNeedsTruncation && !descExpanded
      ? listing.description!.slice(0, descTruncateLength) + "..."
      : listing.description;

  const scores = [
    { label: "Crime", value: listing.crimeScore },
    { label: "Traffic", value: listing.trafficScore },
    { label: "Overall", value: listing.overallScore },
  ].filter((s) => s.value != null) as { label: string; value: number }[];

  const totalImages = listing.images.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Lightbox */}
      {lightboxIndex != null && totalImages > 0 && (
        <PhotoLightbox
          images={listing.images}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Sticky header                                                       */}
      {/* ------------------------------------------------------------------- */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Go back"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="text-sm text-gray-500 truncate">{fullAddress}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {/* ----------------------------------------------------------------- */}
        {/* Photo carousel                                                     */}
        {/* ----------------------------------------------------------------- */}
        {totalImages > 0 && (
          <div className="relative -mx-4">
            {/* Current image */}
            <button
              type="button"
              onClick={() => setLightboxIndex(carouselIndex)}
              className="block w-full focus:outline-none"
            >
              <div className="relative w-full aspect-16/10 mx-auto overflow-hidden rounded-none sm:rounded-2xl sm:mx-4">
                <Image
                  src={listing.images[carouselIndex]}
                  alt={`Photo ${carouselIndex + 1} of ${totalImages}`}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
            </button>

            {/* Prev / Next arrows */}
            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={carouselPrev}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-md shadow-sm hover:bg-white transition-colors"
                  aria-label="Previous photo"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={carouselNext}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-md shadow-sm hover:bg-white transition-colors"
                  aria-label="Next photo"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Counter pill */}
            {totalImages > 1 && (
              <div className="absolute bottom-3 right-4 sm:right-8 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full tabular-nums">
                {carouselIndex + 1} / {totalImages}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Price + status + view listing button                              */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">
              {formatPriceFull(listing.price)}
              {listing.price != null && (
                <span className="text-base font-normal text-gray-400">/mo</span>
              )}
            </h1>
            {listing.statusText && (
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {listing.statusText}
              </span>
            )}
          </div>

          {listing.detailUrl && (
            <a
              href={listing.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              View listing
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
        </div>

        {/* Address */}
        {fullAddress && (
          <p className="text-sm text-gray-500 -mt-2">{fullAddress}</p>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Quick stats row (dynamic cols)                                     */}
        {/* ----------------------------------------------------------------- */}
        {stats.length > 0 && (
          <div className={`grid ${gridCols} gap-2`}>
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Description                                                        */}
        {/* ----------------------------------------------------------------- */}
        {listing.description && (
          <section className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Description
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {displayDescription}
            </p>
            {descNeedsTruncation && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="text-xs text-blue-500 mt-2 hover:underline font-medium"
              >
                {descExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </section>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Features                                                           */}
        {/* ----------------------------------------------------------------- */}
        {hasFeatures && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Features
            </h2>
            <div className="flex flex-wrap gap-2">
              {features
                .filter((f) => f.available === true)
                .map((f) => (
                  <span
                    key={f.label}
                    className="px-3 py-1.5 text-xs rounded-lg bg-white/70 backdrop-blur-sm border border-gray-200 text-gray-700 shadow-sm"
                  >
                    {f.label}
                  </span>
                ))}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Neighborhood Scores (0-10, lower is better)                       */}
        {/* ----------------------------------------------------------------- */}
        {scores.length > 0 && (
          <section className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Neighborhood Scores
            </h2>
            <div className="space-y-3">
              {scores.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{s.label}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {s.value.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreColor(s.value)} transition-all duration-500`}
                      style={{ width: `${Math.min((s.value / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 mt-1">Lower is better</p>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Mini-map                                                           */}
        {/* ----------------------------------------------------------------- */}
        {listing.latitude != null && listing.longitude != null && (
          <ListingMiniMap
            lat={listing.latitude}
            lng={listing.longitude}
            address={fullAddress}
          />
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Amenities (below scores)                                           */}
        {/* ----------------------------------------------------------------- */}
        {amenitiesList.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Amenities
            </h2>
            <div className="flex flex-wrap gap-2">
              {amenitiesList.map((a) => (
                <span
                  key={a}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/70 backdrop-blur-sm border border-gray-200 text-gray-700 shadow-sm"
                >
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

/**
 * Compact stat card used in the quick-stats grid row.
 */
function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl p-3 text-center shadow-sm">
      <p className="text-lg font-bold text-gray-900 leading-tight">
        {String(value)}
      </p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  );
}
