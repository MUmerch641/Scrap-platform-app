/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { radius, semanticColors, spacing, typography } from '@/shared';

export { radius as Radius, semanticColors as SemanticColors, typography as Typography };

export const Colors = {
  light: {
    text: semanticColors.light.text,
    background: semanticColors.light.background,
    backgroundElement: semanticColors.light.surface,
    backgroundSelected: semanticColors.light.surfaceSelected,
    textSecondary: semanticColors.light.textMuted,
  },
  dark: {
    text: semanticColors.dark.text,
    background: semanticColors.dark.background,
    backgroundElement: semanticColors.dark.surface,
    backgroundSelected: semanticColors.dark.surfaceSelected,
    textSecondary: semanticColors.dark.textMuted,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: typography.fontFamily.body,
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: typography.fontFamily.body,
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: typography.fontFamily.body,
    serif: 'serif',
    rounded: typography.fontFamily.body,
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-body)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: spacing.xs,
  two: spacing.sm,
  three: spacing.md,
  four: spacing.lg,
  five: spacing.xl,
  six: spacing['3xl'],
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
