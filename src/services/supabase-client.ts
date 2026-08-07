import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredPublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidPublishableKey(value: string | undefined): value is string {
  return Boolean(value && value.length >= 20);
}

export const supabaseConfigurationError =
  !isValidSupabaseUrl(configuredUrl) || !isValidPublishableKey(configuredPublishableKey)
    ? 'Supabase is not configured on this installation. Contact your administrator.'
    : null;

// Safe non-secret placeholders let the application render a controlled configuration error.
// Every service operation checks supabaseConfigurationError before making a request.
const clientUrl = isValidSupabaseUrl(configuredUrl)
  ? configuredUrl
  : 'https://configuration.invalid';
const clientPublishableKey = isValidPublishableKey(configuredPublishableKey)
  ? configuredPublishableKey
  : 'missing-publishable-key';

export const supabase = createClient(clientUrl, clientPublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

export function registerSupabaseAutoRefresh(): () => void {
  if (Platform.OS === 'web' || supabaseConfigurationError) return () => undefined;

  const updateRefreshState = (state: string) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  updateRefreshState(AppState.currentState);
  const subscription = AppState.addEventListener('change', updateRefreshState);

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
