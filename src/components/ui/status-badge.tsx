import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { radius, semanticColors, spacing, typography } from '@/shared/theme';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
}

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: isDark ? '#052e16' : '#f0fdf4',
          text: colors.success,
          border: isDark ? '#14532d' : '#bbf7d0',
        };
      case 'warning':
        return {
          bg: isDark ? '#422006' : '#fefce8',
          text: colors.warning,
          border: isDark ? '#713f12' : '#fef08a',
        };
      case 'danger':
        return {
          bg: isDark ? '#450a0a' : '#fef2f2',
          text: colors.danger,
          border: isDark ? '#7f1d1d' : '#fecaca',
        };
      default:
        return {
          bg: isDark ? '#27272a' : '#f4f4f5',
          text: isDark ? '#d4d4d8' : '#52525b',
          border: isDark ? '#3f3f46' : '#e4e4e7',
        };
    }
  };

  const currentVariant = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: currentVariant.bg,
          borderColor: currentVariant.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: currentVariant.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold as '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
