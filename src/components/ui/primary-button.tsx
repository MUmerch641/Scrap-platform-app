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
import { radius, semanticColors, typography } from '@/shared/theme';

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
          backgroundColor: disabled ? '#3f3f46' : colors.primary,
          // iOS: opacity + subtle scale on press; Android: ripple handles feedback
          opacity: Platform.OS === 'ios' && pressed ? 0.82 : 1,
          transform: Platform.OS === 'ios' && pressed ? [{ scale: 0.982 }] : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <Text style={styles.text}>{title}</Text>
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
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as '600',
    letterSpacing: -0.1,
  },
});
