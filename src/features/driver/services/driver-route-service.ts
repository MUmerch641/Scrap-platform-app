import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

import { DriverCoordinate } from '../types';

export type DriverRouteFailure =
  | 'assignment-unavailable'
  | 'pickup-unavailable'
  | 'no-route'
  | 'unavailable';

export interface DriverRoute {
  coordinates: DriverCoordinate[];
  destination: DriverCoordinate;
  distanceMeters: number;
  durationSeconds: number;
  generatedAt: string;
}

export type DriverRouteResult =
  | { success: true; route: DriverRoute }
  | { success: false; reason: DriverRouteFailure };

interface RawDriverRoute {
  encodedPolyline?: unknown;
  distanceMeters?: unknown;
  durationSeconds?: unknown;
  destination?: unknown;
  generatedAt?: unknown;
  code?: unknown;
}

function isCoordinate(value: unknown): value is DriverCoordinate {
  if (!value || typeof value !== 'object') return false;
  const coordinate = value as Partial<DriverCoordinate>;
  return typeof coordinate.latitude === 'number'
    && Number.isFinite(coordinate.latitude)
    && coordinate.latitude >= -90
    && coordinate.latitude <= 90
    && typeof coordinate.longitude === 'number'
    && Number.isFinite(coordinate.longitude)
    && coordinate.longitude >= -180
    && coordinate.longitude <= 180;
}

function mapFailure(code: unknown): DriverRouteFailure {
  if (code === 'assignment_unavailable' || code === 'driver_unavailable') {
    return 'assignment-unavailable';
  }
  if (code === 'pickup_coordinates_unavailable') return 'pickup-unavailable';
  if (code === 'no_route') return 'no-route';
  return 'unavailable';
}

async function readFunctionErrorCode(error: unknown): Promise<unknown> {
  if (!error || typeof error !== 'object') return undefined;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return undefined;
  try {
    const payload = await context.clone().json() as { code?: unknown };
    return payload.code;
  } catch {
    return undefined;
  }
}

export function decodeGooglePolyline(encoded: string): DriverCoordinate[] {
  const coordinates: DriverCoordinate[] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;

  while (index < encoded.length) {
    const latitudeResult = decodePolylineValue(encoded, index);
    if (!latitudeResult) return [];
    index = latitudeResult.nextIndex;
    latitude += latitudeResult.delta;

    const longitudeResult = decodePolylineValue(encoded, index);
    if (!longitudeResult) return [];
    index = longitudeResult.nextIndex;
    longitude += longitudeResult.delta;

    const coordinate = { latitude: latitude / 1e5, longitude: longitude / 1e5 };
    if (!isCoordinate(coordinate)) return [];
    coordinates.push(coordinate);
  }

  return coordinates;
}

function decodePolylineValue(
  encoded: string,
  startIndex: number,
): { delta: number; nextIndex: number } | null {
  let result = 0;
  let shift = 0;
  let index = startIndex;

  while (index < encoded.length) {
    const value = encoded.charCodeAt(index) - 63;
    index += 1;
    if (value < 0 || value > 63 || shift > 30) return null;
    result |= (value & 0x1f) << shift;
    if (value < 0x20) {
      return {
        delta: (result & 1) ? ~(result >> 1) : result >> 1,
        nextIndex: index,
      };
    }
    shift += 5;
  }

  return null;
}

export async function fetchDriverJobRoute(
  pickupJobId: string,
  origin: DriverCoordinate,
): Promise<DriverRouteResult> {
  if (supabaseConfigurationError || !pickupJobId || !isCoordinate(origin)) {
    return { success: false, reason: 'unavailable' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const { data, error } = await supabase.functions.invoke<RawDriverRoute>('driver-job-route', {
      body: { pickupJobId, origin },
      signal: controller.signal,
    });
    if (error) {
      const reason = mapFailure(await readFunctionErrorCode(error));
      if (__DEV__) console.warn('[driver-route-service] route request failed', { reason });
      return { success: false, reason };
    }

    const coordinates = typeof data?.encodedPolyline === 'string'
      ? decodeGooglePolyline(data.encodedPolyline)
      : [];
    if (
      coordinates.length < 2
      || typeof data?.distanceMeters !== 'number'
      || !Number.isFinite(data.distanceMeters)
      || typeof data?.durationSeconds !== 'number'
      || !Number.isFinite(data.durationSeconds)
      || !isCoordinate(data.destination)
      || typeof data.generatedAt !== 'string'
    ) {
      if (__DEV__) console.warn('[driver-route-service] route response was incomplete');
      return { success: false, reason: 'no-route' };
    }

    return {
      success: true,
      route: {
        coordinates,
        destination: data.destination,
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
        generatedAt: data.generatedAt,
      },
    };
  } catch {
    if (__DEV__) console.warn('[driver-route-service] route request timed out or could not connect');
    return { success: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
