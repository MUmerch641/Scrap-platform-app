import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon, AppIconName } from '@/components/ui/app-icon';
import { BrandSpinner, BUTTON_LOADER_SIZE } from '@/components/ui/loading-state';
import { brandOverlays, radius, semanticColors, spacing, typography } from '@/shared/theme';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  icon?: AppIconName;
  dismissible?: boolean;
  loading?: boolean;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
  icon,
  dismissible = false,
  loading = false,
}: ConfirmationDialogProps) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const reduceMotion = useReducedMotion();
  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.96);

  React.useEffect(() => {
    if (!visible) return;
    const duration = reduceMotion ? 0 : 180;
    backdropOpacity.value = 0;
    cardOpacity.value = 0;
    cardScale.value = reduceMotion ? 1 : 0.96;
    backdropOpacity.value = withTiming(1, { duration });
    cardOpacity.value = withTiming(1, { duration });
    cardScale.value = withTiming(1, { duration });
  }, [backdropOpacity, cardOpacity, cardScale, reduceMotion, visible]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const requestDismiss = () => {
    if (dismissible && !loading) onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestDismiss}
    >
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestDismiss}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          accessibilityViewIsModal
          importantForAccessibility="yes"
          style={[
            styles.dialog,
            {
              backgroundColor: colors.modalSurface,
              borderColor: colors.border,
            },
            cardAnimatedStyle,
          ]}
        >
          {icon ? (
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[styles.iconContainer, { backgroundColor: colors.surface }]}
            >
              <AppIcon
                name={icon}
                size={22}
                color={destructive ? colors.danger : colors.accent}
              />
            </View>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <View style={styles.buttonRow}>
            {cancelLabel ? (
              <DialogButton
                label={cancelLabel}
                onPress={onCancel}
                disabled={loading}
                backgroundColor={colors.surface}
                borderColor={colors.border}
                textColor={colors.text}
              />
            ) : null}
            <DialogButton
              label={confirmLabel}
              onPress={onConfirm}
              disabled={loading}
              loading={loading}
              backgroundColor={destructive ? colors.danger : colors.accent}
              borderColor={destructive ? colors.danger : colors.accent}
              textColor={destructive ? '#FFFFFF' : colors.onPrimary}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  disabled,
  loading = false,
  backgroundColor,
  borderColor,
  textColor,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor, borderColor, opacity: disabled ? 0.68 : pressed ? 0.82 : 1 },
      ]}
    >
      {loading ? (
        <BrandSpinner size={BUTTON_LOADER_SIZE} accessibilityLabel={`${label} in progress`} />
      ) : (
        <Text style={[styles.actionText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: brandOverlays.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
});
