import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { semanticColors, spacing, typography } from '@/shared/theme';

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
  variant?: 'dashboard' | 'full-screen' | 'inline';
}

export function EmptyState({ title, message, action, variant = 'dashboard' }: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[
      styles.container,
      variant === 'full-screen' && styles.fullScreen,
      variant === 'dashboard' && styles.dashboard,
      variant === 'inline' && styles.inline
    ]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message && (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      )}
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  dashboard: {
    marginTop: spacing.xl * 2,
    justifyContent: 'flex-start',
  },
  inline: {
    padding: spacing.md,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  actionContainer: {
    marginTop: spacing.md,
  },
});
