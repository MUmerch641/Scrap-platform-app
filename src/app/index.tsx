import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { routeForAuthenticatedRole, useUserRole } from '@/app/context/UserRoleContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';

export default function Index() {
  const router = useRouter();
  const { role, isInitialLoading } = useUserRole();

  useEffect(() => {
    if (!isInitialLoading) {
      const target = routeForAuthenticatedRole(role) ?? '/(auth)/sign-in';
      router.replace(target);
    }
  }, [isInitialLoading, role, router]);

  return <AuthLoadingScreen />;
}
