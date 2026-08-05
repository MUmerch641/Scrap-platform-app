import React from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { UserRoleProvider } from '@/app/context/UserRoleContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const screenOptions = React.useMemo(() => ({
    headerShown: false,
    contentStyle: { backgroundColor: isDark ? '#09090b' : '#ffffff' }
  }), [isDark]);

  return (
    <UserRoleProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <Stack screenOptions={screenOptions} />
      </ThemeProvider>
    </UserRoleProvider>
  );
}

