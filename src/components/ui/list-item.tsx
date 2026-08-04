import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { StatusBadge, StatusVariant } from './status-badge';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusVariant?: StatusVariant;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export function ListItem({
  title,
  subtitle,
  statusLabel,
  statusVariant = 'neutral',
  onPress,
  rightElement,
}: ListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? '#27272a' : '#e4e4e7',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#71717a' }]}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSlot}>
          {statusLabel && <StatusBadge label={statusLabel} variant={statusVariant} />}
          {rightElement}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
