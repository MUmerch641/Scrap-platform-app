import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { radius, semanticColors, spacing } from '@/shared/theme';

export function BrandHeader() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <View style={styles.container}>
      {/* Neutral logo placeholder frame */}
      <View
        style={[
          styles.logoPlaceholder,
          {
            backgroundColor: isDark ? '#27272a' : '#f4f4f5',
            borderColor: isDark ? '#3f3f46' : '#e4e4e7',
          },
        ]}
      >
        <View
          style={[
            styles.innerMark,
            { backgroundColor: isDark ? '#71717a' : '#9ca3af' },
          ]}
        />
      </View>

      {/* Neutral company name placeholder */}
      <Text style={[styles.companyName, { color: colors.textMuted }]}>
        COMPANY NAME
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  innerMark: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  companyName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
