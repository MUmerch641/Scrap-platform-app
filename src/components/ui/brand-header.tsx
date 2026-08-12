import React from 'react';
import {
  Image,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { APP_IMAGES } from '@/constants/app-assets';
import { spacing } from '@/shared/theme';

export function BrandHeader() {
  const isDark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const lockupWidth = Math.min(340, width - spacing.lg * 2);
  const lockupHeight = lockupWidth * (320 / 1577);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.wordmarkViewport,
          {
            width: lockupWidth,
            height: lockupHeight,
          },
        ]}
      >
        {/* The source is a square transparent canvas; this viewport keeps the approved wordmark crop. */}
        <Image
          source={isDark ? APP_IMAGES.logoDark : APP_IMAGES.logoLight}
          style={[
            styles.sourceCanvas,
            { width: lockupWidth, height: lockupHeight },
          ]}
          resizeMode="cover"
          accessibilityLabel="ProCopper Recycling Services"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  wordmarkViewport: {
    overflow: 'hidden',
  },
  sourceCanvas: {
    flexShrink: 0,
  },
});
