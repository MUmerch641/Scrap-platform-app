import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { semanticColors, spacing, typography } from '@/shared/theme';
import { AppIcon } from './app-icon';
import { Button } from './button';

interface OfflineStateProps {
  message: string;
  onRetry: () => void;
  loading?: boolean;
}

export function OfflineState({ message, onRetry, loading = false }: OfflineStateProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={styles.container}>
      <AppIcon name="cloud-offline-outline" size={30} color={colors.accent} />
      <Text style={[styles.title, { color: colors.text }]}>No internet connection</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      <Button
        title="Retry"
        variant="outline"
        onPress={onRetry}
        loading={loading}
        disabled={loading}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  button: { marginTop: spacing.md },
});
