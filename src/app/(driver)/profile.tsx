import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useUserRole } from '@/app/context/UserRoleContext';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import {
  showInfoMessage,
  showNativeActionSheet,
  showNativeConfirmation,
} from '@/services/native-feedback-service';
import { semanticColors, spacing, typography } from '@/shared/theme';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { userProfile, signOut } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const doSignOut = () => {
    signOut();
    showInfoMessage('Signed out');
    router.replace('/(auth)/sign-in');
  };

  const handleSignOut = () => {
    if (Platform.OS === 'ios') {
      showNativeActionSheet(
        'Sign Out',
        ['Sign Out', 'Cancel'],
        1, // cancelButtonIndex
        () => doSignOut()
      );
    } else {
      showNativeConfirmation(
        'Sign Out',
        'Are you sure you want to sign out?',
        doSignOut,
        'Sign Out',
        'Cancel'
      );
    }
  };

  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Profile" />}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Account Role</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {userProfile?.role ? userProfile.role.toUpperCase() : 'DRIVER'}
        </Text>

        {userProfile?.email && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.md }]}>
              Email Address
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>{userProfile.email}</Text>
          </>
        )}
      </View>

      <Button
        title="Sign Out"
        onPress={handleSignOut}
        variant="outline"
        style={styles.signOutButton}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold as '600',
    marginTop: spacing.xs,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
