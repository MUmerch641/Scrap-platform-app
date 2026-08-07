import { LeagueSpartan_600SemiBold, LeagueSpartan_700Bold } from '@expo-google-fonts/league-spartan';
import {
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { UserRoleProvider } from '@/app/context/UserRoleContext';
import { AuthGate } from '@/components/auth/auth-gate';
import { brandColors, semanticColors } from '@/shared/theme';

void SplashScreen.preventAutoHideAsync();

const FONT_LOAD_TIMEOUT_MS = 5000;

// Match AuthLoadingScreen — only show the spinner if still loading after this threshold
const SPINNER_DELAY_MS = 700;

export default function Layout() {
  const isDark = useColorScheme() === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];
  const [fontLoadExpired, setFontLoadExpired] = React.useState(false);
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [fontsLoaded, fontError] = useFonts({
    LeagueSpartan_600SemiBold,
    LeagueSpartan_700Bold,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  React.useEffect(() => {
    let isMounted = true;
    const timeout = setTimeout(() => {
      if (isMounted) setFontLoadExpired(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  // Delayed spinner — mirrors AuthLoadingScreen so the font-loading phase
  // and auth phase look identical and never flash a spinner on fast launches
  React.useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setShowSpinner(true);
    }, SPINNER_DELAY_MS);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const appIsReady = fontsLoaded || Boolean(fontError) || fontLoadExpired;

  React.useEffect(() => {
    if (appIsReady) void SplashScreen.hideAsync();
  }, [appIsReady]);

  // Shown while fonts are loading.
  // Must visually match the native splash and AuthLoadingScreen exactly:
  // same navy background, same mark at the same size and position, no entrance
  // animation (the native splash already showed the logo). The logo reveal
  // animation lives in AuthLoadingScreen which runs after this phase.
  if (!appIsReady) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <View style={styles.loadingContent}>
          <Image
            source={require('@/assets/images/procopper - siteicon.png')}
            style={styles.loadingMark}
            contentFit="contain"
            accessibilityLabel="ProCopper Recycling"
          />
          {showSpinner ? (
            <ActivityIndicator
              color={brandColors.lightCopper}
              size="small"
              style={styles.loadingSpinner}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <UserRoleProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NavigationBar style="dark" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </AuthGate>
      </ThemeProvider>
    </UserRoleProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.navy,
  },
  // Optical center — slightly above mathematical center
  loadingContent: {
    alignItems: 'center',
    marginTop: -30,
  },
  loadingMark: {
    width: 140,
    height: 140,
  },
  loadingSpinner: {
    marginTop: 28,
  },
});
