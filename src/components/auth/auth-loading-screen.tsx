import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { brandColors, typography } from '@/shared/theme';

/**
 * Brand Lockup Reveal (Startup Animation)
 *
 * Asset Selection:
 *   - Uses `procopper - siteicon.png` for the recycling symbol, which is a 2000x2000 PNG
 *     with 100% transparent background pixels (RGBA 0,0,0,0) around the copper mark.
 *   - Renders clean brand typography (`PROCOPPER` / `RECYCLING`) below the symbol using
 *     the application's loaded Google Fonts (`LeagueSpartan_700Bold` & `Quicksand_600SemiBold`).
 *
 * Sequence:
 *   Phase 1 (0–400ms): Transparent recycling symbol scales smoothly (0.88 → 1.03 → 1.0).
 *   Phase 2 (200–420ms): Brand lockup text fades in (opacity 0 → 1) and slides up (translateY 10 → 0),
 *                        overlapping the end of the symbol settle.
 *
 * Loader:
 *   - ActivityIndicator is hidden on fast launches.
 *   - Only displayed if session restoration takes longer than 700ms.
 *
 * Reduce Motion:
 *   - Immediately renders static brand lockup at full opacity with no scale/translation.
 */

const SPINNER_DELAY_MS = 700;

export function AuthLoadingScreen() {
  const symbolScale = useSharedValue(0.88);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(10);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const spinnerTimer = setTimeout(() => {
      if (isMounted) setShowSpinner(true);
    }, SPINNER_DELAY_MS);

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted) return;
      if (reduceMotion) {
        symbolScale.value = 1;
        wordmarkOpacity.value = 1;
        wordmarkTranslateY.value = 0;
        return;
      }

      // Phase 1: Symbol scale (0.88 -> 1.03 -> 1.0) ~400ms total
      symbolScale.value = withSequence(
        withTiming(1.03, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1.0, {
          duration: 120,
          easing: Easing.inOut(Easing.quad),
        })
      );

      // Phase 2: Wordmark fade-in + slide-up (starts at 200ms, duration 220ms)
      wordmarkOpacity.value = withDelay(
        200,
        withTiming(1, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        })
      );
      wordmarkTranslateY.value = withDelay(
        200,
        withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        })
      );
    });

    return () => {
      isMounted = false;
      clearTimeout(spinnerTimer);
    };
  }, [symbolScale, wordmarkOpacity, wordmarkTranslateY]);

  const symbolStyle = useAnimatedStyle(() => ({
    transform: [{ scale: symbolScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  return (
    <View style={styles.container} accessibilityLabel="Checking account access">
      <StatusBar style="light" />
      <View style={styles.content}>
        {/* Transparent recycling symbol mark */}
        <Reanimated.View style={symbolStyle}>
          <Image
            source={require('@/assets/images/procopper - siteicon.png')}
            style={styles.mark}
            contentFit="contain"
            accessibilityLabel="ProCopper Recycling Symbol"
          />
        </Reanimated.View>

        {/* Brand lockup wordmark */}
        <Reanimated.View style={[styles.wordmarkContainer, wordmarkStyle]}>
          <Text style={styles.brandTitle}>PROCOPPER</Text>
          <Text style={styles.brandSubtitle}>RECYCLING</Text>
        </Reanimated.View>

        {/* Delayed loader */}
        {showSpinner ? (
          <ActivityIndicator
            color={brandColors.lightCopper}
            size="small"
            style={styles.spinner}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.navy,
  },
  // Optical center — slightly above mathematical center
  content: {
    alignItems: 'center',
    marginTop: -30,
  },
  mark: {
    width: 140,
    height: 140,
  },
  wordmarkContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  brandTitle: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 26,
    letterSpacing: 2,
    color: brandColors.offWhite,
  },
  brandSubtitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: 12,
    letterSpacing: 5,
    color: brandColors.lightCopper,
    marginTop: 2,
  },
  spinner: {
    marginTop: 28,
  },
});
