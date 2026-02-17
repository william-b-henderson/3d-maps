import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scores } from "@/lib/schema";
import { isNotNull } from "drizzle-orm";
import type { ScoredIntersection } from "@/lib/heatmap/types";

// ---------------------------------------------------------------------------
// Quantile normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of raw score values to the 0-1 range using quantile
 * (rank-based) scaling.  Each value is mapped to its percentile rank,
 * guaranteeing a uniform distribution of intensities.
 *
 * @param values - Raw score numbers
 * @returns Array of numbers in [0, 1] preserving the original order
 */
function normalizeQuantile(values: number[]): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [1];

  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const result = new Array<number>(values.length);
  const maxRank = values.length - 1;
  for (let rank = 0; rank < indexed.length; rank++) {
    result[indexed[rank].i] = rank / maxRank;
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/heatmap/intersections
// ---------------------------------------------------------------------------

/**
 * Returns intersection points with normalised crime scores.
 *
 * Queries the `scores` table for all rows with a non-null `crimeScore`,
 * normalises via quantile ranking, and returns `ScoredIntersection[]`.
 *
 * No density scaling is applied — each intersection is rendered as a
 * discrete dot rather than fed into the KDE engine.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        latitude: scores.latitude,
        longitude: scores.longitude,
        crimeScore: scores.crimeScore,
      })
      .from(scores)
      .where(isNotNull(scores.crimeScore));

    const rawScores = rows.map((r) => r.crimeScore!);
    const normalised = normalizeQuantile(rawScores);

    const result: ScoredIntersection[] = rows.map((row, i) => ({
      lat: row.latitude,
      lng: row.longitude,
      score: normalised[i],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/heatmap/intersections] Error fetching intersections:", error);
    return NextResponse.json(
      { error: "Failed to fetch intersection heatmap data" },
      { status: 500 },
    );
  }
}
