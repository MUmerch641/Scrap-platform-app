import * as Location from 'expo-location';

import { DriverCoordinate } from '../types';

export type DriverLocationPermission = Location.LocationPermissionResponse;
export type DriverLocationSubscription = Location.LocationSubscription;

export function toDriverCoordinate(location: Location.LocationObject): DriverCoordinate {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

export async function areDriverLocationServicesEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

export async function getDriverLocationPermission(): Promise<DriverLocationPermission> {
  return Location.getForegroundPermissionsAsync();
}

export async function requestDriverLocationPermission(): Promise<DriverLocationPermission> {
  return Location.requestForegroundPermissionsAsync();
}

export async function getRecentDriverLocation(): Promise<Location.LocationObject | null> {
  return Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 500 });
}

export async function getCurrentDriverLocation(): Promise<Location.LocationObject> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

export async function watchVisibleDriverLocation(
  onLocation: (location: Location.LocationObject) => void,
): Promise<DriverLocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 25,
      timeInterval: 15_000,
    },
    onLocation,
  );
}

export function getQaPickupCoordinate(): DriverCoordinate | null {
  if (!__DEV__) return null;
  const latitudeValue = process.env.EXPO_PUBLIC_DRIVER_MAP_QA_PICKUP_LATITUDE?.trim();
  const longitudeValue = process.env.EXPO_PUBLIC_DRIVER_MAP_QA_PICKUP_LONGITUDE?.trim();
  if (!latitudeValue || !longitudeValue) return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;
  return { latitude, longitude };
}
