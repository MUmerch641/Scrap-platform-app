import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface PermissionStatusResult {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Reusable System Notification & Permission Service for Mobile.
 * Uses native iOS & Android system dialogs for permissions and native notification dispatch.
 */

// Configure default in-app notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests native system permission for push & local notifications.
 */
export async function requestNotificationPermissions(): Promise<PermissionStatusResult> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  return {
    granted: finalStatus === 'granted',
    canAskAgain: finalStatus !== 'granted',
  };
}

/**
 * Schedules a local system notification that appears in the device's native notification center.
 */
export async function scheduleLocalSystemNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string | null> {
  const permission = await requestNotificationPermissions();
  if (!permission.granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Triggers immediately in system notification center
  });
}
