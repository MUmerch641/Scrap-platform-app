import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Button } from './button';
import { semanticColors, spacing, typography } from '@/shared/theme';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.danger }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} variant="outline" style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
  button: {
    marginTop: spacing.md,
  },
});
