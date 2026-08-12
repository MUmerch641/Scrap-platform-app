import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useUserRole } from '@/context/UserRoleContext';
import { useAppDialog } from '@/context/AppDialogContext';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { StatusBadge } from '@/components/ui/status-badge';
import { requestPasswordRecovery } from '@/services/auth-service';
import {
  showErrorMessage,
  showInfoMessage,
  showNativeActionSheet,
} from '@/services/native-feedback-service';
import { ROLES } from '@/shared/roles';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

function roleLabel(role: string): string {
  switch (role) {
    case ROLES.SALES_REP:
      return 'Sales Representative';
    case ROLES.DRIVER:
      return 'Driver';
    case ROLES.ADMIN_OPERATIONS:
      return 'Admin - Operations';
    case ROLES.HEAD_OPERATIONS:
      return 'Head of Operations';
    case ROLES.ASSISTANT:
      return 'Assistant';
    case ROLES.SUPER_ADMIN:
      return 'Super Admin';
    default:
      return role;
  }
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const DURATION = 340;
const EASE = Easing.out(Easing.cubic);

interface FadeSlideProps {
  children: React.ReactNode;
  delay: number;
  run: boolean;
}

function FadeSlide({ children, delay, run }: FadeSlideProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  React.useEffect(() => {
    if (!run) return;
    opacity.value = 0;
    translateY.value = 12;
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION, easing: EASE }));
    translateY.value = withDelay(delay, withTiming(0, { duration: DURATION, easing: EASE }));
  }, [run, delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

interface ScaleInProps {
  children: React.ReactNode;
  delay: number;
  run: boolean;
}

function ScaleIn({ children, delay, run }: ScaleInProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.82);

  React.useEffect(() => {
    if (!run) return;
    opacity.value = 0;
    scale.value = 0.82;
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION, easing: EASE }));
    scale.value = withDelay(delay, withSpring(1, { mass: 0.5, stiffness: 220, damping: 18 }));
  }, [run, delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  noBorder?: boolean;
}

function InfoRow({ label, value, noBorder = false }: InfoRowProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.infoRow,
        !noBorder && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export default function SalesRepProfileScreen() {
  const router = useRouter();
  const { userProfile, signOut } = useUserRole();
  const { showDialog } = useAppDialog();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const [resettingPassword, setResettingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOutInProgressRef = useRef(false);

  const [animRun, setAnimRun] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setAnimRun(false);
      const timeout = setTimeout(() => setAnimRun(true), 16);
      return () => clearTimeout(timeout);
    }, []),
  );

  const fullName = userProfile?.fullName?.trim() || null;
  const displayName = fullName ?? 'Sales Representative';
  const initials = getInitials(fullName);
  const email = userProfile?.email ?? '';
  const role = userProfile?.role ?? ROLES.SALES_REP;
  const isActive = userProfile?.isActive ?? true;

  const handleResetPassword = async () => {
    if (resettingPassword || !email) return;
    setResettingPassword(true);
    try {
      const result = await requestPasswordRecovery(email);
      if (result.success) {
        showInfoMessage('Password reset email sent. Check your inbox.');
      } else {
        showErrorMessage(result.error ?? 'Unable to send a reset email.', 'Reset Password');
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const doSignOut = async () => {
    if (signOutInProgressRef.current) return;
    signOutInProgressRef.current = true;
    setSigningOut(true);
    try {
      const result = await signOut();
      if (!result.success) {
        showErrorMessage(result.error ?? 'The session was cleared locally.', 'Sign Out');
      }
      router.replace('/(auth)/sign-in');
    } finally {
      signOutInProgressRef.current = false;
      setSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;
    if (Platform.OS === 'ios') {
      showNativeActionSheet(
        'Sign out of ProCopper?',
        ['Sign Out', 'Cancel'],
        1,
        () => void doSignOut(),
        "You'll need to sign in again to access your account.",
        0
      );
      return;
    }

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
  };

  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Profile" subtitle="Account and preferences" />}
    >
      <View style={styles.container}>
        <FadeSlide delay={0} run={animRun}>
          <View style={styles.identitySection}>
            <ScaleIn delay={0} run={animRun}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: isDark ? brandColors.copper : brandColors.navy },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    { color: isDark ? brandColors.navy : brandColors.white },
                  ]}
                >
                  {initials}
                </Text>
              </View>
            </ScaleIn>

            <FadeSlide delay={80} run={animRun}>
              <View style={styles.identityText}>
                <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
                <Text style={[styles.roleSubtitle, { color: colors.textMuted }]}>
                  {roleLabel(role)}
                </Text>
                {email ? (
                  <Text style={[styles.emailSubtitle, { color: colors.textMuted }]}>{email}</Text>
                ) : null}
              </View>
            </FadeSlide>
          </View>
        </FadeSlide>

        <FadeSlide delay={60} run={animRun}>
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Account</Text>
            <Card style={styles.infoCard}>
              <InfoRow label="Role" value={roleLabel(role)} />
              <InfoRow
                label="Status"
                value={
                  <StatusBadge
                    label={isActive ? 'Active' : 'Inactive'}
                    variant={isActive ? 'success' : 'danger'}
                  />
                }
              />
              <InfoRow label="Email" value={email || 'Not available'} noBorder />
            </Card>
          </View>
        </FadeSlide>

        <FadeSlide delay={120} run={animRun}>
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Security</Text>
            <Card style={styles.infoCard}>
              <View style={styles.securityRow}>
                <View style={styles.securityText}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>Reset Password</Text>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                    Send a reset link to your email
                  </Text>
                </View>
                <Button
                  title={resettingPassword ? 'Sending...' : 'Send Link'}
                  onPress={() => void handleResetPassword()}
                  variant="outline"
                  disabled={resettingPassword || !email}
                  loading={resettingPassword}
                  style={styles.inlineBtn}
                />
              </View>
            </Card>
          </View>
        </FadeSlide>

        <FadeSlide delay={180} run={animRun}>
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="outline"
            disabled={signingOut}
            loading={signingOut}
            style={styles.signOutButton}
          />
        </FadeSlide>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  identitySection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  identityText: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
    letterSpacing: 1,
  },
  displayName: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
  },
  roleSubtitle: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  emailSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xs,
  },
  infoCard: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 48,
    gap: spacing.sm,
  },
  infoLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  infoValue: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'right',
    flexShrink: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    minHeight: 56,
  },
  securityText: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  securitySubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  inlineBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  signOutButton: {
    marginTop: spacing.xs,
  },
});
