"use client";

/**
 * ListingMiniMap — renders a small interactive 2D Google Map with a marker
 * pinpointing the listing's location. Designed for the listing detail page.
 *
 * Reuses the shared `ensureGoogleMapsLoaded()` loader so no duplicate
 * script tags are ever created.
 */

import { useRef, useEffect, useState } from "react";
import { ensureGoogleMapsLoaded } from "@/lib/google-maps-loader";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingMiniMapProps {
  /** Latitude of the listing. */
  lat: number;
  /** Longitude of the listing. */
  lng: number;
  /** Optional address label shown in the marker info window. */
  address?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a compact, non-interactive-looking (but pannable/zoomable) Google
 * Map centred on the given coordinates with a single marker. Gracefully
 * renders nothing while the Maps API is loading.
 */
export default function ListingMiniMap({ lat, lng, address }: ListingMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await ensureGoogleMapsLoaded();
      if (cancelled || !containerRef.current) return;
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    const position = { lat, lng };

    const map = new google.maps.Map(containerRef.current, {
      center: position,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "cooperative",
      clickableIcons: false,
      mapId: "listing-mini-map",
    });

    mapRef.current = map;

    /**
     * Initialises an AdvancedMarkerElement on the map. Uses the `marker`
     * library which is loaded dynamically via `importLibrary`.
     */
    async function addMarker() {
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;

      const marker = new AdvancedMarkerElement({
        map,
        position,
        title: address ?? "Listing location",
      });

      if (address) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<p style="margin:0;font-size:13px;font-weight:500;">${address}</p>`,
        });

        marker.addListener("click", () => {
          infoWindow.open({ anchor: marker, map });
        });
      }
    }

    addMarker();
  }, [ready, lat, lng, address]);

  return (
    <section className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Location
        </h2>
      </div>
      <div
        ref={containerRef}
        className="w-full aspect-video"
        aria-label="Map showing listing location"
      />
    </section>
  );
}
