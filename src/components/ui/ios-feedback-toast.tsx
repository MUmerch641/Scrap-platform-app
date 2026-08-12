import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import {
  IOSFeedbackRequest,
  registerIOSFeedbackHandler,
} from '@/services/ios-feedback-controller';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

const DISPLAY_DURATION_MS = 2600;

export function IOSFeedbackToast() {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-10));
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState<IOSFeedbackRequest | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    return registerIOSFeedbackHandler((request) => {
      setFeedback(request);
    });
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    opacity.setValue(0);
    translateY.setValue(reduceMotion ? 0 : -10);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }),
    ]).start();

    dismissTimerRef.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 140,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setFeedback(null);
      });
    }, DISPLAY_DURATION_MS);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [feedback, opacity, reduceMotion, translateY]);

  if (Platform.OS !== 'ios' || !feedback) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.overlay, { paddingTop: insets.top + spacing.xs }]}
    >
      <Animated.View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={feedback.message}
        style={[
          styles.toast,
          {
            backgroundColor: colorScheme === 'dark' ? colors.modalSurface : colors.surface,
            borderColor: colors.border,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <AppIcon
          name={feedback.kind === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          size={20}
          color={feedback.kind === 'success' ? colors.success : colors.accent}
        />
        <Text style={[styles.message, { color: colors.text }]}>{feedback.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    zIndex: 110,
  },
  toast: {
    width: '92%',
    maxWidth: 520,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  message: {
    flex: 1,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
});
