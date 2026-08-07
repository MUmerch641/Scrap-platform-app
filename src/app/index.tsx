import { Redirect } from 'expo-router';

import { routeForAuthenticatedRole, useUserRole } from '@/app/context/UserRoleContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';

export default function Index() {
  const { role, isInitialLoading } = useUserRole();
  if (isInitialLoading) return <AuthLoadingScreen />;
  return <Redirect href={routeForAuthenticatedRole(role) ?? '/(auth)/sign-in'} />;
}
