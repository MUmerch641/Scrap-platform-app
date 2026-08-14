import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';

import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

import {
  areDriverLocationServicesEnabled,
  DriverLocationSubscription,
  getCurrentDriverLocation,
  getDriverLocationPermission,
  getRecentDriverLocation,
  requestDriverLocationPermission,
  toDriverCoordinate,
  watchVisibleDriverLocation,
} from '../services/driver-location-service';
import {
  DriverRoute,
  DriverRouteFailure,
  fetchDriverJobRoute,
} from '../services/driver-route-service';
import { DriverCoordinate } from '../types';

type LocationState =
  | 'checking'
  | 'ready'
  | 'denied'
  | 'services-disabled'
  | 'unavailable';

interface DriverPickupMapProps {
  pickupJobId: string;
  pickupAddress: string;
  pickupCoordinate: DriverCoordinate | null;
  isQaCoordinate?: boolean;
}

const SINGLE_POINT_DELTA = 0.018;
const CLOSE_POINT_THRESHOLD = 0.003;
const OVERVIEW_PADDING = { top: 72, right: 52, bottom: 72, left: 52 };
const ROUTE_REFRESH_DISTANCE_METERS = 250;
const ROUTE_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;
const ROUTE_FOREGROUND_REFRESH_MS = 10 * 60 * 1000;

type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; route: DriverRoute; refreshing: boolean }
  | { status: 'error'; reason: DriverRouteFailure };

function regionForPoint(coordinate: DriverCoordinate): Region {
  return {
    ...coordinate,
    latitudeDelta: SINGLE_POINT_DELTA,
    longitudeDelta: SINGLE_POINT_DELTA,
  };
}

