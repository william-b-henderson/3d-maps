"use client";

/**
 * NeighborhoodStep — Step 1 of the onboarding wizard.
 *
 * Displays an interactive SVG map of SF neighborhoods above a grid of
 * selectable pill/chip buttons. The user can click polygons on the map
 * or tap chips to toggle selection. Hovering a polygon shows its name
 * in a floating label above the map.
 */

import { useState } from "react";
import { SF_NEIGHBORHOODS } from "@/lib/onboarding/constants";
import SFNeighborhoodMap from "./SFNeighborhoodMap";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NeighborhoodStepProps {
  /** Currently selected neighborhood names. */
  selected: string[];
  /** Called when the selection changes. */
  onChange: (neighborhoods: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NeighborhoodStep({
  selected,
  onChange,
}: NeighborhoodStepProps) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  /**
   * Toggles a neighborhood in/out of the selection list.
   *
   * @param name - The neighborhood name to toggle
   */
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Heading */}
      <div className="text-center">
        <div className="text-3xl mb-2">📍</div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Select Your Ideal Neighborhoods
        </h2>
        <p className="text-sm text-white/60">
          Click on the map or buttons to select neighborhoods
        </p>
      </div>

      {/* Hover label */}
      <div className="h-7 flex items-center justify-center">
        {hoveredName ? (
          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-medium text-white backdrop-blur-sm">
            {hoveredName}
          </span>
        ) : (
          <span className="text-xs text-white/30">
            Hover over the map to see neighborhood names
          </span>
        )}
      </div>

      {/* Interactive SVG Map */}
      <SFNeighborhoodMap
        selected={selected}
        onToggle={toggle}
        onHover={setHoveredName}
        hoveredName={hoveredName}
      />

      {/* Neighborhood chips grid */}
      <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
        {SF_NEIGHBORHOODS.map((name) => {
          const isSelected = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              onMouseEnter={() => setHoveredName(name)}
              onMouseLeave={() => setHoveredName(null)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 active:scale-95
                border backdrop-blur-sm
                ${
                  isSelected
                    ? "bg-white/25 border-white/40 text-white shadow-lg"
                    : "bg-white/8 border-white/15 text-white/70 hover:bg-white/15 hover:border-white/25"
                }
              `}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Selection counter */}
      <div className="text-sm text-white/50">
        {selected.length === 0 ? (
          "No neighborhoods selected"
        ) : (
          <span className="text-white/70">
            <span className="text-white font-medium">{selected.length}</span>{" "}
            neighborhood{selected.length !== 1 ? "s" : ""} selected
          </span>
        )}
      </div>
    </div>
  );
}
