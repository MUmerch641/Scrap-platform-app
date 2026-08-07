import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { spacing } from '@/shared/theme';

export function BrandHeader() {
  const isDark = useColorScheme() === 'dark';
  const [viewportWidth, setViewportWidth] = React.useState(320);
  const sourceSize = viewportWidth * (2000 / 1577);

  return (
    <View style={styles.container}>
      <View
        style={styles.wordmarkViewport}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      >
        <Image
          source={
            isDark
              ? require('@/assets/images/procopper logo v1 - dark bg 1.png')
              : require('@/assets/images/procopper logo v1.png')
          }
          style={[
            styles.sourceCanvas,
            {
              width: sourceSize,
              height: sourceSize,
              left: -viewportWidth * (223 / 1577),
              top: -viewportWidth * (871 / 1577),
            },
          ]}
          contentFit="fill"
          accessibilityLabel="ProCopper Recycling Services"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: spacing.md },
  // Trim transparent canvas only; the approved V1 artwork remains unchanged.
  wordmarkViewport: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1577 / 320,
    overflow: 'hidden',
  },
  sourceCanvas: { position: 'absolute' },
});
