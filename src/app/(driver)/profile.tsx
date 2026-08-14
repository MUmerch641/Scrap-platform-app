import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useAppDialog } from '@/context/AppDialogContext';
import { useUserRole } from '@/context/UserRoleContext';
import { showErrorMessage, showInfoMessage, showNativeActionSheet } from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { userProfile, signOut } = useUserRole();
  const { showDialog } = useAppDialog();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const displayName = userProfile?.fullName?.trim() || 'ProCopper Driver';
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  const doSignOut = async () => {
    const result = await signOut();
    if (result.success) showInfoMessage('Signed out');
    else showErrorMessage(result.error || 'The session was cleared locally.', 'Sign out');
    router.replace('/(auth)/sign-in');
  };

  const handleSignOut = () => {
    if (Platform.OS === 'ios') {
      showNativeActionSheet('Sign out of ProCopper?', ['Sign Out', 'Cancel'], 1, () => void doSignOut(), "You'll need to sign in again to access your account.", 0);
      return;
    }
    showDialog({ title: 'Sign out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign Out', cancelLabel: 'Cancel', destructive: true, icon: 'log-out-outline', dismissible: false, onConfirm: doSignOut });
  };

  return (
    <ScreenScaffold mode="scroll" header={<AppHeader title="Profile" subtitle="Driver account" />} contentContainerStyle={styles.content}>
      <View style={styles.identityHero}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials || 'PD'}</Text></View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.rolePill}><Ionicons name="shield-checkmark" size={14} color={brandColors.lightCopper} /><Text style={styles.roleText}>AUTHORIZED DRIVER</Text></View>
        </View>
      </View>

      <View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>ACCOUNT DETAILS</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your profile</Text>
      </View>

      <View style={[styles.detailsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ProfileRow icon="person-outline" label="Full name" value={displayName} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ProfileRow icon="mail-outline" label="Email address" value={userProfile?.email || 'Not available'} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ProfileRow icon="briefcase-outline" label="Account role" value="Driver" colors={colors} />
      </View>

      <View style={[styles.securityNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.securityIcon, { backgroundColor: colors.background }]}><Ionicons name="lock-closed-outline" size={20} color={colors.accent} /></View>
        <View style={styles.securityCopy}><Text style={[styles.securityTitle, { color: colors.text }]}>Secure Driver access</Text><Text style={[styles.securityText, { color: colors.textMuted }]}>Your assignments and job information are restricted to this signed-in Driver account.</Text></View>
      </View>

      <Pressable onPress={handleSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOutButton, { borderColor: colors.danger, opacity: pressed ? 0.65 : 1 }]}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
      </Pressable>
      <Text style={[styles.versionNote, { color: colors.textMuted }]}>ProCopper Recycling · Driver workspace</Text>
    </ScreenScaffold>
  );
}

function ProfileRow({ icon, label, value, colors }: { icon: 'person-outline' | 'mail-outline' | 'briefcase-outline'; label: string; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) {
  return <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.background }]}><Ionicons name={icon} size={18} color={colors.accent} /></View><View style={styles.rowCopy}><Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={2}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  identityHero: { marginHorizontal: -spacing.md, marginTop: -spacing.md, minHeight: 166, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: brandColors.navy, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  avatar: { width: 82, height: 82, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,164,107,0.16)', borderWidth: 2, borderColor: brandColors.lightCopper },
  initials: { color: brandColors.white, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize['2xl'] },
  identityCopy: { flex: 1, gap: spacing.sm },
  name: { color: brandColors.white, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl, lineHeight: typography.lineHeight.xl },
  rolePill: { alignSelf: 'flex-start', minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: spacing.sm, backgroundColor: 'rgba(251,252,248,0.10)' },
  roleText: { color: brandColors.lightCopper, fontFamily: typography.fontFamily.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  eyebrow: { fontFamily: typography.fontFamily.bodyBold, fontSize: 10, letterSpacing: 1 },
  sectionTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  detailsPanel: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.md },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.md },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  securityIcon: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  securityCopy: { flex: 1, gap: spacing.xs },
  securityTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  securityText: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.xs },
  signOutButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg },
  signOutText: { fontFamily: typography.fontFamily.bodyBold, fontSize: typography.fontSize.sm },
  versionNote: { textAlign: 'center', fontFamily: typography.fontFamily.bodyMedium, fontSize: 10, paddingBottom: spacing.sm },
});
