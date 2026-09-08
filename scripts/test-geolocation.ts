import { getCurrentPositionReliable } from '../src/lib/geolocation';

const makePosition = (latitude: number, longitude: number) => ({
  coords: { latitude, longitude },
}) as GeolocationPosition;

async function testHighAccuracySuccess() {
  const calls: PositionOptions[] = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition(success: PositionCallback, _error: PositionErrorCallback, options: PositionOptions) {
          calls.push(options);
          success(makePosition(33.3152, 44.3661));
        },
      },
    },
  });
  const result = await getCurrentPositionReliable();
  if (result.coords.latitude !== 33.3152 || calls.length !== 1 || calls[0].enableHighAccuracy !== true) {
    throw new Error('high-accuracy geolocation path failed');
  }
}

async function testLowAccuracyFallback() {
  const calls: PositionOptions[] = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition(success: PositionCallback, error: PositionErrorCallback, options: PositionOptions) {
          calls.push(options);
          if (calls.length === 1) error({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
          else success(makePosition(33.3152, 44.3661));
        },
      },
    },
  });
  await getCurrentPositionReliable();
  if (calls.length !== 2 || calls[1].enableHighAccuracy !== false) {
    throw new Error('low-accuracy fallback path failed');
  }
}

async function testPermissionDenialStops() {
  let calls = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition(_success: PositionCallback, error: PositionErrorCallback) {
          calls += 1;
          error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
        },
      },
    },
  });
  try {
    await getCurrentPositionReliable();
    throw new Error('permission denial should reject');
  } catch (error) {
    if ((error as GeolocationPositionError).code !== 1 || calls !== 1) throw error;
  }
}

await testHighAccuracySuccess();
await testLowAccuracyFallback();
await testPermissionDenialStops();
console.log('PASS: geolocation high accuracy, fallback, and permission handling');