export function DriverPickupMap({
  pickupJobId,
  pickupAddress,
  pickupCoordinate,
  isQaCoordinate = false,
}: DriverPickupMapProps) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const mapRef = useRef<MapView>(null);
  const watcherRef = useRef<DriverLocationSubscription | null>(null);
  const locationSessionRef = useRef(0);
  const focusedRef = useRef(false);
  const driverCoordinateRef = useRef<DriverCoordinate | null>(null);
  const didInitialFitRef = useRef(false);
  const didInitialRouteFitRef = useRef(false);
  const routeRequestRef = useRef(0);
  const routeInFlightRef = useRef<number | null>(null);
  const componentMountedRef = useRef(true);
  const routeRefreshOnForegroundRef = useRef(false);
  const lastRouteRequestRef = useRef<{ coordinate: DriverCoordinate; time: number } | null>(null);
  const [driverCoordinate, setDriverCoordinate] = useState<DriverCoordinate | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>({ status: 'idle' });

  useEffect(() => () => {
    componentMountedRef.current = false;
    routeRequestRef.current += 1;
    routeInFlightRef.current = null;
  }, []);

  const setDriverLocation = useCallback((coordinate: DriverCoordinate) => {
    driverCoordinateRef.current = coordinate;
    setDriverCoordinate(coordinate);
    setLocationState('ready');
  }, []);

  const stopLocationWatcher = useCallback(() => {
    locationSessionRef.current += 1;
    watcherRef.current?.remove();
    watcherRef.current = null;
  }, []);

  const beginLocationSession = useCallback(async (requestAfterDenial = false) => {
    if (!focusedRef.current || AppState.currentState !== 'active') return;
    stopLocationWatcher();
    const session = ++locationSessionRef.current;
    if (!driverCoordinateRef.current) setLocationState('checking');

    try {
      const servicesEnabled = await areDriverLocationServicesEnabled();
      if (session !== locationSessionRef.current) return;
      if (!servicesEnabled) {
        setLocationState('services-disabled');
        return;
      }

      let permission = await getDriverLocationPermission();
      if (session !== locationSessionRef.current) return;
      if (
        permission.status === 'undetermined' ||
        (requestAfterDenial && permission.status === 'denied' && permission.canAskAgain)
      ) {
        permission = await requestDriverLocationPermission();
      }
      if (session !== locationSessionRef.current) return;
      setCanAskAgain(permission.canAskAgain);
      if (!permission.granted) {
        setLocationState('denied');
        return;
      }

      const recentLocation = await getRecentDriverLocation();
      if (session !== locationSessionRef.current) return;
      if (recentLocation) setDriverLocation(toDriverCoordinate(recentLocation));

      try {
        const currentLocation = await getCurrentDriverLocation();
        if (session === locationSessionRef.current) {
          setDriverLocation(toDriverCoordinate(currentLocation));
        }
      } catch {
        if (session === locationSessionRef.current && !driverCoordinateRef.current) {
          setLocationState('unavailable');
        }
      }

      if (session !== locationSessionRef.current) return;
      try {
        watcherRef.current = await watchVisibleDriverLocation((location) => {
          if (session === locationSessionRef.current) {
            setDriverLocation(toDriverCoordinate(location));
          }
        });
      } catch {
        if (session === locationSessionRef.current && !driverCoordinateRef.current) {
          setLocationState('unavailable');
        }
      }
    } catch {
      if (session === locationSessionRef.current && !driverCoordinateRef.current) {
        setLocationState('unavailable');
      }
    }
  }, [setDriverLocation, stopLocationWatcher]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (AppState.currentState === 'active') void beginLocationSession();
      const appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          const lastRouteRequest = lastRouteRequestRef.current;
          routeRefreshOnForegroundRef.current = Boolean(
            lastRouteRequest && Date.now() - lastRouteRequest.time >= ROUTE_FOREGROUND_REFRESH_MS,
          );
          void beginLocationSession();
        }
        else stopLocationWatcher();
      });

      return () => {
        focusedRef.current = false;
        appStateSubscription.remove();
        stopLocationWatcher();
      };
    }, [beginLocationSession, stopLocationWatcher]),
  );

  useEffect(() => {
    didInitialFitRef.current = false;
    didInitialRouteFitRef.current = false;
    lastRouteRequestRef.current = null;
    routeRefreshOnForegroundRef.current = false;
    routeRequestRef.current += 1;
    routeInFlightRef.current = null;
  }, [pickupAddress, pickupJobId]);

  const requestRoute = useCallback(async (force = false) => {
    if (!driverCoordinate || isQaCoordinate || routeInFlightRef.current !== null) return;
    const previous = lastRouteRequestRef.current;
    const now = Date.now();
    if (!force && previous) {
      const elapsed = now - previous.time;
      const moved = distanceMeters(previous.coordinate, driverCoordinate);
      if (elapsed < ROUTE_REFRESH_MIN_INTERVAL_MS || moved < ROUTE_REFRESH_DISTANCE_METERS) return;
    }

    const requestId = ++routeRequestRef.current;
    routeInFlightRef.current = requestId;
    lastRouteRequestRef.current = { coordinate: driverCoordinate, time: now };
    setRouteState((current) => current.status === 'ready'
      ? { ...current, refreshing: true }
      : { status: 'loading' });
    const result = await fetchDriverJobRoute(pickupJobId, driverCoordinate);
    if (routeInFlightRef.current === requestId) routeInFlightRef.current = null;
    if (requestId !== routeRequestRef.current || !componentMountedRef.current) return;
    setRouteState(result.success
      ? { status: 'ready', route: result.route, refreshing: false }
      : { status: 'error', reason: result.reason });
  }, [driverCoordinate, isQaCoordinate, pickupJobId]);

  useEffect(() => {
    if (!driverCoordinate || isQaCoordinate) return;
    const force = routeRefreshOnForegroundRef.current;
    routeRefreshOnForegroundRef.current = false;
    void requestRoute(force);
  }, [driverCoordinate, isQaCoordinate, requestRoute]);

  const displayedPickupCoordinate = routeState.status === 'ready'
    ? routeState.route.destination
    : pickupCoordinate;

  const retryRoute = useCallback(() => {
    routeInFlightRef.current = null;
    void requestRoute(true);
  }, [requestRoute]);

  const showOverview = useCallback((animated = true) => {
    if (!mapReady || !driverCoordinate || !displayedPickupCoordinate) return;
    if (routeState.status === 'ready' && routeState.route.coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(routeState.route.coordinates, {
        edgePadding: OVERVIEW_PADDING,
        animated,
      });
      return;
    }
    const latitudeDifference = Math.abs(driverCoordinate.latitude - displayedPickupCoordinate.latitude);
    const longitudeDifference = Math.abs(driverCoordinate.longitude - displayedPickupCoordinate.longitude);

    if (
      latitudeDifference < CLOSE_POINT_THRESHOLD &&
      longitudeDifference < CLOSE_POINT_THRESHOLD
    ) {
      mapRef.current?.animateToRegion({
        latitude: (driverCoordinate.latitude + displayedPickupCoordinate.latitude) / 2,
        longitude: (driverCoordinate.longitude + displayedPickupCoordinate.longitude) / 2,
        latitudeDelta: SINGLE_POINT_DELTA,
        longitudeDelta: SINGLE_POINT_DELTA,
      }, animated ? 450 : 0);
      return;
    }

    mapRef.current?.fitToCoordinates(
      [driverCoordinate, displayedPickupCoordinate],
      { edgePadding: OVERVIEW_PADDING, animated },
    );
  }, [displayedPickupCoordinate, driverCoordinate, mapReady, routeState]);

  useEffect(() => {
    if (!mapReady || !driverCoordinate || !pickupCoordinate || didInitialFitRef.current) return;
    didInitialFitRef.current = true;
    showOverview(true);
  }, [driverCoordinate, mapReady, pickupCoordinate, showOverview]);

  useEffect(() => {
    if (!mapReady || routeState.status !== 'ready' || didInitialRouteFitRef.current) return;
    didInitialRouteFitRef.current = true;
    mapRef.current?.fitToCoordinates(routeState.route.coordinates, {
      edgePadding: OVERVIEW_PADDING,
      animated: true,
    });
  }, [mapReady, routeState]);

  const centerDriver = useCallback(() => {
    if (!driverCoordinate) return;
    mapRef.current?.animateToRegion(regionForPoint(driverCoordinate), 400);
  }, [driverCoordinate]);

  const initialRegion = useMemo(() => {
    const point = displayedPickupCoordinate ?? driverCoordinate;
    return point ? regionForPoint(point) : null;
  }, [displayedPickupCoordinate, driverCoordinate]);

  const locationMessage = getLocationMessage(locationState);
  const action = getLocationAction(locationState, canAskAgain);
  const routeMessage = getRouteMessage(routeState, isQaCoordinate);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <View style={[styles.headingIcon, { backgroundColor: colors.background }]}>
          <Ionicons name="navigate-circle-outline" size={23} color={colors.accent} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Pickup map</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Location and traffic-aware route</Text>
        </View>
        {isQaCoordinate ? (
          <View style={[styles.qaBadge, { backgroundColor: colors.surfaceSelected }]}>
            <Text style={[styles.qaBadgeText, { color: colors.onPrimary }]}>QA PIN</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.addressBar, { backgroundColor: colors.background }]}>
        <Ionicons name="location" size={17} color={colors.accent} />
        <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>{pickupAddress}</Text>
      </View>

      <View style={[styles.mapFrame, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {initialRegion ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            loadingEnabled
            loadingBackgroundColor={colors.background}
            loadingIndicatorColor={colors.accent}
            mapType="standard"
            toolbarEnabled={false}
            showsCompass={false}
            showsIndoorLevelPicker={false}
            showsIndoors={false}
            showsMyLocationButton={false}
            showsPointsOfInterests={false}
            showsScale={false}
            showsTraffic={false}
            rotateEnabled={false}
            pitchEnabled={false}
            onMapReady={() => setMapReady(true)}
          >
            {routeState.status === 'ready' ? (
              <>
                <Polyline
                  coordinates={routeState.route.coordinates}
                  strokeColor={brandColors.navy}
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                />
                <Polyline
                  coordinates={routeState.route.coordinates}
                  strokeColor={brandColors.copper}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            ) : null}
            {driverCoordinate ? (
              <Marker coordinate={driverCoordinate} title="Your location" anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.driverMarkerOuter}>
                  <View style={styles.driverMarkerInner} />
                </View>
              </Marker>
            ) : null}
            {displayedPickupCoordinate ? (
              <Marker
                coordinate={displayedPickupCoordinate}
                title={isQaCoordinate ? 'QA pickup location' : 'Pickup location'}
                description={pickupAddress}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.pickupMarker}>
                  <View style={styles.pickupMarkerHead}>
                    <Ionicons name="cube-outline" size={17} color={brandColors.white} />
                  </View>
                  <View style={styles.pickupMarkerTail} />
                </View>
              </Marker>
            ) : null}
          </MapView>
        ) : (
          <MapState
            title={locationMessage.title}
            message={locationMessage.message}
            loading={locationState === 'checking'}
            actionLabel={action}
            onAction={() => {
              if (action === 'Open Settings') void Linking.openSettings();
              else void beginLocationSession(true);
            }}
            colors={colors}
          />
        )}

        {initialRegion && locationState !== 'ready' ? (
          <StatusBanner
            title={locationMessage.title}
            message={locationMessage.message}
            actionLabel={action}
            onAction={() => {
              if (action === 'Open Settings') void Linking.openSettings();
              else void beginLocationSession(true);
            }}
            colors={colors}
          />
        ) : null}
      </View>

      {routeState.status === 'ready' ? (
        <View style={[styles.routeSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <RouteMetric icon="time-outline" value={formatDuration(routeState.route.durationSeconds)} label="traffic-aware" colors={colors} />
          <View style={[styles.routeDivider, { backgroundColor: colors.border }]} />
          <RouteMetric icon="speedometer-outline" value={formatDistance(routeState.route.distanceMeters)} label="driving distance" colors={colors} />
          {routeState.refreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Pressable
              onPress={() => void requestRoute(true)}
              accessibilityRole="button"
              accessibilityLabel="Refresh pickup route"
              hitSlop={8}
              style={styles.routeRefresh}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>
      ) : routeMessage ? (
        <View style={[styles.routeStatus, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {routeState.status === 'loading' ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="map-outline" size={18} color={colors.accent} />}
          <View style={styles.routeStatusCopy}>
            <Text style={[styles.routeStatusTitle, { color: colors.text }]}>{routeMessage.title}</Text>
            <Text style={[styles.routeStatusMessage, { color: colors.textMuted }]}>{routeMessage.message}</Text>
          </View>
          {routeMessage.retry ? (
            <Pressable
              onPress={retryRoute}
              accessibilityRole="button"
              accessibilityLabel="Retry pickup route"
              hitSlop={8}
              style={({ pressed }) => [
                styles.routeRetry,
                { backgroundColor: pressed ? colors.surfaceSelected : colors.surface },
              ]}
            >
              <Text style={[styles.bannerAction, { color: colors.primary }]}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.controls}>
        <MapControl
          icon="navigate-outline"
          label="My Location"
          disabled={!driverCoordinate}
          onPress={centerDriver}
          colors={colors}
        />
        <MapControl
          icon="scan-outline"
          label="Overview"
          disabled={!driverCoordinate || !displayedPickupCoordinate}
          onPress={() => showOverview(true)}
          colors={colors}
        />
      </View>
    </View>
  );
}

function distanceMeters(from: DriverCoordinate, to: DriverCoordinate): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getRouteMessage(
  state: RouteState,
  isQaCoordinate: boolean,
): { title: string; message: string; retry: boolean } | null {
  if (isQaCoordinate) {
    return {
      title: 'QA pin only',
      message: 'Save verified coordinates on the pickup request to calculate a production route.',
      retry: false,
    };
  }
  if (state.status === 'idle' || state.status === 'ready') return null;
  if (state.status === 'loading') {
    return {
      title: 'Calculating driving route',
      message: 'Checking current traffic and the best available pickup route.',
      retry: false,
    };
  }
  if (state.reason === 'assignment-unavailable') {
    return {
      title: 'Route access ended',
      message: 'This assignment is no longer available. Refresh Jobs for the latest assignment.',
      retry: false,
    };
  }
  if (state.reason === 'pickup-unavailable') {
    return {
      title: 'Pickup route unavailable',
      message: 'Verified pickup coordinates are not available for this job yet.',
      retry: false,
    };
  }
  if (state.reason === 'no-route') {
    return {
      title: 'No driving route found',
      message: 'A road route could not be calculated from your current position.',
      retry: true,
    };
  }
  return {
    title: 'Route temporarily unavailable',
    message: 'The pickup map still works. Try the traffic-aware route again shortly.',
    retry: true,
  };
}

function RouteMetric({
  icon,
  value,
  label,
  colors,
}: {
  icon: 'time-outline' | 'speedometer-outline';
  value: string;
  label: string;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  return (
    <View style={styles.routeMetric}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <View>
        <Text style={[styles.routeMetricValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.routeMetricLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

function getLocationMessage(state: LocationState): { title: string; message: string } {
  switch (state) {
    case 'denied':
      return {
        title: 'Location access is off',
        message: 'Enable location to show your position on the pickup map. The rest of this job remains available.',
      };
    case 'services-disabled':
      return {
        title: 'Location services are off',
        message: 'Turn on device location services to show your current position.',
      };
    case 'unavailable':
      return {
        title: 'Location temporarily unavailable',
        message: 'Your position could not be confirmed. Try again when you have a clearer GPS signal.',
      };
    default:
      return {
        title: 'Preparing pickup map',
        message: 'Checking foreground location access and finding your position.',
      };
  }
}

function getLocationAction(state: LocationState, canAskAgain: boolean): string | undefined {
  if (state === 'services-disabled') return 'Open Settings';
  if (state === 'denied') return canAskAgain ? 'Try Again' : 'Open Settings';
  if (state === 'unavailable') return 'Retry';
  return undefined;
}

function MapState({
  title,
  message,
  loading,
  actionLabel,
  onAction,
  colors,
}: {
  title: string;
  message: string;
  loading: boolean;
  actionLabel?: string;
  onAction: () => void;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  return (
    <View style={styles.mapState}>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={[styles.stateIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="location-outline" size={22} color={colors.accent} />
        </View>
      )}
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={[styles.stateAction, { borderColor: colors.primary }]}
        >
          <Text style={[styles.stateActionText, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusBanner({
  title,
  message,
  actionLabel,
  onAction,
  colors,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  return (
    <View style={[styles.banner, { backgroundColor: colors.modalSurface, borderColor: colors.border }]}>
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.bannerMessage, { color: colors.textMuted }]} numberOfLines={2}>{message}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.bannerAction, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MapControl({
  icon,
  label,
  disabled,
  onPress,
  colors,
}: {
  icon: 'navigate-outline' | 'scan-outline';
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.control,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceSelected : colors.background,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.controlText, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: { flex: 1, gap: 2 },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  qaBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  qaBadgeText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  addressBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  addressText: {
    flex: 1,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  mapFrame: {
    height: 300,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  mapState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
  stateMessage: {
    maxWidth: 290,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  stateAction: {
    minHeight: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  stateActionText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  banner: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  bannerMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  bannerAction: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.fontSize.xs,
  },
  controls: { flexDirection: 'row', gap: spacing.sm },
  routeSummary: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  routeMetric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeMetricValue: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.fontSize.sm,
  },
  routeMetricLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  routeDivider: { width: 1, height: 32 },
  routeRefresh: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeRetry: {
    minWidth: 54,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
  },
  routeStatus: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  routeStatusCopy: { flex: 1, gap: 2 },
  routeStatusTitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  routeStatusMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  control: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
  },
  controlText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  driverMarkerOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 65, 98, 0.22)',
    borderWidth: 2,
    borderColor: brandColors.white,
  },
  driverMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: brandColors.navy,
    borderWidth: 2,
    borderColor: brandColors.white,
  },
  pickupMarker: { width: 38, height: 46, alignItems: 'center' },
  pickupMarkerHead: {
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.copper,
    borderWidth: 2,
    borderColor: brandColors.white,
  },
  pickupMarkerTail: {
    width: 13,
    height: 13,
    marginTop: -8,
    transform: [{ rotate: '45deg' }],
    backgroundColor: brandColors.copper,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: brandColors.white,
  },
});
