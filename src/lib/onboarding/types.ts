/**
 * Onboarding type definitions.
 *
 * Shared interfaces for the multi-step onboarding wizard:
 * Step 1 — Neighborhood selection
 * Step 2 — Work location
 * Step 3 — Lifestyle preferences (1-4 importance scale)
 */

// ---------------------------------------------------------------------------
// Preference question
// ---------------------------------------------------------------------------

/** A single lifestyle preference question shown in Step 3. */
export interface PreferenceQuestion {
  /** Unique identifier used as the key in the preferences record. */
  id: string;
  /** Emoji icon displayed above the question. */
  icon: string;
  /** Short category label (e.g. "Fitness & Wellness"). */
  label: string;
  /** Full question text shown to the user. */
  question: string;
}

// ---------------------------------------------------------------------------
// Importance scale
// ---------------------------------------------------------------------------

/** Valid importance ratings on the 1-4 scale. */
export type ImportanceRating = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Onboarding data (persisted)
// ---------------------------------------------------------------------------

/** Work location captured in Step 2. */
export interface WorkLocation {
  address: string;
  lat: number;
  lng: number;
}

/** Complete onboarding payload saved to localStorage. */
export interface OnboardingData {
  /** Selected SF neighborhood names from Step 1. */
  neighborhoods: string[];
  /** Work location from Step 2, or `null` if "work from home". */
  workLocation: WorkLocation | null;
  /** Importance ratings from Step 3, keyed by question id. */
  preferences: Record<string, ImportanceRating>;
}
