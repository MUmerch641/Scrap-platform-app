import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

import { BrandSpinner, BUTTON_LOADER_SIZE } from '@/components/ui/loading-state';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

  // ── Spring scale on press — runs on the UI thread via Reanimated ──────────
  const isPressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isPressed.value ? 0.96 : 1, {
          mass: 0.4,
          stiffness: isPressed.value ? 320 : 260,
          damping: isPressed.value ? 20 : 18,
        }),
      },
    ],
  }));
  // ─────────────────────────────────────────────────────────────────────────

  const getBackgroundColor = () => {
    if (disabled) return colors.surfaceSelected;
    if (variant === 'primary') return colors.primary;
    if (variant === 'secondary') return colors.surface;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (variant === 'primary') return colors.onPrimary;
    if (variant === 'secondary') return colors.text;
    return colors.primary;
  };

  const borderStyle: ViewStyle =
    variant === 'outline' || variant === 'secondary'
      ? { borderWidth: 1, borderColor: disabled ? colors.border : colors.primary }
      : {};

  const androidRipple =
    Platform.OS === 'android'
      ? {
          color: variant === 'primary' ? 'rgba(255,255,255,0.2)' : colors.surfaceSelected,
          borderless: false,
        }
      : undefined;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { isPressed.value = true; }}
      onPressOut={() => { isPressed.value = false; }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      android_ripple={androidRipple}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        borderStyle,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <BrandSpinner
          size={BUTTON_LOADER_SIZE}
          accessibilityLabel={`${title} in progress`}
        />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </AnimatedPressable>
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
    overflow: 'hidden',
  },
  text: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
});
