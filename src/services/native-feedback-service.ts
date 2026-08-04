import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert, AlertButton, Platform, ToastAndroid } from 'react-native';

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
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

/**
 * Displays a lightweight informational message without triggering vibration.
 * Android uses standard ToastAndroid.show().
 */
export function showInfoMessage(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

/**
 * Displays an error message and triggers a single error haptic feedback for negative state.
 */
export function showErrorMessage(message: string, title = 'Error'): void {
  triggerNegativeHaptic('error');
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }
}

/**
 * Displays a native platform confirmation dialog with Confirm and Cancel buttons.
 * Triggers a warning haptic once upon presenting the confirmation dialog.
 */
export function showNativeConfirmation(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
): void {
  triggerNegativeHaptic('warning');
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
 * Displays native iOS ActionSheet on iOS, falling back to Alert options on Android.
 * Does not trigger vibration on opening or selection.
 */
export function showNativeActionSheet(
  title: string,
  options: string[],
  cancelButtonIndex: number,
  onSelect: (index: number) => void
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex,
      },
      (buttonIndex) => {
        if (buttonIndex !== cancelButtonIndex) {
          onSelect(buttonIndex);
        }
      }
    );
  } else {
    const buttons: AlertButton[] = options.map((opt, idx) => ({
      text: opt,
      style: idx === cancelButtonIndex ? 'cancel' : 'default',
      onPress: () => {
        if (idx !== cancelButtonIndex) {
          onSelect(idx);
        }
      },
    }));

    Alert.alert(title, undefined, buttons, { cancelable: true });
  }
}
