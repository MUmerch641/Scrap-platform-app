import { useUserRole } from '@/app/context/UserRoleContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { ROLES } from '@/shared/roles';
import { semanticColors, typography } from '@/shared/theme';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

export default function DriverLayout() {
  const { session, role, isInitialLoading } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  if (isInitialLoading) return <AuthLoadingScreen />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role !== ROLES.DRIVER) {
    return <Redirect href={role === ROLES.SALES_REP ? '/(sales-rep)' : '/(auth)/sign-in'} />;
  }

  return (
    <NativeTabs
      key={colorScheme ?? 'light'}
      backgroundColor={Platform.OS === 'ios' ? undefined : colors.surface}
      tintColor={colors.accent}
      iconColor={{
        default: colors.textMuted,
        selected: colors.accent
      }}
      labelStyle={
        Platform.OS === 'ios'
          ? {
              default: { color: colors.textMuted, fontFamily: typography.fontFamily.bodyMedium },
              selected: { color: colors.accent, fontFamily: typography.fontFamily.bodySemibold },
            }
          : { fontFamily: typography.fontFamily.bodyMedium }
      }
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="briefcase" md="work" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="active-job">
        <NativeTabs.Trigger.Label>Active</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location" md="place" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
