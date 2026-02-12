"use client";

/**
 * PreferencesStep — Step 3 of the onboarding wizard.
 *
 * Shows one lifestyle preference question at a time on a 1-4 importance scale.
 * After the user taps a rating, a brief highlight animation plays (300ms),
 * then the view auto-advances to the next question. A sub-progress bar tracks
 * progress through all 9 questions.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PREFERENCE_QUESTIONS,
  IMPORTANCE_LABELS,
} from "@/lib/onboarding/constants";
import type { ImportanceRating } from "@/lib/onboarding/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PreferencesStepProps {
  /** Current answers keyed by question id. */
  answers: Record<string, ImportanceRating>;
  /** Called whenever an answer changes. */
  onChange: (answers: Record<string, ImportanceRating>) => void;
  /** Called when the user finishes all 9 questions. */
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATINGS: ImportanceRating[] = [1, 2, 3, 4];
const ADVANCE_DELAY_MS = 400;
const TOTAL_QUESTIONS = PREFERENCE_QUESTIONS.length;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PreferencesStep({
  answers,
  onChange,
  onComplete,
}: PreferencesStepProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Start at the first unanswered question, or 0
    const firstUnanswered = PREFERENCE_QUESTIONS.findIndex(
      (q) => !(q.id in answers)
    );
    return firstUnanswered === -1 ? TOTAL_QUESTIONS : firstUnanswered;
  });

  const [selectedRating, setSelectedRating] = useState<ImportanceRating | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const [isVisible, setIsVisible] = useState(true);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether every question has been answered. */
  const allAnswered = currentIndex >= TOTAL_QUESTIONS;

  /** The current question object (may be undefined if allAnswered). */
  const currentQuestion = PREFERENCE_QUESTIONS[currentIndex];

  /** The pre-existing answer for the current question (if revisiting). */
  const existingAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /**
   * Handles the user tapping a rating button.
   * Highlights the selection, saves the answer, then auto-advances after a delay.
   *
   * @param rating - The importance rating (1-4) the user selected
   */
  const handleRate = useCallback(
    (rating: ImportanceRating) => {
      if (isAnimating || !currentQuestion) return;

      setSelectedRating(rating);
      setIsAnimating(true);

      // Save answer immediately
      const updated = { ...answers, [currentQuestion.id]: rating };
      onChange(updated);

      // Cancel any pending advance
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

      // After highlight delay, slide to next question
      advanceTimerRef.current = setTimeout(() => {
        setSlideDirection("left");
        setIsVisible(false);

        // Wait for slide-out, then switch question and slide-in
        setTimeout(() => {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          setSelectedRating(null);
          setIsAnimating(false);
          setIsVisible(true);
        }, 200);
      }, ADVANCE_DELAY_MS);
    },
    [isAnimating, currentQuestion, answers, onChange, currentIndex]
  );

  /**
   * Navigates back to the previous question.
   */
  const handleBack = useCallback(() => {
    if (currentIndex <= 0 || isAnimating) return;

    // Cancel any pending advance
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

    setSlideDirection("right");
    setIsVisible(false);

    setTimeout(() => {
      setCurrentIndex(currentIndex - 1);
      setSelectedRating(null);
      setIsAnimating(false);
      setIsVisible(true);
    }, 200);
  }, [currentIndex, isAnimating]);

  // Progress percentage for the sub-bar
  const progressPercent = Math.round((currentIndex / TOTAL_QUESTIONS) * 100);

  // ---------------------------------------------------------------------------
  // Render: all questions answered — show completion view
  // ---------------------------------------------------------------------------
  if (allAnswered) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="text-3xl mb-3">✅</div>
          <h2 className="text-xl font-semibold text-white mb-1">
            All Set!
          </h2>
          <p className="text-sm text-white/60">
            Your preferences have been recorded
          </p>
        </div>

        {/* Summary chips */}
        <div className="w-full max-w-sm space-y-2">
          {PREFERENCE_QUESTIONS.map((q) => {
            const rating = answers[q.id];
            return (
              <div
                key={q.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                <span className="text-sm text-white/80">
                  {q.icon} {q.label}
                </span>
                <span className="text-xs text-white/50 font-medium">
                  {rating ? IMPORTANCE_LABELS[rating] : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Complete button */}
        <button
          type="button"
          onClick={onComplete}
          className="
            px-8 py-3 rounded-xl text-sm font-semibold
            bg-white/20 hover:bg-white/30 text-white
            border border-white/30 backdrop-blur-sm
            transition-all duration-200 active:scale-95
            shadow-lg
          "
        >
          Complete Onboarding
        </button>

        {/* Back link */}
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: single question view
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white mb-1">
          Your Lifestyle Preferences
        </h2>
        <p className="text-sm text-white/50">
          Question {currentIndex + 1} of {TOTAL_QUESTIONS}
        </p>
      </div>

      {/* Sub-progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/30 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question card with slide animation */}
      <div
        className={`
          flex flex-col items-center gap-5 min-h-[180px] justify-center
          transition-all duration-200 ease-out
          ${
            isVisible
              ? "opacity-100 translate-x-0"
              : slideDirection === "left"
                ? "opacity-0 -translate-x-8"
                : "opacity-0 translate-x-8"
          }
        `}
      >
        {/* Icon */}
        <div className="text-4xl">{currentQuestion.icon}</div>

        {/* Label + question */}
        <div className="text-center max-w-sm px-4">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
            {currentQuestion.label}
          </p>
          <p className="text-base text-white/90 leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>

        {/* 1-4 rating buttons */}
        <div className="flex gap-3">
          {RATINGS.map((rating) => {
            const isSelected =
              selectedRating === rating || existingAnswer === rating;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => handleRate(rating)}
                disabled={isAnimating}
                className={`
                  flex flex-col items-center gap-1.5
                  w-16 sm:w-18 py-3 rounded-xl
                  text-sm font-semibold
                  transition-all duration-200 active:scale-95
                  border backdrop-blur-sm
                  disabled:cursor-default
                  ${
                    isSelected
                      ? "bg-white/25 border-white/40 text-white shadow-[0_4px_16px_rgba(255,255,255,0.1)] scale-105"
                      : "bg-white/8 border-white/15 text-white/60 hover:bg-white/15 hover:border-white/25 hover:text-white/80"
                  }
                `}
              >
                <span className="text-lg">{rating}</span>
              </button>
            );
          })}
        </div>

        {/* Labels under buttons */}
        <div className="flex justify-between w-full max-w-[280px] sm:max-w-[312px] px-1">
          <span className="text-[10px] text-white/30 text-center w-16">
            Not important
          </span>
          <span className="text-[10px] text-white/30 text-center w-16 ml-auto">
            Very important
          </span>
        </div>
      </div>

      {/* Back to previous question */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={handleBack}
          disabled={isAnimating}
          className="text-sm text-white/40 hover:text-white/60 transition-colors disabled:opacity-30"
        >
          ← Previous question
        </button>
      )}
    </div>
  );
}
