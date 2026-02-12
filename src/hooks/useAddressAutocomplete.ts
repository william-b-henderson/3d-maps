"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ensureGoogleMapsLoaded } from "@/lib/google-maps-loader";

/**
 * A single autocomplete prediction returned by the Places API
 */
export interface AddressPrediction {
  /** The unique place ID from Google */
  placeId: string;
  /** The main text of the prediction (e.g. "123 Main St") */
  mainText: string;
  /** The secondary text (e.g. "San Francisco, CA, USA") */
  secondaryText: string;
  /** The full description string */
  description: string;
}

/**
 * Debounce delay in milliseconds before firing an autocomplete request.
 * Keeps API calls low while the user is still typing.
 */
const DEBOUNCE_MS = 300;

/**
 * Fetches place autocomplete predictions from the Google Maps Places API.
 *
 * @param input - The partial address string the user has typed
 * @returns A promise that resolves to an array of address predictions
 */
async function fetchPredictions(
  input: string
): Promise<AddressPrediction[]> {
  await ensureGoogleMapsLoaded();

  const { AutocompleteService } = (await google.maps.importLibrary(
    "places"
  )) as google.maps.PlacesLibrary;

  const service = new AutocompleteService();

  return new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input,
        types: ["address"],
      },
      (predictions, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          predictions
        ) {
          resolve(
            predictions.map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text,
              description: p.description,
            }))
          );
        } else {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Custom hook that provides typeahead address autocomplete powered by Google
 * Maps Places API.
 *
 * Handles debounced fetching, loading state, and cleanup on unmount.
 *
 * @param query - The current search input value
 * @param enabled - Whether autocomplete should be active (e.g. false when searching)
 * @returns An object containing predictions array and isLoading flag
 */
export function useAddressAutocomplete(query: string, enabled: boolean = true) {
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  /**
   * Clears any in-flight debounce timer to prevent stale updates.
   */
  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Debounced fetch whenever query changes
  useEffect(() => {
    const trimmed = query.trim();

    // Clear predictions if query is too short or disabled
    if (!enabled || trimmed.length < 3) {
      cancelPending();
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    cancelPending();

    timerRef.current = setTimeout(async () => {
      try {
        const results = await fetchPredictions(trimmed);
        if (mountedRef.current) {
          setPredictions(results);
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
        if (mountedRef.current) {
          setPredictions([]);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return cancelPending;
  }, [query, enabled, cancelPending]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Manually clear predictions (e.g. after selecting one)
   */
  const clearPredictions = useCallback(() => {
    cancelPending();
    setPredictions([]);
  }, [cancelPending]);

  return { predictions, isLoading, clearPredictions };
}
