import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { brandColors, semanticColors, spacing, typography } from '@/shared/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function AppHeader({ title, subtitle, onBack, rightAction }: AppHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const inner = (
    <View style={styles.innerRow}>
      <View style={styles.leftContainer}>
        {onBack && (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              Platform.OS === 'ios' && pressed && { opacity: 0.5 },
            ]}
            android_ripple={
              Platform.OS === 'android'
                ? { color: colors.surfaceSelected, borderless: true, radius: 24 }
                : undefined
            }
          >
            <Text style={[styles.backText, { color: brandColors.lightCopper }]}>
              {Platform.OS === 'ios' ? '‹ Back' : '← Back'}
            </Text>
          </Pressable>
        )}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: brandColors.white }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: brandColors.offWhite }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightAction && <View style={styles.rightContainer}>{rightAction}</View>}
    </View>
  );

  // ── iOS: Liquid Glass header ────────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    const useLiquidGlass = isLiquidGlassAvailable();

    if (useLiquidGlass) {
      return (
        <GlassView
          glassEffectStyle="regular"
          colorScheme="dark"
          tintColor={brandColors.navy}
          style={[
            styles.container,
            {
              borderBottomColor: brandColors.lightCopper,
            },
          ]}
        >
          {inner}
        </GlassView>
      );
    }

    // Fallback (Reduce Transparency / older iOS)
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: brandColors.navy,
            borderBottomColor: brandColors.lightCopper,
          },
        ]}
      >
        {inner}
      </View>
    );
  }

  // ── Android: solid Material surface with elevation ──────────────────────────
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: brandColors.navy,
          borderBottomColor: brandColors.lightCopper,
          elevation: 4,
        },
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  innerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  titleBlock: {
    flex: 1,
  },
  backButton: {
    paddingRight: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.md,
  },
  title: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
