import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { traffic, scores } from "@/lib/schema";
import { sql } from "drizzle-orm";
import type { StreetSegment } from "@/lib/heatmap/types";

// ---------------------------------------------------------------------------
// GeoJSON coordinate parsing
// ---------------------------------------------------------------------------

interface GeoJSONGeometry {
  type: string;
  coordinates: number[][] | number[][][];
}

/**
 * Extracts lat/lng coordinate arrays from a GeoJSON geometry object.
 * Handles both LineString and MultiLineString types.
 *
 * GeoJSON coordinates are [longitude, latitude] — this function
 * flips them to { lat, lng } for the client.
 *
 * @param geom - Parsed GeoJSON geometry object
 * @returns Array of coordinate line arrays (one per line segment)
 */
function extractCoordinateLines(
  geom: GeoJSONGeometry
): Array<Array<{ lat: number; lng: number }>> {
  if (geom.type === "LineString") {
    const coords = geom.coordinates as number[][];
    return [coords.map(([lng, lat]) => ({ lat, lng }))];
  }

  if (geom.type === "MultiLineString") {
    const lines = geom.coordinates as number[][][];
    return lines.map((line) => line.map(([lng, lat]) => ({ lat, lng })));
  }

  return [];
}

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
// GET /api/heatmap/streets
// ---------------------------------------------------------------------------

/**
 * Returns street segments with normalised traffic scores.
 *
 * Queries the `traffic` table for street geometries, left-joins with the
 * `scores` table on CNN to obtain a traffic score per segment.  Segments
 * without a matched score receive a mid-range fallback (0.5 pre-normalisation).
 *
 * Response: `StreetSegment[]`
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        geometry: traffic.geometry,
        trafficScore: scores.trafficScore,
      })
      .from(traffic)
      .leftJoin(scores, sql`${traffic.cnn}::text = ${scores.cnn}`);

    // Build segments, expanding MultiLineStrings into individual lines
    const DEFAULT_SCORE = 0.5;
    const segments: { coords: Array<{ lat: number; lng: number }>; rawScore: number }[] = [];

    for (const row of rows) {
      if (!row.geometry) continue;

      const geom = row.geometry as GeoJSONGeometry;
      const lines = extractCoordinateLines(geom);
      if (lines.length === 0) continue;

      const rawScore = row.trafficScore ?? DEFAULT_SCORE;

      for (const coords of lines) {
        if (coords.length < 2) continue;
        segments.push({ coords, rawScore });
      }
    }

    // Normalise scores across all segments
    const rawScores = segments.map((s) => s.rawScore);
    const normalised = normalizeQuantile(rawScores);

    const result: StreetSegment[] = segments.map((seg, i) => ({
      coordinates: seg.coords,
      score: normalised[i],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/heatmap/streets] Error fetching streets:", error);
    return NextResponse.json(
      { error: "Failed to fetch street heatmap data" },
      { status: 500 },
    );
  }
}
