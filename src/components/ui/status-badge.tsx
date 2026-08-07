import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { radius, semanticColors, spacing, statusColors, typography } from '@/shared/theme';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
}

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];
  const statuses = statusColors[isDark ? 'dark' : 'light'];

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: statuses.success.surface,
          text: statuses.success.text,
          border: statuses.success.border,
        };
      case 'warning':
        return {
          bg: statuses.warning.surface,
          text: statuses.warning.text,
          border: statuses.warning.border,
        };
      case 'danger':
        return {
          bg: statuses.danger.surface,
          text: statuses.danger.text,
          border: statuses.danger.border,
        };
      default:
        return {
          bg: colors.surface,
          text: colors.textMuted,
          border: colors.border,
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
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
