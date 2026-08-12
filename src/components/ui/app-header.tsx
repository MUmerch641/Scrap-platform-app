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

import { AppIcon } from '@/components/ui/app-icon';
import { brandColors, semanticColors, spacing, typography } from '@/shared/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backIconOnly?: boolean;
  rightAction?: React.ReactNode;
  compact?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  backIconOnly = false,
  rightAction,
  compact = false,
}: AppHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];
  const iosDividerColor = isDark
    ? 'rgba(230, 164, 107, 0.22)'
    : 'rgba(230, 164, 107, 0.30)';
  const iosSubtitleColor = isDark
    ? 'rgba(251, 252, 248, 0.74)'
    : 'rgba(251, 252, 248, 0.82)';

  const inner = (
    <View style={[styles.innerRow, compact && styles.innerRowCompact]}>
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
            <View style={styles.backContent}>
              <AppIcon
                name="chevron-back"
                size={backIconOnly ? 28 : 22}
                color={brandColors.lightCopper}
              />
              {!backIconOnly ? (
                <Text style={[styles.backLabel, { color: brandColors.lightCopper }]}>Back</Text>
              ) : null}
            </View>
          </Pressable>
        )}
        <View style={[styles.titleBlock, Platform.OS === 'ios' && styles.titleBlockIOS]}>
          <Text
            style={[
              styles.title,
              Platform.OS === 'ios' && styles.titleIOS,
              compact && styles.titleCompact,
              { color: brandColors.white },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                Platform.OS === 'ios' && styles.subtitleIOS,
                compact && styles.subtitleCompact,
                { color: Platform.OS === 'ios' ? iosSubtitleColor : brandColors.offWhite },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightAction ? <View style={styles.rightContainer}>{rightAction}</View> : null}
    </View>
  );

  if (Platform.OS === 'ios') {
    if (isLiquidGlassAvailable()) {
      return (
        <GlassView
          glassEffectStyle="regular"
          colorScheme="dark"
          tintColor={brandColors.navy}
          style={[
            styles.container,
            compact && styles.containerCompact,
            { borderBottomColor: iosDividerColor },
          ]}
        >
          {inner}
        </GlassView>
      );
    }

    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          {
            backgroundColor: brandColors.navy,
            borderBottomColor: iosDividerColor,
          },
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
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
  containerCompact: {
    minHeight: 48,
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
  innerRowCompact: {
    minHeight: 48,
    paddingVertical: 2,
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
  titleBlockIOS: {
    gap: 1,
  },
  backButton: {
    minWidth: 44,
    paddingRight: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.md,
  },
  title: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  titleIOS: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 17,
    lineHeight: 20,
  },
  titleCompact: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.sm,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  subtitleIOS: {
    fontSize: typography.fontSize.xs,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  subtitleCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
