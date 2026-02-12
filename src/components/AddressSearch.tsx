"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAddressAutocomplete,
  AddressPrediction,
} from "@/hooks/useAddressAutocomplete";
import type { GeocodeResponse } from "@/app/api/geocode/route";

/**
 * Building outline data passed through from the Geocoding API.
 * Matches the BuildingOutlineData shape in Map3D.
 */
export interface BuildingOutline {
  rings: Array<Array<{ lat: number; lng: number }>>;
}

/**
 * Building bounding box passed through from the Solar API.
 * Matches the BuildingBoundsData shape in Map3D.
 */
export interface BuildingBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

/**
 * Result from geocoding an address, now includes building data from
 * both the Geocoding API (outline) and Solar API (bounds + height).
 */
export interface GeocodedLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
  /** Building footprint polygon from Geocoding API, if available */
  buildingOutline: BuildingOutline | null;
  /** Building bounding box from the Solar API, if available */
  buildingBounds: BuildingBounds | null;
  /** Building rooftop height in meters above sea level from the Solar API, if available */
  buildingHeightMeters: number | null;
  /** Terrain elevation in meters above sea level from the Elevation API, if available */
  elevationMeters: number | null;
}

/**
 * Props for the AddressSearch component
 */
interface AddressSearchProps {
  /** Callback when an address is successfully geocoded */
  onLocationFound: (location: GeocodedLocation) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the search is disabled */
  disabled?: boolean;
}

/**
 * Geocodes an address via our server-side API route which calls the Google
 * Geocoding REST API with BUILDING_AND_ENTRANCES to fetch building outlines.
 *
 * @param params - Either { address } or { placeId } to geocode
 * @returns Promise with the geocoded location (including outline) or null
 */
