"use client";

/**
 * PhotoLightbox — full-screen image viewer overlay with navigation.
 *
 * Supports left/right arrow buttons, keyboard navigation (ArrowLeft,
 * ArrowRight, Escape), and touch swipe on mobile.
 */

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhotoLightboxProps {
  /** Array of image URLs to display. */
  images: string[];
  /** Index of the currently displayed image. */
  currentIndex: number;
  /** Callback to change the displayed image. */
  onIndexChange: (index: number) => void;
  /** Callback to close the lightbox. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhotoLightbox({
  images,
  currentIndex,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const touchStartRef = useRef<number | null>(null);
  const total = images.length;

  /**
   * Navigate to the previous image, wrapping around to the end.
   */
  const goBack = useCallback(() => {
    onIndexChange((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onIndexChange]);

  /**
   * Navigate to the next image, wrapping around to the start.
   */
  const goForward = useCallback(() => {
    onIndexChange((currentIndex + 1) % total);
  }, [currentIndex, total, onIndexChange]);

  /**
   * Handle keyboard navigation: left/right arrows and Escape.
   */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goBack, goForward]);

  /**
   * Record the starting X position of a touch.
   */
  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0].clientX;
  }

  /**
   * Detect a swipe gesture (>50px horizontal) and navigate accordingly.
   */
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartRef.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goBack();
      else goForward();
    }
    touchStartRef.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close lightbox"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-sm text-white/70 tabular-nums">
        {currentIndex + 1} / {total}
      </div>

      {/* Previous arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={goBack}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Previous image"
        >
          <svg
            className="w-5 h-5 text-white"
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
      )}

      {/* Main image */}
      <div className="relative w-full h-full flex items-center justify-center px-14 py-16">
        <Image
          src={images[currentIndex]}
          alt={`Photo ${currentIndex + 1} of ${total}`}
          fill
          className="object-contain"
          unoptimized
          priority
        />
      </div>

      {/* Next arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={goForward}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Next image"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
