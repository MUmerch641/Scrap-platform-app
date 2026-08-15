import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  AuthActionResult,
  getAccessMessageForRole,
  getMobileRouteForRole,
  loadOwnProfile,
  MobileRoute,
  ProfileLoadResult,
  signInWithPassword,
  signOutLocally,
  UserProfile,
} from '@/services/auth-service';
import {
  registerSupabaseAutoRefresh,
  supabase,
  supabaseConfigurationError,
} from '@/services/supabase-client';
import { Role } from '@/shared/roles';
import { unregisterCurrentDevicePushToken } from '@/services/push-notification-service';

interface UserRoleContextProps {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  role: Role | null;
  isActive: boolean | null;
  isInitialLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

const UserRoleContext = createContext<UserRoleContextProps | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const currentSessionRef = useRef<Session | null>(null);
  const signInInProgressRef = useRef(false);
  const pendingProfileRef = useRef<{
    userId: string;
    promise: Promise<ProfileLoadResult>;
  } | null>(null);
  const pendingHydrationRef = useRef<{
    userId: string;
    promise: Promise<AuthActionResult>;
  } | null>(null);
  const foregroundValidationRef = useRef<Promise<void> | null>(null);
  const validationEpochRef = useRef(0);

  const clearLocalState = useCallback(() => {
    if (!mountedRef.current) return;
    validationEpochRef.current += 1;
    pendingHydrationRef.current = null;
    currentSessionRef.current = null;
    setSession(null);
    setUser(null);
    setUserProfile(null);
  }, []);

  const getProfileOnce = useCallback((authenticatedUser: User) => {
    if (pendingProfileRef.current?.userId === authenticatedUser.id) {
      return pendingProfileRef.current.promise;
    }

    const promise = loadOwnProfile(authenticatedUser).finally(() => {
      if (pendingProfileRef.current?.userId === authenticatedUser.id) {
        pendingProfileRef.current = null;
      }
    });
    pendingProfileRef.current = { userId: authenticatedUser.id, promise };
    return promise;
  }, []);

  const rejectAccess = useCallback(
    async (message: string, publishError: boolean, clearStoredSession: boolean) => {
      // Remove protected routes and their screen-local data before any network work.
      clearLocalState();
      if (mountedRef.current) {
        if (publishError) setAuthError(message);
        setIsInitialLoading(false);
      }
      if (clearStoredSession) await signOutLocally();
      return { success: false, error: message } satisfies AuthActionResult;
    },
    [clearLocalState]
  );

  const performSessionHydration = useCallback(
    async (
      restoredSession: Session,
      publishError: boolean,
      preserveOnUnavailable: boolean,
      validationEpoch: number,
    ): Promise<AuthActionResult> => {
      if (supabaseConfigurationError) {
        return rejectAccess(supabaseConfigurationError, publishError, false);
      }

      try {
        const { data, error } = await supabase.auth.getUser();
        const authenticatedUser = data.user;

        if (validationEpoch !== validationEpochRef.current) {
          return { success: false, error: 'Session validation was superseded.' };
        }

        if (error) {
          const isTemporaryFailure =
            isAuthRetryableFetchError(error) ||
            (isAuthApiError(error) && (error.status === 429 || error.status >= 500));

          if (preserveOnUnavailable && isTemporaryFailure) {
            return {
              success: false,
              error: 'Unable to revalidate account access right now.',
            };
          }

          return rejectAccess(
            'Unable to verify the signed-in account. Check your connection and try again.',
            publishError,
            true
          );
        }

        if (!authenticatedUser || authenticatedUser.id !== restoredSession.user.id) {
          return rejectAccess(
            'Unable to verify the signed-in account. Please sign in again.',
            publishError,
            true
          );
        }

        const profileResult = await getProfileOnce(authenticatedUser);
        if (validationEpoch !== validationEpochRef.current) {
          return { success: false, error: 'Session validation was superseded.' };
        }
        if (!profileResult.success) {
          if (preserveOnUnavailable && profileResult.reason === 'unavailable') {
            return { success: false, error: profileResult.error };
          }
          const shouldSignOut = profileResult.reason !== 'unavailable';
          return rejectAccess(profileResult.error, publishError, shouldSignOut);
        }

        const operationsMessage = getAccessMessageForRole(profileResult.profile.role);
        if (operationsMessage) {
          return rejectAccess(operationsMessage, publishError, true);
        }

        const route = getMobileRouteForRole(profileResult.profile.role);
        if (!route) {
          return rejectAccess(
            'Your account does not have a supported mobile access role. Contact an administrator.',
            publishError,
            true
          );
        }

        if (mountedRef.current) {
          currentSessionRef.current = restoredSession;
          setSession(restoredSession);
          setUser(authenticatedUser);
          setUserProfile(profileResult.profile);
          setAuthError(null);
          setIsInitialLoading(false);
        }

        return { success: true, session: restoredSession, route };
      } catch {
        if (validationEpoch !== validationEpochRef.current) {
          return { success: false, error: 'Session validation was superseded.' };
        }
        if (preserveOnUnavailable) {
          return {
            success: false,
            error: 'Unable to revalidate account access right now.',
          };
        }
        return rejectAccess(
          'Unable to verify account access. Check your connection and try again.',
          publishError,
          false
        );
      }
    },
    [getProfileOnce, rejectAccess]
  );

