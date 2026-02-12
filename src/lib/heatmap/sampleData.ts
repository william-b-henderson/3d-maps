/**
 * Sample heatmap datasets for testing.
 *
 * Generates realistic fake data by placing Gaussian clusters at real
 * San Francisco neighbourhoods.  Each cluster produces a set of jittered
 * points so the KDE engine creates convincing smooth heat blobs.
 *
 * To add a new sample dataset, follow the same pattern:
 *   1. Define neighbourhood centres with intensity weights.
 *   2. Call `generateClusteredPoints()` with your centres.
 *   3. Export the generator function.
 */

import type { HeatmapPoint } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded pseudo-random (mulberry32) for deterministic output across renders. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Neighbourhood cluster definition.
 */
interface Cluster {
  /** Centre latitude */
  lat: number;
  /** Centre longitude */
  lng: number;
  /** Base intensity for points in this cluster (0-1) */
  intensity: number;
  /** Spread radius in degrees (~0.005 ≈ 500 m) */
  spread: number;
  /** Number of jittered points to emit */
  count: number;
}

/**
 * Generates a set of randomly jittered data points from a list of clusters.
 *
 * @param clusters - Array of cluster definitions
 * @param seed     - Random seed for reproducibility
 * @returns Array of `HeatmapPoint`s
 */
