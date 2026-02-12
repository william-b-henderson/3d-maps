/**
 * Onboarding constants — neighborhoods, preference questions, labels,
 * and localStorage helpers.
 *
 * Neighborhood list is derived from the cluster data in
 * `src/lib/heatmap/sampleData.ts`.
 */

import type {
  PreferenceQuestion,
  ImportanceRating,
  OnboardingData,
} from "./types";

// ---------------------------------------------------------------------------
// SF Neighborhoods (Step 1)
// ---------------------------------------------------------------------------

/** Selectable San Francisco neighborhoods for Step 1 (all 37 residential areas). */
export const SF_NEIGHBORHOODS: string[] = [
  // Northern waterfront
  "Marina",
  "Russian Hill",
  "North Beach",
  "Financial District",
  "Chinatown",
  "Nob Hill",
  "Pacific Heights",
  "Presidio Heights",
  "Seacliff",
  // Central
  "SoMa",
  "Mission",
  "Mission Bay",
  "Castro",
  "Haight-Ashbury",
  "Hayes Valley",
  "Western Addition",
  "Japantown",
  "Lone Mountain/USF",
  "Tenderloin",
  // Mid-city
  "Noe Valley",
  "Inner Sunset",
  "Inner Richmond",
  "Outer Sunset",
  "Outer Richmond",
  "Twin Peaks",
  "West of Twin Peaks",
  "Glen Park",
  // Southern / Eastern
  "Potrero Hill",
  "Dogpatch",
  "Bernal Heights",
  "Bayview",
  "Portola",
  "Excelsior",
  "Outer Mission",
  "Oceanview/Merced/Ingleside",
  "Visitacion Valley",
  "Lakeshore",
  "Treasure Island",
];

// ---------------------------------------------------------------------------
// Preference questions (Step 3)
// ---------------------------------------------------------------------------

/** The 9 lifestyle preference questions, shown one at a time. */
export const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  {
    id: "fitness",
    icon: "💪",
    label: "Fitness & Wellness",
    question: "How important is access to gyms, yoga studios, and fitness facilities?",
  },
  {
    id: "outdoors",
    icon: "🌿",
    label: "Outdoors & Space",
    question: "How important are parks, green spaces, and waterfront access?",
  },
  {
    id: "daily_rituals",
    icon: "☕",
    label: "Daily Rituals",
    question: "How important are nearby coffee shops, brunch spots, and casual dining?",
  },
  {
    id: "food_social",
    icon: "🍽️",
    label: "Food & Social Life",
    question: "How important is a vibrant food and social scene?",
  },
  {
    id: "nightlife",
    icon: "🌙",
    label: "Nightlife Energy",
    question: "How important is access to bars and nightlife?",
  },
  {
    id: "convenience",
    icon: "🛒",
    label: "Everyday Convenience",
    question: "How important are everyday essentials within walking distance?",
  },
  {
    id: "walkability",
    icon: "🚶",
    label: "Walkability & Transit",
    question: "How important is walkability and public transit access?",
  },
  {
    id: "safety",
    icon: "🛡️",
    label: "Safety",
    question: "How important is neighborhood safety to you?",
  },
  {
    id: "noise",
    icon: "🔊",
    label: "Street Activity & Noise",
    question: "Do you want to live on a quiet street?",
  },
];

// ---------------------------------------------------------------------------
// Importance labels
// ---------------------------------------------------------------------------

/** Human-readable labels for each point on the 1-4 scale. */
export const IMPORTANCE_LABELS: Record<ImportanceRating, string> = {
  1: "Not important at all",
  2: "Not that interested",
  3: "Interested",
  4: "Very important",
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "onboarding_data";

/**
 * Persists the completed onboarding data to localStorage.
 *
 * @param data - The full onboarding payload to save
 */
export function saveOnboardingData(data: OnboardingData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[Onboarding] Failed to save data:", err);
  }
}

/**
 * Loads previously saved onboarding data from localStorage.
 *
 * @returns The saved onboarding data, or `null` if none exists
 */
export function loadOnboardingData(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingData;
  } catch (err) {
    console.error("[Onboarding] Failed to load data:", err);
    return null;
  }
}

/**
 * Checks whether onboarding has been completed (data exists in localStorage).
 *
 * @returns `true` if onboarding data is present
 */
export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
