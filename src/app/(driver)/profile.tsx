import React from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useUserRole } from '@/context/UserRoleContext';
import { useAppDialog } from '@/context/AppDialogContext';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import {
  showInfoMessage,
  showErrorMessage,
  showNativeActionSheet,
} from '@/services/native-feedback-service';
import { semanticColors, spacing, typography } from '@/shared/theme';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { userProfile, signOut } = useUserRole();
  const { showDialog } = useAppDialog();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const doSignOut = async () => {
    const result = await signOut();
    if (result.success) showInfoMessage('Signed out');
    else showErrorMessage(result.error || 'The session was cleared locally.', 'Sign out');
    router.replace('/(auth)/sign-in');
  };

  const handleSignOut = () => {
    if (Platform.OS === 'ios') {
      showNativeActionSheet(
        'Sign Out',
        ['Sign Out', 'Cancel'],
        1, // cancelButtonIndex
        () => void doSignOut()
      );
    } else {
      showDialog({
        title: 'Sign out',
        message: 'Are you sure you want to sign out?',
        confirmLabel: 'Sign Out',
        cancelLabel: 'Cancel',
        destructive: true,
        icon: 'log-out-outline',
        dismissible: false,
        onConfirm: doSignOut,
      });
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
          {userProfile?.role.toUpperCase()}
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
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.md,
    marginTop: spacing.xs,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
