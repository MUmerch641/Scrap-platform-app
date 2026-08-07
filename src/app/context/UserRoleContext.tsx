import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
  const signInInProgressRef = useRef(false);
  const pendingProfileRef = useRef<{
    userId: string;
    promise: Promise<ProfileLoadResult>;
  } | null>(null);

  const clearLocalState = useCallback(() => {
    if (!mountedRef.current) return;
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
      if (clearStoredSession) await signOutLocally();
      clearLocalState();
      if (mountedRef.current) {
        if (publishError) setAuthError(message);
        setIsInitialLoading(false);
      }
      return { success: false, error: message } satisfies AuthActionResult;
    },
    [clearLocalState]
  );

  const hydrateSession = useCallback(
    async (restoredSession: Session, publishError: boolean): Promise<AuthActionResult> => {
      if (supabaseConfigurationError) {
        return rejectAccess(supabaseConfigurationError, publishError, false);
      }

      try {
        const { data, error } = await supabase.auth.getUser();
        const authenticatedUser = data.user;

        if (error || !authenticatedUser || authenticatedUser.id !== restoredSession.user.id) {
          return rejectAccess(
            'Unable to verify the signed-in account. Check your connection and try again.',
            publishError,
            false
          );
        }

        const profileResult = await getProfileOnce(authenticatedUser);
        if (!profileResult.success) {
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
          setSession(restoredSession);
          setUser(authenticatedUser);
          setUserProfile(profileResult.profile);
          setAuthError(null);
          setIsInitialLoading(false);
        }

        return { success: true, session: restoredSession, route };
      } catch {
        return rejectAccess(
          'Unable to verify account access. Check your connection and try again.',
          publishError,
          false
        );
      }
    },
    [getProfileOnce, rejectAccess]
  );

  useEffect(() => {
    mountedRef.current = true;
    const unregisterAutoRefresh = registerSupabaseAutoRefresh();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !nextSession) {
        clearLocalState();
        if (mountedRef.current) setIsInitialLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (mountedRef.current) {
          setSession(nextSession);
          setUser(nextSession.user);
        }
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
      unregisterAutoRefresh();
    };
  }, [clearLocalState, hydrateSession, rejectAccess]);

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
