/**
 * Shared Google Maps JavaScript API loader.
 *
 * Ensures the Google Maps script is loaded exactly once, regardless of how
 * many components or hooks request it. Uses a module-level promise singleton
 * so concurrent callers share the same load operation.
 */

let loadPromise: Promise<void> | null = null;

/**
 * Ensures the Google Maps JavaScript API is loaded and ready to use.
 * Safe to call multiple times — only one script tag is ever created.
 *
 * @returns A promise that resolves when `window.google.maps` is available
 */
export function ensureGoogleMapsLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables."
      )
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d,places,geocoding`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps API"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
