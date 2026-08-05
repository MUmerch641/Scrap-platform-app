import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  ViewStyle,
} from 'react-native';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return colors.surfaceSelected;
    if (variant === 'primary') return pressed && Platform.OS === 'ios' ? '#1d4ed8' : colors.primary;
    if (variant === 'secondary') return pressed && Platform.OS === 'ios' ? colors.surfaceSelected : colors.surface;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (variant === 'primary') return '#ffffff';
    if (variant === 'secondary') return colors.text;
    return colors.primary;
  };

  const borderStyle: ViewStyle =
    variant === 'outline'
      ? { borderWidth: 1, borderColor: disabled ? colors.border : colors.primary }
      : {};

  // Android: use a ripple overlay via the `android_ripple` prop
  // iOS: use opacity-based press feedback
  const androidRipple = Platform.OS === 'android'
    ? {
        color: variant === 'primary' ? 'rgba(255,255,255,0.2)' : colors.surfaceSelected,
        borderless: false,
      }
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      android_ripple={androidRipple}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: getBackgroundColor(pressed) },
        borderStyle,
        // iOS opacity feedback; Android uses ripple so no opacity change
        Platform.OS === 'ios' && pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    overflow: 'hidden', // required for Android ripple to be clipped to border radius
  },
  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
  },
});
