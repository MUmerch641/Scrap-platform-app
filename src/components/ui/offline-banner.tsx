import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { semanticColors, radius, spacing, typography } from '@/shared/theme';
import { AppIcon } from './app-icon';

export function OfflineBanner() {
  const { status } = useNetworkStatus();
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const visible = status === 'offline' || status === 'back-online';
  const isBackOnline = status === 'back-online';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : 160,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduceMotion, visible]);

  if (!visible) return null;

  const title = isBackOnline ? 'Back online' : 'No internet connection';
  const message = isBackOnline ? 'You can refresh when ready.' : 'Some information may be out of date.';
  const surface = isBackOnline
    ? colors.surfaceSelected
    : colorScheme === 'dark'
      ? '#07516A'
      : colors.surface;
  const border = colorScheme === 'dark' && !isBackOnline
    ? 'rgba(230, 164, 107, 0.62)'
    : colors.border;

  return (
    <View pointerEvents="none" style={[styles.overlay, { paddingTop: insets.top + spacing.xs }]}>
      <Animated.View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title}. ${message}`}
        style={[
          styles.banner,
          { backgroundColor: surface, borderColor: border, opacity },
        ]}
      >
        <AppIcon
          name={isBackOnline ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
          size={18}
          color={isBackOnline ? colors.primary : colors.accent}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    zIndex: 100,
  },
  banner: {
    width: '92%',
    maxWidth: 520,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  message: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    marginTop: 1,
  },
});
