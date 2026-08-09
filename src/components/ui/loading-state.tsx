import React, { useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { semanticColors, spacing, typography } from '@/shared/theme';

export const CONTENT_LOADER_SIZE = 56;
export const BUTTON_LOADER_SIZE = 24;

// The source PNG's visible mark occupies roughly 43% of its transparent canvas.
// Scale the artwork internally so `size` represents the visible spinner footprint.
const SPINNER_ARTWORK_SCALE = 2.2;

interface LoadingStateProps {
  message?: string;
}

interface BrandSpinnerProps {
  size?: number;
  accessibilityLabel?: string;
  decorative?: boolean;
  style?: ViewStyle;
}

export function BrandSpinner({
  size = 24,
  accessibilityLabel = 'Loading',
  decorative = false,
  style,
}: BrandSpinnerProps) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      rotation.value = 0;
      return;
    }

    rotation.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const artworkSize = size * SPINNER_ARTWORK_SCALE;
  const artworkOffset = (size - artworkSize) / 2;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      style={[styles.spinnerFrame, { width: size, height: size }, style]}
    >
      <Animated.View
        style={[
          styles.spinnerArtwork,
          {
            width: artworkSize,
            height: artworkSize,
            left: artworkOffset,
            top: artworkOffset,
          },
          animatedLogoStyle,
        ]}
      >
        <Image
          source={require('@/assets/images/procopper - siteicon.png')}
          style={styles.spinnerImage}
          contentFit="contain"
          accessibilityElementsHidden
        />
      </Animated.View>
    </View>
  );
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <BrandSpinner size={CONTENT_LOADER_SIZE} decorative />
      <Text style={[styles.text, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerFrame: {
    position: 'relative',
  },
  spinnerArtwork: {
    position: 'absolute',
  },
  spinnerImage: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  text: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
});
