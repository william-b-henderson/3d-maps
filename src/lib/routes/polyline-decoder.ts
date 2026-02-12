/**
 * Google Encoded Polyline decoder.
 *
 * Implements the standard polyline encoding algorithm used by Google Maps APIs.
 * Converts an encoded polyline string into an array of {lat, lng} coordinates.
 *
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

/**
 * Decodes a Google encoded polyline string into an array of lat/lng coordinates.
 *
 * The algorithm reads 5-bit chunks from ASCII characters, reconstructs signed
 * integers using two's complement, and accumulates deltas to produce absolute
 * lat/lng values (divided by 1e5 for the standard precision).
 *
 * @param encoded - The encoded polyline string from Google APIs
 * @returns Array of {lat, lng} coordinate objects
 */
export function decodePolyline(
  encoded: string
): Array<{ lat: number; lng: number }> {
  const coordinates: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude delta
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Decode longitude delta
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}
