import { useUserRole } from '@/context/UserRoleContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { DriverJobRealtimeSubscription, subscribeToDriverJobRealtime } from '@/features/driver/services/driver-job-realtime';
import { ROLES } from '@/shared/roles';
import { semanticColors, typography } from '@/shared/theme';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React, { useEffect, useRef } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

export default function DriverLayout() {
  const { session, role, isInitialLoading } = useUserRole();
  const { isOnline } = useNetworkStatus();
  const colorScheme = useColorScheme();
  const realtimeRef = useRef<DriverJobRealtimeSubscription | null>(null);
  const hasObservedNetworkRef = useRef(false);
  const driverSessionId = role === ROLES.DRIVER ? session?.user.id : undefined;
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    if (!driverSessionId) return;
    const subscription = subscribeToDriverJobRealtime();
    realtimeRef.current = subscription;

    return () => {
      if (realtimeRef.current === subscription) realtimeRef.current = null;
      subscription.unsubscribe();
    };
  }, [driverSessionId]);

  useEffect(() => {
    if (!driverSessionId) {
      hasObservedNetworkRef.current = false;
      return;
    }
    if (!hasObservedNetworkRef.current) {
      hasObservedNetworkRef.current = true;
      return;
    }
    if (isOnline) realtimeRef.current?.scheduleRefresh();
  }, [driverSessionId, isOnline]);

  useEffect(() => {
    if (!driverSessionId) return;
    let previousAppState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const returnedToForeground = previousAppState !== 'active' && nextAppState === 'active';
      previousAppState = nextAppState;
      if (returnedToForeground) realtimeRef.current?.scheduleRefresh();
    });

    return () => appStateSubscription.remove();
  }, [driverSessionId]);

  if (isInitialLoading) return <AuthLoadingScreen />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role !== ROLES.DRIVER) {
    return <Redirect href={role === ROLES.SALES_REP ? '/(sales-rep)/(home)' : '/(auth)/sign-in'} />;
  }

  return (
    <NativeTabs
      // Only force a remount on Android (where style props require a new native view).
      // On iOS the native UITabBarController adapts to system appearance automatically;
      // remounting here would destroy tab state and flash the screen.
      key={Platform.OS === 'android' ? (colorScheme ?? 'light') : undefined}
      backgroundColor={Platform.OS === 'ios' ? undefined : colors.background}
      tintColor={colors.accent}
      iconColor={{
        default: colors.textMuted,
        selected: colors.accent
      }}
      indicatorColor={Platform.OS === 'android' ? colors.background : undefined}
      rippleColor={Platform.OS === 'android' ? 'transparent' : undefined}
      labelStyle={
        Platform.OS === 'ios'
          ? {
              default: { color: colors.textMuted, fontFamily: typography.fontFamily.bodyMedium },
              selected: { color: colors.accent, fontFamily: typography.fontFamily.bodySemibold },
            }
          : { fontFamily: typography.fontFamily.bodyMedium }
      }
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="briefcase" md="work" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="active-job">
        <NativeTabs.Trigger.Label>Active</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location" md="place" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
