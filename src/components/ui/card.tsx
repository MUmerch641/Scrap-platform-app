import React from 'react';
import { StyleSheet, useColorScheme, View, ViewStyle } from 'react-native';

import { brandColors, radius, semanticColors, spacing } from '@/shared/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          // Android elevation causes a light rim artifact on dark backgrounds.
          // In dark mode: drop elevation entirely and rely on border for separation.
          // In light mode: keep subtle elevation for depth.
          elevation: isDark ? 0 : 1,
          shadowOpacity: isDark ? 0 : 0.05,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: brandColors.darkGrey,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
});
