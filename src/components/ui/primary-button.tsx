import { brandColors, radius, semanticColors, typography } from '@/shared/theme';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    ViewStyle,
} from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
}: PrimaryButtonProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  const handlePress = () => {
    if (disabled || loading) return;
    onPress();
  };

  // Android ripple over the primary fill
  const androidRipple =
    Platform.OS === 'android'
      ? { color: 'rgba(255,255,255,0.25)', borderless: false }
      : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      android_ripple={androidRipple}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? colors.surfaceSelected : colors.primary,
        },
        // iOS press feedback — scale + opacity. Android uses ripple.
        Platform.OS === 'ios' && pressed && styles.pressedIOS,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} size="small" />
      ) : (
        <Text style={[styles.text, { color: colors.onPrimary }]}>{title}</Text>
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
    flexDirection: 'row',
    overflow: 'hidden',
    // Subtle shadow (iOS only — elevation is handled separately via platform)
    shadowColor: brandColors.copper,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
    letterSpacing: -0.1,
  },
  // Applied only on iOS when pressed — keeps transform key absent when not pressing
  pressedIOS: {
    opacity: 0.82,
    transform: [{ scale: 0.982 }],
  },
});
