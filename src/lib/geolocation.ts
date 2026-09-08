const requestPosition = (options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

export async function getCurrentPositionReliable(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) throw new Error('GEOLOCATION_UNSUPPORTED');
  try {
    return await requestPosition({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
  } catch (error) {
    const geoError = error as GeolocationPositionError;
    if (geoError.code === geoError.PERMISSION_DENIED) throw geoError;
    return requestPosition({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  }
}
