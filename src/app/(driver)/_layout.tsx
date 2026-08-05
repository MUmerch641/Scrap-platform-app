import React from 'react';
import { useColorScheme } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { semanticColors } from '@/shared/theme';

export default function DriverLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.primary}
      iconColor={{
        default: isDark ? '#9ca3af' : '#6b7280',
        selected: colors.primary
      }}
      labelStyle={{
        default: { color: isDark ? '#9ca3af' : '#6b7280' },
        selected: { color: colors.primary }
      }}
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
