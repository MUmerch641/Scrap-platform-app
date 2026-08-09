import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { isMobileRole, isOperationsRole, isRole, Role, ROLES } from '@/shared/roles';
import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MobileRoute = '/(driver)' | '/(sales-rep)/(home)';

export interface AuthActionResult {
  success: boolean;
  session?: Session;
  route?: MobileRoute;
  error?: string;
}

export type ProfileLoadResult =
  | { success: true; profile: UserProfile }
  | { success: false; reason: 'missing' | 'inactive' | 'invalid-role' | 'unavailable'; error: string };

const PROFILE_SELECT = 'id, full_name, email, role, is_active, created_at, updated_at';

export const PASSWORD_RECOVERY_REDIRECT_URL = Linking.createURL('reset-password');

export function getMobileRouteForRole(role: Role): MobileRoute | null {
  if (role === ROLES.DRIVER) return '/(driver)';
  if (role === ROLES.SALES_REP) return '/(sales-rep)/(home)';
  return null;
}

export function getAccessMessageForRole(role: Role): string | null {
  if (isOperationsRole(role)) {
    return 'This account currently uses the web operations dashboard. Mobile access is not available for this role.';
  }
  return null;
}

export async function signInWithPassword(credentials: AuthCredentials): Promise<AuthActionResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  const email = credentials.email.trim().toLowerCase();
  if (!email || !credentials.password) {
    return { success: false, error: 'Enter both your email address and password.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password,
    });

    if (error) {
      if (isAuthRetryableFetchError(error)) {
        return { success: false, error: 'Unable to connect. Check your connection and try again.' };
      }
      if (isAuthApiError(error) && error.status === 429) {
        return { success: false, error: 'Too many sign-in attempts. Wait a moment and try again.' };
      }
      return { success: false, error: 'The email address or password is incorrect.' };
    }

    if (!data.session) return { success: false, error: 'Unable to establish a secure session.' };

    return { success: true, session: data.session };
  } catch {
    return { success: false, error: 'Unable to connect. Check your connection and try again.' };
  }
}

export async function loadOwnProfile(user: User): Promise<ProfileLoadResult> {
  if (supabaseConfigurationError) {
    return { success: false, reason: 'unavailable', error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        reason: 'unavailable',
        error: 'Unable to verify account access. Check your connection and try again.',
      };
    }

    if (!data) {
      return {
        success: false,
        reason: 'missing',
        error: 'Your account setup is incomplete. Contact an administrator.',
      };
    }

    if (!isRole(data.role)) {
      return {
        success: false,
        reason: 'invalid-role',
        error: 'Your account does not have a valid access role. Contact an administrator.',
      };
    }

    if (data.is_active !== true) {
      return {
        success: false,
        reason: 'inactive',
        error: 'This account has been deactivated. Contact an administrator.',
      };
    }

    return {
      success: true,
      profile: {
        id: data.id,
        fullName: data.full_name,
        email: data.email || user.email || '',
        role: data.role,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch {
    return {
      success: false,
      reason: 'unavailable',
      error: 'Unable to verify account access. Check your connection and try again.',
    };
  }
}

export async function signOutLocally(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return error
      ? { success: false, error: 'The local session was cleared, but sign out could not be confirmed.' }
      : { success: true };
  } catch {
    return { success: false, error: 'The local session was cleared, but sign out could not be confirmed.' };
  }
}

export async function requestPasswordRecovery(emailInput: string): Promise<AuthActionResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  const email = emailInput.trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Enter a valid email address first.' };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RECOVERY_REDIRECT_URL,
    });

    return error
      ? { success: false, error: 'Unable to send a recovery email right now. Try again later.' }
      : { success: true };
  } catch {
    return { success: false, error: 'Unable to connect. Check your connection and try again.' };
  }
}

export async function createPasswordRecoverySession(url: string): Promise<AuthActionResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  try {
    const fragment = url.includes('#') ? url.split('#', 2)[1] : '';
    const query = url.includes('?') ? url.split('?', 2)[1].split('#', 1)[0] : '';
    const params = new URLSearchParams([query, fragment].filter(Boolean).join('&'));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenHash = params.get('token_hash');
    const code = params.get('code');

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return error || !data.session
        ? { success: false, error: 'This recovery link is invalid or has expired.' }
        : { success: true, session: data.session };
    }

    if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      return error || !data.session
        ? { success: false, error: 'This recovery link is invalid or has expired.' }
        : { success: true, session: data.session };
    }

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      return error || !data.session
        ? { success: false, error: 'This recovery link is invalid or has expired.' }
        : { success: true, session: data.session };
    }

    return { success: false, error: 'This recovery link is invalid or has expired.' };
  } catch {
    return { success: false, error: 'This recovery link is invalid or has expired.' };
  }
}

export async function updateRecoveredPassword(password: string): Promise<AuthActionResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  try {
    const { error } = await supabase.auth.updateUser({ password });
    return error
      ? { success: false, error: 'Unable to update the password. Check the requirements and try again.' }
      : { success: true };
  } catch {
    return { success: false, error: 'Unable to connect. Check your connection and try again.' };
  }
}

export function isSupportedMobileProfile(profile: UserProfile): boolean {
  return isMobileRole(profile.role);
}
