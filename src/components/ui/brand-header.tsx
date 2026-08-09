import React from 'react';
import { Image } from 'expo-image';
import {
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

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
        <Image
          source={
            isDark
              ? require('@/assets/images/procopper logo v1 - dark bg 1.png')
              : require('@/assets/images/procopper logo v1.png')
          }
          style={styles.sourceCanvas}
          contentFit="cover"
          contentPosition="center"
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
    width: '100%',
    height: '100%',
  },
});
