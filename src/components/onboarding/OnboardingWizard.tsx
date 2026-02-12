"use client";

/**
 * OnboardingWizard — Main container for the 3-step onboarding flow.
 *
 * Manages wizard state (current step, collected data), renders a top-level
 * progress indicator, the active step component, and Back / Next navigation.
 * On completion, persists the data to localStorage and redirects to the
 * map page.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import NeighborhoodStep from "./NeighborhoodStep";
import WorkLocationStep from "./WorkLocationStep";
import PreferencesStep from "./PreferencesStep";
import { saveOnboardingData } from "@/lib/onboarding/constants";
import type { WorkLocation, ImportanceRating } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 3;

const STEP_TITLES = ["Neighborhoods", "Work Location", "Preferences"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingWizard() {
  const router = useRouter();

  // Current wizard step (0-indexed internally, displayed 1-indexed)
  const [step, setStep] = useState(0);

  // Step 1 state
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  // Step 2 state
  const [workLocation, setWorkLocation] = useState<WorkLocation | null>(null);
  const [isRemote, setIsRemote] = useState(false);

  // Step 3 state
  const [preferences, setPreferences] = useState<Record<string, ImportanceRating>>({});

  /**
   * Whether the "Next" button should be enabled for the current step.
   */
  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return neighborhoods.length > 0;
      case 1:
        return workLocation !== null || isRemote;
      default:
        return true;
    }
  };

  /**
   * Advances to the next step.
   */
  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  }, [step]);

  /**
   * Goes back to the previous step.
   */
  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
    }
  }, [step]);

  /**
   * Handles work location changes from Step 2.
   *
   * @param location - The geocoded work location or null
   * @param remote - Whether the user selected "work from home"
   */
  const handleWorkLocationChange = useCallback(
    (location: WorkLocation | null, remote: boolean) => {
      setWorkLocation(location);
      setIsRemote(remote);
    },
    []
  );

  /**
   * Saves all onboarding data to localStorage and redirects to the map.
   */
  const handleComplete = useCallback(() => {
    const data = {
      neighborhoods,
      workLocation: isRemote ? null : workLocation,
      preferences,
    };
    console.log("[Onboarding] Complete:", data);
    saveOnboardingData(data);
    router.push("/");
  }, [neighborhoods, workLocation, isRemote, preferences, router]);

  // Progress percentage (step 0 = 0%, step 1 = 33%, step 2 = 66%, done = 100%)
  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen w-full flex items-start justify-center px-4 py-8 bg-linear-to-br from-gray-950 via-gray-900 to-black overflow-y-auto">
      {/* Wizard card */}
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        {/* Header with progress */}
        <div className="px-6 pt-6 pb-4">
          {/* Title */}
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold text-white">
              Find Your Perfect SF Apartment
            </h1>
            <p className="text-xs text-white/50 mt-0.5">
              Quick onboarding for personalized recommendations
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-xs text-white/40">
              {STEP_TITLES[step]}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 pb-4 min-h-[380px] flex flex-col justify-center">
          {step === 0 && (
            <NeighborhoodStep
              selected={neighborhoods}
              onChange={setNeighborhoods}
            />
          )}
          {step === 1 && (
            <WorkLocationStep
              value={workLocation}
              isRemote={isRemote}
              onChange={handleWorkLocationChange}
            />
          )}
          {step === 2 && (
            <PreferencesStep
              answers={preferences}
              onChange={setPreferences}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Navigation footer — hidden on Step 3 (it has its own controls) */}
        {step < 2 && (
          <div className="px-6 pb-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className={`
                px-6 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200 active:scale-95
                border backdrop-blur-sm
                ${
                  canAdvance()
                    ? "bg-white/20 hover:bg-white/30 text-white border-white/30 shadow-lg"
                    : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                }
              `}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
