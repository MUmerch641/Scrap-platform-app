import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert, Platform, ToastAndroid } from 'react-native';

import { showAndroidErrorDialog } from '@/services/app-dialog-controller';
import { showIOSFeedback } from '@/services/ios-feedback-controller';

export type NegativeHapticType = 'error' | 'warning';

/**
 * Triggers haptic feedback ONLY for meaningful negative states
 * (e.g. invalid form data, wrong credentials, network failure, permission denied, server error).
 * Haptics are strictly disabled for normal button presses, navigation, success toasts, and saves.
 */
export async function triggerNegativeHaptic(type: NegativeHapticType = 'error'): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  try {
    if (type === 'error') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // Haptics disabled, unavailable, or unsupported on device
  }
}

/**
 * Displays a lightweight success message without triggering vibration.
 * Android uses standard ToastAndroid.show().
 */
export function showSuccessMessage(message: string): void {
  if (Platform.OS === 'ios') {
    showIOSFeedback({ message, kind: 'success' });
    return;
  }
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

/**
 * Displays a lightweight informational message without triggering vibration.
 * Android uses standard ToastAndroid.show().
 */
export function showInfoMessage(message: string): void {
  if (Platform.OS === 'ios') {
    showIOSFeedback({ message, kind: 'info' });
    return;
  }
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

/**
 * Displays an error message and triggers a single error haptic feedback for negative state.
 */
export function showErrorMessage(message: string, title = 'Error'): void {
  triggerNegativeHaptic('error');
  if (Platform.OS === 'ios') {
    Alert.alert(title, message, [{ text: 'OK' }]);
    return;
  }
  if (Platform.OS === 'android' && !showAndroidErrorDialog({ title, message })) {
    // The provider is normally mounted before any screen action. This fallback still avoids Alert UI.
    ToastAndroid.show(message, ToastAndroid.LONG);
  }
}

/**
 * Displays the existing native iOS confirmation. Android decisions use AppDialogProvider.
 */
export function showNativeConfirmation(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
): void {
  if (Platform.OS !== 'ios') return;
  Alert.alert(
    title,
    message,
    [
      {
        text: cancelText,
        style: 'cancel',
      },
      {
        text: confirmText,
        style: 'default',
        onPress: () => {
          onConfirm();
        },
      },
    ],
    { cancelable: true }
  );
}

/**
 * Displays the existing native iOS ActionSheet. Android decisions use AppDialogProvider.
 * Does not trigger vibration on opening or selection.
 */
export function showNativeActionSheet(
  title: string,
  options: string[],
  cancelButtonIndex: number,
  onSelect: (index: number) => void,
  message?: string,
  destructiveButtonIndex?: number
): void {
  if (Platform.OS !== 'ios') return;
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      message,
      options,
      cancelButtonIndex,
      destructiveButtonIndex,
    },
    (buttonIndex) => {
      if (buttonIndex !== cancelButtonIndex) {
        onSelect(buttonIndex);
      }
    }
  );
}
