"use client";

/**
 * NeighborhoodPanel — floating glass-style panel for managing which
 * neighborhood outlines are displayed on the 3D map.
 *
 * Features:
 *   - Collapsible panel with a toggle button
 *   - Search input that filters all 37 SF neighborhoods
 *   - Dropdown with checkboxes to toggle neighborhoods on/off
 *   - Scrollable list of currently active neighborhoods with remove buttons
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { getAllNeighborhoodNames } from "@/lib/neighborhoods/boundaries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NeighborhoodPanelProps {
  /** Neighborhoods currently shown on the map. */
  activeNeighborhoods: string[];
  /** Called to toggle a neighborhood on or off. */
  onToggle: (name: string) => void;
  /** Called when the user hovers over a neighborhood (name) or stops hovering (null). */
  onHover: (name: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NeighborhoodPanel({
  activeNeighborhoods,
  onToggle,
  onHover,
}: NeighborhoodPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const allNames = useMemo(() => getAllNeighborhoodNames(), []);

  /**
   * Filters the full neighborhood list based on the search query.
   * Returns all neighborhoods if query is empty (only when dropdown is open).
   */
  const filteredNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allNames;
    return allNames.filter((n) => n.toLowerCase().includes(q));
  }, [searchQuery, allNames]);

  /**
   * Close the dropdown when clicking outside the panel.
   */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Handles toggling a neighborhood from the dropdown.
   */
  const handleToggle = useCallback(
    (name: string) => {
      onToggle(name);
    },
    [onToggle]
  );

  /**
   * Opens the dropdown when the search input is focused.
   */
  const handleSearchFocus = useCallback(() => {
    setIsDropdownOpen(true);
  }, []);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="
          flex items-center gap-2 px-3 py-2
          bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          text-sm font-medium text-white/90
          hover:bg-white/20 hover:border-white/30
          active:scale-95 transition-all duration-200
        "
        title="Show neighborhood panel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Neighborhoods
        {activeNeighborhoods.length > 0 && (
          <span className="bg-white/20 text-white/90 text-xs px-1.5 py-0.5 rounded-full">
            {activeNeighborhoods.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-64"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Neighborhoods
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="text-white/40 hover:text-white/70 transition-colors p-0.5"
          title="Collapse panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 pb-2 relative">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleSearchFocus}
            placeholder="Search neighborhoods..."
            className="
              w-full pl-8 pr-3 py-1.5 text-xs text-white
              bg-white/8 border border-white/15 rounded-lg
              placeholder:text-white/30
              focus:outline-none focus:border-white/30 focus:bg-white/12
              transition-all duration-200
            "
          />
        </div>

        {/* Dropdown */}
        {isDropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-h-48 overflow-y-auto">
            {filteredNames.length === 0 ? (
              <div className="px-3 py-2 text-xs text-white/40">No neighborhoods found</div>
            ) : (
              filteredNames.map((name) => {
                const isActive = activeNeighborhoods.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleToggle(name)}
                    onMouseEnter={() => onHover(name)}
                    onMouseLeave={() => onHover(null)}
                    className="
                      w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs
                      hover:bg-white/10 transition-colors duration-150
                    "
                  >
                    {/* Checkbox */}
                    <span
                      className={`
                        shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-150
                        ${isActive
                          ? "bg-blue-500/80 border-blue-400/80"
                          : "bg-white/8 border-white/20"
                        }
                      `}
                    >
                      {isActive && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={isActive ? "text-white" : "text-white/70"}>
                      {name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/10" />

      {/* Active neighborhoods list */}
      <div className="px-3 py-2 max-h-52 overflow-y-auto">
        {activeNeighborhoods.length === 0 ? (
          <p className="text-xs text-white/30 py-2 text-center">
            No neighborhoods selected
          </p>
        ) : (
          <div className="space-y-0.5">
            {activeNeighborhoods.map((name) => (
              <div
                key={name}
                onMouseEnter={() => onHover(name)}
                onMouseLeave={() => onHover(null)}
                className="
                  flex items-center justify-between px-2 py-1.5 rounded-lg
                  hover:bg-white/8 transition-colors duration-150 group
                "
              >
                <span className="text-xs text-white/80">{name}</span>
                <button
                  type="button"
                  onClick={() => onToggle(name)}
                  className="
                    text-white/20 hover:text-white/60
                    opacity-0 group-hover:opacity-100
                    transition-all duration-150 p-0.5
                  "
                  title={`Remove ${name}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {activeNeighborhoods.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <p className="text-xs text-white/40">
            <span className="text-white/60 font-medium">{activeNeighborhoods.length}</span> neighborhood{activeNeighborhoods.length !== 1 ? "s" : ""} shown
          </p>
        </div>
      )}
    </div>
  );
}
