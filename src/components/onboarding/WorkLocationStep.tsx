"use client";

/**
 * WorkLocationStep — Step 2 of the onboarding wizard.
 *
 * Captures the user's work address via Google Places autocomplete,
 * or lets them indicate they work from home.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAddressAutocomplete,
  type AddressPrediction,
} from "@/hooks/useAddressAutocomplete";
import type { WorkLocation } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkLocationStepProps {
  /** Current work location value. */
  value: WorkLocation | null;
  /** Whether the user selected "work from home". */
  isRemote: boolean;
  /** Called when a work location is selected. */
  onChange: (location: WorkLocation | null, isRemote: boolean) => void;
}

// ---------------------------------------------------------------------------
// Geocode helper
// ---------------------------------------------------------------------------

/**
 * Geocodes a place ID via the app's server-side API route.
 *
 * @param placeId - Google place ID to geocode
 * @returns Geocoded lat/lng and formatted address, or null on failure
 */
async function geocodePlaceId(
  placeId: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  try {
    const res = await fetch(`/api/geocode?placeId=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      lat: data.lat,
      lng: data.lng,
      formattedAddress: data.formattedAddress,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkLocationStep({
  value,
  isRemote,
  onChange,
}: WorkLocationStepProps) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Guards against re-opening the dropdown after a selection. */
  const hasSelectedRef = useRef(false);

  const { predictions, clearPredictions } = useAddressAutocomplete(
    query,
    isFocused && !isSearching && !isRemote && !hasSelectedRef.current
  );

  // Keep dropdown in sync with predictions
  useEffect(() => {
    if (hasSelectedRef.current) return;
    setIsDropdownOpen(isFocused && predictions.length > 0);
    setHighlightedIndex(-1);
  }, [predictions, isFocused]);

  /**
   * Selects a prediction, geocodes it, and notifies the parent.
   *
   * @param prediction - The selected autocomplete prediction
   */
  const selectPrediction = useCallback(
    async (prediction: AddressPrediction) => {
      // Immediately close dropdown and prevent re-opening
      hasSelectedRef.current = true;
      setQuery(prediction.description);
      setIsDropdownOpen(false);
      clearPredictions();
      setIsSearching(true);
      inputRef.current?.blur();

      const result = await geocodePlaceId(prediction.placeId);
      setIsSearching(false);

      if (result) {
        onChange(
          {
            address: result.formattedAddress,
            lat: result.lat,
            lng: result.lng,
          },
          false
        );
        setQuery(result.formattedAddress);
      }
    },
    [onChange, clearPredictions]
  );

  /**
   * Toggles the "work from home" option.
   */
  const toggleRemote = () => {
    if (isRemote) {
      onChange(null, false);
    } else {
      onChange(null, true);
      setQuery("");
      clearPredictions();
    }
  };

  /**
   * Handles keyboard navigation in the dropdown.
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
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
          selectPrediction(predictions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsDropdownOpen(false);
        clearPredictions();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Heading */}
      <div className="text-center">
        <div className="text-3xl mb-3">🏢</div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Where Do You Work?
        </h2>
        <p className="text-sm text-white/60">
          We&apos;ll use this to estimate your commute time
        </p>
      </div>

      {/* Address input */}
      <div className="w-full max-w-sm" ref={containerRef}>
        <label className="text-xs font-medium text-white/60 uppercase tracking-wide mb-2 block">
          Work Location
        </label>

        <div className="relative">
          <div
            className={`
              relative overflow-hidden rounded-xl
              bg-white/10 backdrop-blur-xl border transition-all duration-300
              ${isFocused ? "border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.2)]" : "border-white/20"}
              ${isRemote ? "opacity-40 pointer-events-none" : ""}
              ${isDropdownOpen ? "rounded-b-none" : ""}
            `}
          >
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 text-white/50"
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

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                hasSelectedRef.current = false;
                setQuery(e.target.value);
                // Clear the saved location when typing a new query
                if (value) onChange(null, false);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a neighborhood, address..."
              disabled={isRemote}
              autoComplete="off"
              className="w-full py-3 pl-10 pr-4 bg-transparent text-white placeholder-white/40 text-sm focus:outline-none disabled:cursor-not-allowed"
            />
          </div>

          {/* Autocomplete dropdown */}
          {isDropdownOpen && (
            <ul
              ref={listRef}
              className="absolute z-50 w-full max-h-48 overflow-y-auto bg-gray-900/95 backdrop-blur-xl border border-t-0 border-white/20 rounded-b-xl shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
            >
              {predictions.map((prediction, index) => (
                <li
                  key={prediction.placeId}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectPrediction(prediction);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`
                    flex items-start gap-2 px-3 py-2.5 cursor-pointer
                    transition-colors duration-100 text-sm
                    ${highlightedIndex === index ? "bg-white/20" : "hover:bg-white/10"}
                    ${index < predictions.length - 1 ? "border-b border-white/10" : ""}
                  `}
                >
                  <svg
                    className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/50"
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
                    <p className="text-white font-medium truncate">
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
        </div>

        {/* Work from home toggle */}
        <button
          type="button"
          onClick={toggleRemote}
          className={`
            mt-3 w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200 active:scale-[0.98]
            border backdrop-blur-sm
            ${
              isRemote
                ? "bg-white/20 border-white/30 text-white"
                : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:text-white/80"
            }
          `}
        >
          <span>🏠</span>
          I work from home
          {isRemote && <span className="ml-1">✓</span>}
        </button>
      </div>

      {/* Info callout */}
      <div className="w-full max-w-sm bg-blue-500/10 backdrop-blur-sm border border-blue-400/20 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-200/80 leading-relaxed">
          <span className="font-semibold text-blue-200">Commute estimate:</span>{" "}
          We&apos;ll factor in transit options and travel times to your selected
          neighborhoods.
        </p>
      </div>
    </div>
  );
}