function generateClusteredPoints(
  clusters: Cluster[],
  seed: number
): HeatmapPoint[] {
  const rng = mulberry32(seed);
  const points: HeatmapPoint[] = [];

  for (const c of clusters) {
    for (let i = 0; i < c.count; i++) {
      // Box-Muller transform for gaussian jitter
      const u1 = rng();
      const u2 = rng();
      const z0 = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
      const z1 = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.sin(2 * Math.PI * u2);

      points.push({
        lat: c.lat + z0 * c.spread,
        lng: c.lng + z1 * c.spread,
        // Vary intensity slightly around the cluster baseline
        intensity: Math.max(0, Math.min(1, c.intensity + (rng() - 0.5) * 0.2)),
      });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Walkability dataset
// ---------------------------------------------------------------------------

/**
 * Fake "Walkability Score" heatmap for San Francisco.
 *
 * High-intensity areas: Downtown/FiDi, Mission, North Beach, Hayes Valley,
 * Castro, Chinatown.
 * Medium: Marina, Noe Valley, Inner Sunset, Inner Richmond, SOMA.
 * Low: Outer Sunset, Outer Richmond, Bayview, Excelsior, Treasure Island.
 *
 * @returns ~450 weighted data points
 */
export function generateWalkabilityData(): HeatmapPoint[] {
  const clusters: Cluster[] = [
    // ------ High walkability ------
    { lat: 37.7942, lng: -122.3990, intensity: 0.95, spread: 0.004, count: 35 }, // Downtown / FiDi
    { lat: 37.7599, lng: -122.4148, intensity: 0.90, spread: 0.005, count: 35 }, // Mission District
    { lat: 37.8060, lng: -122.4103, intensity: 0.88, spread: 0.003, count: 25 }, // North Beach
    { lat: 37.7762, lng: -122.4223, intensity: 0.87, spread: 0.003, count: 25 }, // Hayes Valley
    { lat: 37.7609, lng: -122.4350, intensity: 0.86, spread: 0.003, count: 25 }, // Castro
    { lat: 37.7941, lng: -122.4078, intensity: 0.85, spread: 0.003, count: 20 }, // Chinatown
    { lat: 37.7860, lng: -122.4098, intensity: 0.88, spread: 0.003, count: 20 }, // Union Square / Tenderloin edge

    // ------ Medium walkability ------
    { lat: 37.8015, lng: -122.4368, intensity: 0.65, spread: 0.004, count: 20 }, // Marina
    { lat: 37.7502, lng: -122.4337, intensity: 0.62, spread: 0.004, count: 20 }, // Noe Valley
    { lat: 37.7637, lng: -122.4611, intensity: 0.55, spread: 0.005, count: 20 }, // Inner Sunset
    { lat: 37.7807, lng: -122.4597, intensity: 0.55, spread: 0.005, count: 20 }, // Inner Richmond
    { lat: 37.7785, lng: -122.3978, intensity: 0.60, spread: 0.005, count: 25 }, // SOMA
    { lat: 37.7700, lng: -122.4471, intensity: 0.58, spread: 0.004, count: 20 }, // Cole Valley / Haight
    { lat: 37.7880, lng: -122.4225, intensity: 0.65, spread: 0.003, count: 15 }, // Nob Hill
    { lat: 37.7913, lng: -122.4225, intensity: 0.62, spread: 0.003, count: 15 }, // Russian Hill
    { lat: 37.8030, lng: -122.4180, intensity: 0.60, spread: 0.003, count: 15 }, // Fisherman's Wharf

    // ------ Low walkability ------
    { lat: 37.7550, lng: -122.4950, intensity: 0.30, spread: 0.008, count: 20 }, // Outer Sunset
    { lat: 37.7800, lng: -122.4920, intensity: 0.30, spread: 0.008, count: 20 }, // Outer Richmond
    { lat: 37.7270, lng: -122.3920, intensity: 0.25, spread: 0.006, count: 15 }, // Bayview
    { lat: 37.7230, lng: -122.4310, intensity: 0.28, spread: 0.006, count: 15 }, // Excelsior
    { lat: 37.7150, lng: -122.4420, intensity: 0.20, spread: 0.005, count: 10 }, // Crocker-Amazon
    { lat: 37.7480, lng: -122.3850, intensity: 0.35, spread: 0.005, count: 15 }, // Potrero Hill
    { lat: 37.7370, lng: -122.4050, intensity: 0.30, spread: 0.005, count: 15 }, // Bernal Heights
    { lat: 37.7650, lng: -122.3850, intensity: 0.40, spread: 0.004, count: 15 }, // Dogpatch
  ];

  return generateClusteredPoints(clusters, 42);
}

// ---------------------------------------------------------------------------
// Crime dataset (sample)
// ---------------------------------------------------------------------------

/**
 * Fake "Crime Density" heatmap for San Francisco.
 *
 * Clusters crime-heavy areas more intensely: Tenderloin, SOMA, parts of
 * the Mission, Bayview.
 *
 * @returns ~350 weighted data points
 */
export function generateCrimeData(): HeatmapPoint[] {
  const clusters: Cluster[] = [
    // ------ High crime ------
    { lat: 37.7838, lng: -122.4128, intensity: 0.95, spread: 0.004, count: 40 }, // Tenderloin
    { lat: 37.7785, lng: -122.3978, intensity: 0.80, spread: 0.005, count: 30 }, // SOMA
    { lat: 37.7530, lng: -122.4180, intensity: 0.70, spread: 0.005, count: 25 }, // Mission (16th St area)
    { lat: 37.7270, lng: -122.3920, intensity: 0.65, spread: 0.005, count: 20 }, // Bayview

    // ------ Medium crime ------
    { lat: 37.7942, lng: -122.3990, intensity: 0.50, spread: 0.004, count: 20 }, // Downtown
    { lat: 37.7700, lng: -122.4471, intensity: 0.40, spread: 0.005, count: 15 }, // Haight
    { lat: 37.7650, lng: -122.4200, intensity: 0.45, spread: 0.004, count: 15 }, // Lower Haight / Duboce
    { lat: 37.7480, lng: -122.3850, intensity: 0.38, spread: 0.004, count: 15 }, // Potrero Hill
    { lat: 37.7370, lng: -122.4050, intensity: 0.35, spread: 0.004, count: 15 }, // Bernal Heights

    // ------ Low crime ------
    { lat: 37.8015, lng: -122.4368, intensity: 0.15, spread: 0.004, count: 10 }, // Marina
    { lat: 37.7550, lng: -122.4950, intensity: 0.12, spread: 0.006, count: 15 }, // Outer Sunset
    { lat: 37.7800, lng: -122.4920, intensity: 0.12, spread: 0.006, count: 15 }, // Outer Richmond
    { lat: 37.7502, lng: -122.4337, intensity: 0.18, spread: 0.004, count: 10 }, // Noe Valley
    { lat: 37.7609, lng: -122.4350, intensity: 0.20, spread: 0.003, count: 10 }, // Castro
    { lat: 37.8060, lng: -122.4103, intensity: 0.22, spread: 0.003, count: 10 }, // North Beach
  ];

  return generateClusteredPoints(clusters, 123);
}
