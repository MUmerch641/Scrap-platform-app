import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { supabase, supabaseConfigurationError } from '@/services/supabase-client';
import { brandColors } from '@/shared/theme';

const PUSH_TOKEN_STORAGE_KEY = 'procopper.expoPushToken.v1';

export async function registerAuthenticatedDeviceForPush(): Promise<{ success: boolean; token?: string }> {
  if (supabaseConfigurationError || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return { success: false };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('driver-jobs', {
      name: 'Driver jobs',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: brandColors.copper,
    });
  }
  const permissions = await Notifications.getPermissionsAsync();
  const status = permissions.status === 'granted'
    ? permissions.status
    : (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })).status;
  if (status !== 'granted') return { success: false };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) return { success: false };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_my_device_push_token', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
  });
  if (error) return { success: false };
  await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
  return { success: true, token };
}

export async function updateAuthenticatedDevicePushToken(token: string): Promise<void> {
  if (supabaseConfigurationError || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  const { error } = await supabase.rpc('register_my_device_push_token', {
    p_expo_push_token: token,
    p_platform: Platform.OS,
  });
  if (!error) await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);
}

/** Best-effort cleanup; logout always proceeds if the device is offline. */
export async function unregisterCurrentDevicePushToken(): Promise<void> {
  if (supabaseConfigurationError) return;
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;
  const { error } = await supabase.rpc('remove_my_device_push_token', { p_expo_push_token: token });
  if (!error) await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
}
