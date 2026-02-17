/**
 * Shared formatting helpers used across the app.
 *
 * Extracted into a standalone module so both server/client components
 * and canvas-rendering utilities can import without circular deps.
 */

/**
 * Formats a numeric price into a compact human-readable string.
 *
 * @param price - The listing price in dollars, or null.
 * @returns A formatted string like "$3.2M", "$850K", "$3,200", or "N/A".
 */
export function formatPrice(price: number | null): string {
  if (!price) return "N/A";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

/**
 * Formats a numeric price into a full (non-abbreviated) dollar string.
 *
 * @param price - The listing price in dollars, or null.
 * @returns A formatted string like "$3,200" or "N/A".
 */
export function formatPriceFull(price: number | null): string {
  if (price == null) return "N/A";
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
