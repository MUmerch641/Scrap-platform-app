import React, { useEffect } from 'react';
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { brandColors, typography } from '@/shared/theme';
import { APP_IMAGES } from '@/constants/app-assets';

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
 *   Phase 1 (0–400ms): The recycling symbol gently settles (1.0 → 1.03 → 1.0).
 *   Phase 2 (200–420ms): Brand lockup text fades in (opacity 0 → 1) and slides up (translateY 10 → 0),
 *                        overlapping the end of the symbol settle.
 *
 * Loader:
 *   - If session restoration takes longer than 650ms, the main symbol rotates.
 *   - No separate generic or duplicate loading indicator is shown.
 *
 * Reduce Motion:
 *   - Immediately renders static brand lockup at full opacity with no scale/translation.
 */

export function AuthLoadingScreen() {
  const symbolScale = useSharedValue(1);
  const symbolRotation = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(10);

  useEffect(() => {
    let isMounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted) return;
      if (reduceMotion) {
        symbolScale.value = 1;
        symbolRotation.value = 0;
        wordmarkOpacity.value = 1;
        wordmarkTranslateY.value = 0;
        return;
      }

      // Phase 1: Symbol scale (1.0 -> 1.03 -> 1.0) ~400ms total
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

      // If startup takes longer, the main brand mark becomes the loader itself.
      symbolRotation.value = withDelay(
        650,
        withRepeat(
          withTiming(360, {
            duration: 1800,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
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
      cancelAnimation(symbolScale);
      cancelAnimation(symbolRotation);
      cancelAnimation(wordmarkOpacity);
      cancelAnimation(wordmarkTranslateY);
    };
  }, [symbolRotation, symbolScale, wordmarkOpacity, wordmarkTranslateY]);

  const symbolStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: symbolScale.value },
      { rotate: `${symbolRotation.value}deg` },
    ],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Checking account access"
      accessibilityLiveRegion="polite"
    >
      <StatusBar style="light" />
      <View style={styles.content}>
        {/* Transparent recycling symbol mark */}
        <Reanimated.View style={symbolStyle}>
          <Image
            source={APP_IMAGES.symbol}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel="ProCopper Recycling Symbol"
          />
        </Reanimated.View>

        {/* Brand lockup wordmark */}
        <Reanimated.View style={[styles.wordmarkContainer, wordmarkStyle]}>
          <Text style={styles.brandTitle}>PROCOPPER</Text>
          <Text style={styles.brandSubtitle}>RECYCLING</Text>
        </Reanimated.View>
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
  content: {
    alignItems: 'center',
  },
  mark: {
    width: 220,
    height: 220,
  },
  wordmarkContainer: {
    alignItems: 'center',
    marginTop: -48,
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
});
