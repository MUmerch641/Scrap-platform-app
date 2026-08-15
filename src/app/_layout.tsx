import { LeagueSpartan_600SemiBold, LeagueSpartan_700Bold } from '@expo-google-fonts/league-spartan';
import {
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';

import { UserRoleProvider } from '@/context/UserRoleContext';
import { PushNotificationManager } from '@/components/notifications/push-notification-manager';
import { AppDialogProvider } from '@/context/AppDialogContext';
import { NetworkStatusProvider } from '@/context/NetworkStatusContext';
import { AuthGate } from '@/components/auth/auth-gate';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { IOSFeedbackToast } from '@/components/ui/ios-feedback-toast';
import { semanticColors } from '@/shared/theme';
import '@/services/notification-service';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

const FONT_LOAD_TIMEOUT_MS = 5000;

export default function Layout() {
  const isDark = useColorScheme() === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];
  const [fontLoadExpired, setFontLoadExpired] = React.useState(false);
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

  const appIsReady = fontsLoaded || Boolean(fontError) || fontLoadExpired;

  React.useEffect(() => {
    if (appIsReady) void SplashScreen.hideAsync();
  }, [appIsReady]);

  // The native splash remains visible until the first styled React frame is ready.
  if (!appIsReady) return null;

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
        <PushNotificationManager />
        <AppDialogProvider>
          <NetworkStatusProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <NavigationBar style="dark" />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
            </AuthGate>
            <OfflineBanner />
            <IOSFeedbackToast />
          </NetworkStatusProvider>
        </AppDialogProvider>
      </ThemeProvider>
    </UserRoleProvider>
  );
}
