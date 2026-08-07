import { useUserRole } from '@/app/context/UserRoleContext';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { ROLES } from '@/shared/roles';
import { semanticColors, typography } from '@/shared/theme';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

export default function SalesRepLayout() {
  const { session, role, isInitialLoading } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  if (isInitialLoading) return <AuthLoadingScreen />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role !== ROLES.SALES_REP) {
    return <Redirect href={role === ROLES.DRIVER ? '/(driver)' : '/(auth)/sign-in'} />;
  }

  return (
    <NativeTabs
      key={colorScheme ?? 'light'}
      backgroundColor={Platform.OS === 'ios' ? undefined : colors.tabBarBackground}
      tintColor={colors.tabBarSelected}
      iconColor={{
        default: colors.tabBarDefault,
        selected: colors.tabBarSelected,
      }}
      labelStyle={
        Platform.OS === 'ios'
          ? {
              default: { color: colors.tabBarDefault, fontFamily: typography.fontFamily.bodyMedium },
              selected: { color: colors.tabBarSelected, fontFamily: typography.fontFamily.bodySemibold },
            }
          : { fontFamily: typography.fontFamily.bodyMedium }
      }
      indicatorColor={Platform.OS === 'android' ? colors.tabBarIndicator : undefined}
      labelVisibilityMode={Platform.OS === 'android' ? 'selected' : undefined}
      rippleColor={Platform.OS === 'android' ? colors.tabBarRipple : undefined}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="create-job">
        <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.circle" md="add_circle" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="customers">
        <NativeTabs.Trigger.Label>Customers</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="people" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
