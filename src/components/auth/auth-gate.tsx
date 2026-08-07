import React from 'react';
import { Href, useRouter, useSegments } from 'expo-router';

import { routeForAuthenticatedRole, useUserRole } from '@/app/context/UserRoleContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, userProfile, role, isInitialLoading } = useUserRole();
  const firstSegment = segments[0];
  const isAuthRoute = firstSegment === '(auth)';
  const isRecoveryRoute = segments.some((segment) => String(segment) === 'reset-password');
  const targetRoute = routeForAuthenticatedRole(role);
  const targetGroup = targetRoute === '/(driver)' ? '(driver)' : '(sales-rep)';

  const redirectTarget: Href | null = React.useMemo(() => {
    if (isInitialLoading || isRecoveryRoute) return null;
    if (!session || !userProfile || !targetRoute) {
      return isAuthRoute ? null : '/(auth)/sign-in';
    }
    return firstSegment === targetGroup ? null : targetRoute;
  }, [firstSegment, isAuthRoute, isInitialLoading, isRecoveryRoute, session, targetGroup, targetRoute, userProfile]);

  React.useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (isInitialLoading || redirectTarget) return <AuthLoadingScreen />;
  return <>{children}</>;
}
