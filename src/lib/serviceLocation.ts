export interface ServiceCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * The WISAL service model stores the human-readable location in the existing
 * services.address column (exposed to the UI as service.location). Normalize
 * its common separators so province/address segments render once, in order.
 */
export function getServiceLocationParts(location?: string): string[] {
  if (!location?.trim()) return [];

  const seen = new Set<string>();
  return location
    .split(/\s*(?:•|·|—|–|-|،|,)\s*/)
    .map(part => part.trim())
    .filter(part => {
      if (!part) return false;
      const key = part.replace(/\s+/g, ' ').toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function toCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

/** Read the existing coordinate columns without ever falling back to 0,0. */
export function getServiceCoordinates(source: {
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
}): ServiceCoordinates | undefined {
  const latitude = toCoordinate(source.latitude, -90, 90) ?? toCoordinate(source.lat, -90, 90);
  const longitude = toCoordinate(source.longitude, -180, 180) ?? toCoordinate(source.lng, -180, 180);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude };
}

export function getGoogleMapsUrl(coordinates: ServiceCoordinates): string {
  const query = encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getWazeUrl(coordinates: ServiceCoordinates): string {
  const point = encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`);
  return `https://waze.com/ul?ll=${point}&navigate=yes`;
}