  const hydrateSession = useCallback(
    (
      restoredSession: Session,
      publishError: boolean,
      preserveOnUnavailable = false,
    ): Promise<AuthActionResult> => {
      const pending = pendingHydrationRef.current;
      if (pending?.userId === restoredSession.user.id) return pending.promise;
      if (pending) {
        validationEpochRef.current += 1;
        pendingHydrationRef.current = null;
      }

      const validationEpoch = validationEpochRef.current;

      const promise = performSessionHydration(
        restoredSession,
        publishError,
        preserveOnUnavailable,
        validationEpoch,
      );
      pendingHydrationRef.current = { userId: restoredSession.user.id, promise };
      void promise.finally(() => {
        if (pendingHydrationRef.current?.promise === promise) {
          pendingHydrationRef.current = null;
        }
      });
      return promise;
    },
    [performSessionHydration],
  );

  const revalidateForegroundSession = useCallback((): Promise<void> => {
    if (!currentSessionRef.current) return Promise.resolve();
    if (foregroundValidationRef.current) return foregroundValidationRef.current;

    const promise = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) return;

        if (!data.session) {
          await rejectAccess('Your session has expired. Please sign in again.', true, true);
          return;
        }

        await hydrateSession(data.session, true, true);
      } catch {
        // A transient foreground connectivity failure must not expose or destroy tokens.
        // RLS remains authoritative, and the next foreground/token event retries validation.
      }
    })();

    foregroundValidationRef.current = promise;
    void promise.finally(() => {
      if (foregroundValidationRef.current === promise) {
        foregroundValidationRef.current = null;
      }
    });
    return promise;
  }, [hydrateSession, rejectAccess]);

  useEffect(() => {
    mountedRef.current = true;
    const unregisterAutoRefresh = registerSupabaseAutoRefresh();
    let previousAppState = AppState.currentState;

    const foregroundSubscription = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground = previousAppState !== 'active' && nextState === 'active';
      previousAppState = nextState;
      if (returnedToForeground) void revalidateForegroundSession();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !nextSession) {
        clearLocalState();
        if (mountedRef.current) setIsInitialLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setTimeout(() => void hydrateSession(nextSession, true, true), 0);
        return;
      }

      if (!signInInProgressRef.current) {
        setTimeout(() => void hydrateSession(nextSession, true), 0);
      }
    });

    const restoreSession = async () => {
      if (supabaseConfigurationError) {
        if (mountedRef.current) {
          setAuthError(supabaseConfigurationError);
          setIsInitialLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          await rejectAccess(
            'Unable to restore the saved session. Check your connection and try again.',
            true,
            false
          );
        } else if (data.session) {
          await hydrateSession(data.session, true);
        } else if (mountedRef.current) {
          clearLocalState();
          setIsInitialLoading(false);
        }
      } catch {
        await rejectAccess(
          'Unable to restore the saved session. Check your connection and try again.',
          true,
          false
        );
      }
    };

    void restoreSession();

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
      foregroundSubscription.remove();
      unregisterAutoRefresh();
    };
  }, [clearLocalState, hydrateSession, rejectAccess, revalidateForegroundSession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (signInInProgressRef.current) {
        return { success: false, error: 'Sign in is already in progress.' };
      }

      signInInProgressRef.current = true;
      setAuthError(null);
      try {
        const result = await signInWithPassword({ email, password });
        if (!result.success || !result.session) return result;
        return await hydrateSession(result.session, false);
      } finally {
        signInInProgressRef.current = false;
      }
    },
    [hydrateSession]
  );

  const signOut = useCallback(async () => {
    try {
      await unregisterCurrentDevicePushToken();
    } catch {
      // Best-effort cleanup must not trap a user in a signed-in state while offline.
    }
    const result = await signOutLocally();
    clearLocalState();
    setAuthError(null);
    return result;
  }, [clearLocalState]);

  return (
    <UserRoleContext.Provider
      value={{
        session,
        user,
        userProfile,
        role: userProfile?.role ?? null,
        isActive: userProfile?.isActive ?? null,
        isInitialLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        signIn,
        signOut,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (!context) throw new Error('useUserRole must be used within a UserRoleProvider');
  return context;
};

export function routeForAuthenticatedRole(role: Role | null): MobileRoute | null {
  return role ? getMobileRouteForRole(role) : null;
}