async function geocodeViaApi(
  params: { address: string } | { placeId: string }
): Promise<GeocodedLocation | null> {
  try {
    const searchParams = new URLSearchParams();

    if ("placeId" in params) {
      searchParams.set("placeId", params.placeId);
    } else {
      searchParams.set("address", params.address);
    }

    const res = await fetch(`/api/geocode?${searchParams.toString()}`);

    if (!res.ok) return null;

    const data: GeocodeResponse = await res.json();

    return {
      lat: data.lat,
      lng: data.lng,
      formattedAddress: data.formattedAddress,
      buildingOutline: data.buildingOutline,
      buildingBounds: data.buildingBounds,
      buildingHeightMeters: data.buildingHeightMeters,
      elevationMeters: data.elevationMeters,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * AddressSearch Component - A glass-effect floating search input with typeahead
 *
 * Uses Google Maps Places Autocomplete for real-time suggestions and our
 * server-side Geocoding API route (with BUILDING_AND_ENTRANCES) to convert
 * selected addresses to coordinates with building outline polygons.
 * Features keyboard navigation, glass morphism design, loading & error states.
 */
export default function AddressSearch({
  onLocationFound,
  placeholder = "Search for an address...",
  disabled = false,
}: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { predictions, clearPredictions } = useAddressAutocomplete(
    query,
    isFocused && !isSearching
  );

  // Keep dropdown open whenever there are predictions and input is focused
  useEffect(() => {
    setIsDropdownOpen(isFocused && predictions.length > 0);
    setHighlightedIndex(-1);
  }, [predictions, isFocused]);

  /**
   * Selects a prediction, geocodes it via our API route (which fetches
   * building outlines), and notifies the parent.
   *
   * @param prediction - The selected autocomplete prediction
   */
  const selectPrediction = useCallback(
    async (prediction: AddressPrediction) => {
      setQuery(prediction.description);
      setIsDropdownOpen(false);
      clearPredictions();
      setIsSearching(true);
      setError(null);

      try {
        const location = await geocodeViaApi({
          placeId: prediction.placeId,
        });

        if (location) {
          onLocationFound(location);
          setQuery("");
        } else {
          setError("Could not locate this address. Try another.");
        }
      } catch {
        setError("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [onLocationFound, clearPredictions]
  );

  /**
   * Handles free-form search submission (when user presses Enter without
   * selecting a prediction, or clicks Go).
   */
  const handleSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // If a dropdown item is highlighted, select it instead
    if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
      selectPrediction(predictions[highlightedIndex]);
      return;
    }

    setIsDropdownOpen(false);
    clearPredictions();
    setIsSearching(true);
    setError(null);

    try {
      const location = await geocodeViaApi({ address: trimmedQuery });

      if (location) {
        onLocationFound(location);
        setQuery("");
      } else {
        setError("Address not found. Please try a different search.");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [
    query,
    highlightedIndex,
    predictions,
    selectPrediction,
    onLocationFound,
    clearPredictions,
  ]);

  /**
   * Handles form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  /**
   * Handles keyboard navigation inside the dropdown (ArrowUp, ArrowDown, Escape)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : predictions.length - 1
        );
        break;
      case "Escape":
        setIsDropdownOpen(false);
        clearPredictions();
        break;
    }
  };

  /**
   * Scroll the highlighted item into view when navigating with keyboard
   */
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  /**
   * Close dropdown when clicking outside the component
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Global keyboard shortcuts (Cmd/Ctrl+K to focus, Escape to blur)
   */
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (
        e.key === "Escape" &&
        document.activeElement === inputRef.current &&
        !isDropdownOpen
      ) {
        inputRef.current?.blur();
        setError(null);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isDropdownOpen]);

  return (
    <div className="w-full max-w-md" ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative">
        {/* Glass effect container */}
        <div
          className={`
            relative overflow-hidden rounded-2xl
            bg-white/10 backdrop-blur-xl
            border transition-all duration-300
            shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            ${
              isFocused
                ? "border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                : "border-white/20"
            }
            ${error ? "border-red-400/50" : ""}
            ${isDropdownOpen ? "rounded-b-none" : ""}
          `}
        >
          {/* Search icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-5 h-5 text-white/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Small delay so click on dropdown item registers first
              setTimeout(() => setIsFocused(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSearching}
            autoComplete="off"
            role="combobox"
            aria-expanded={isDropdownOpen}
            aria-controls="address-listbox"
            aria-activedescendant={
              highlightedIndex >= 0
                ? `address-option-${highlightedIndex}`
                : undefined
            }
            className={`
              w-full py-4 pl-12 pr-24
              bg-transparent text-white placeholder-white/50
              text-base font-medium
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />

          {/* Keyboard shortcut hint / Search button */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {!query && !isFocused && (
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-white/40 bg-white/10 rounded-md border border-white/10">
                <span className="text-sm">⌘</span>K
              </kbd>
            )}
            {query && (
              <button
                type="submit"
                disabled={isSearching || disabled}
                className={`
                  px-4 py-2 rounded-xl text-sm font-semibold
                  bg-white/20 hover:bg-white/30 text-white
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  active:scale-95
                `}
              >
                {isSearching ? "..." : "Go"}
              </button>
            )}
          </div>
        </div>

        {/* Autocomplete Dropdown */}
        {isDropdownOpen && (
          <ul
            id="address-listbox"
            ref={listRef}
            role="listbox"
            className={`
              absolute z-50 w-full max-h-64 overflow-y-auto
              bg-white/10 backdrop-blur-xl
              border border-t-0 border-white/20
              rounded-b-2xl
              shadow-[0_16px_48px_rgba(0,0,0,0.2)]
            `}
          >
            {predictions.map((prediction, index) => (
              <li
                key={prediction.placeId}
                id={`address-option-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPrediction(prediction);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  flex items-start gap-3 px-4 py-3 cursor-pointer
                  transition-colors duration-100
                  ${
                    highlightedIndex === index
                      ? "bg-white/20"
                      : "hover:bg-white/10"
                  }
                  ${index < predictions.length - 1 ? "border-b border-white/10" : ""}
                `}
              >
                {/* Pin icon */}
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0 text-white/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {prediction.mainText}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {prediction.secondaryText}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-2 px-4">
            <p className="text-sm text-red-300 bg-red-500/20 backdrop-blur-sm rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
