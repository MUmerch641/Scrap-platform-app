import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { useUserRole } from '@/context/UserRoleContext';
import { DriverJobCard } from '@/features/driver/components/driver-job-card';
import { formatDriverSchedule, formatDriverVehicle } from '@/features/driver/driver-job-formatters';
import { subscribeToDriverJobsChanged } from '@/features/driver/services/driver-job-refresh';
import { fetchDriverJobSummary, fetchDriverJobs, formatDriverLocalDate } from '@/features/driver/services/driver-job-service';
import { DriverJob } from '@/features/driver/types';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

const ACTIVE_STATUSES = ['en_route', 'arrived', 'material_collected'] as const;

export default function DriverHomeScreen() {
  const router = useRouter();
  const { userProfile } = useUserRole();
  const { isOffline } = useNetworkStatus();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [activeJobs, setActiveJobs] = useState<DriverJob[]>([]);
  const [nextJob, setNextJob] = useState<DriverJob | null>(null);
  const [counts, setCounts] = useState({ today: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (isOffline) { setLoading(false); return; }
    const id = ++requestId.current;
    setError(null);
    const today = formatDriverLocalDate(new Date());
    const [active, next, summary] = await Promise.all([
      fetchDriverJobs({ page: 0, pageSize: 2, executionStatuses: ACTIVE_STATUSES }),
      fetchDriverJobs({ page: 0, pageSize: 1, scheduledFrom: today, executionStatuses: ['assigned'] }),
      fetchDriverJobSummary(today),
    ]);
    if (id !== requestId.current) return;
    if (active.success) setActiveJobs(active.jobs);
    if (next.success) setNextJob(next.jobs[0] ?? null);
    if (summary.success) setCounts({ today: summary.todayJobs, completed: summary.completedToday });
    const firstError = active.error ?? next.error ?? summary.error;
    if (firstError && !active.success && !next.success && !summary.success) setError(firstError);
    setLoading(false);
  }, [isOffline]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  React.useEffect(() => subscribeToDriverJobsChanged(() => load()), [load]);

  const openJob = (job: DriverJob) => router.push({ pathname: '/(driver)/active-job', params: { jobId: job.id } });
  const activeJob = activeJobs[0] ?? null;
  const primaryJob = activeJob ?? nextJob;
  const hasData = Boolean(primaryJob) || counts.today > 0 || counts.completed > 0;
  const firstName = userProfile?.fullName?.trim().split(/\s+/)[0] || 'Driver';

  if (loading && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver operations" />}><LoadingState message="Preparing your shift..." /></ScreenScaffold>;
  if (isOffline && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver operations" />}><OfflineState message="Connect to the internet to load your assigned jobs." onRetry={() => void load()} /></ScreenScaffold>;
  if (error && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver operations" />}><EmptyState title="Unable to load your shift" message={error} action={<Button title="Try Again" variant="outline" onPress={() => void load()} />} /></ScreenScaffold>;

  return (
    <ScreenScaffold mode="scroll" header={<AppHeader title="Home" subtitle="Driver operations" />} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
            <Text style={styles.heroTitle}>{activeJob ? 'You have a job in progress' : nextJob ? 'Your next pickup is ready' : 'Your shift is clear'}</Text>
          </View>
          <View style={styles.driverIcon}><Ionicons name="car-sport" size={24} color={brandColors.lightCopper} /></View>
        </View>
        <View style={styles.shiftSummary}>
          <ShiftMetric value={String(counts.today)} label="Jobs today" />
          <View style={styles.heroDivider} />
          <ShiftMetric value={String(counts.completed)} label="Completed" />
          <View style={styles.heroDivider} />
          <View style={styles.shiftStatus}>
            <Text style={styles.shiftLabel}>Current state</Text>
            <Text style={styles.shiftState}>{activeJob ? 'On job' : 'Available'}</Text>
          </View>
        </View>
      </View>

      {isOffline ? <View style={[styles.offlineStrip, { borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={17} color={colors.warning} /><Text style={[styles.offlineText, { color: colors.text }]}>Showing your last loaded assignments</Text></View> : null}

      {activeJobs.length > 1 ? (
        <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={[styles.noticeText, { color: colors.text }]}>Multiple active jobs need Operations review. Continue the first job and contact Operations.</Text>
        </View>
      ) : null}

      {primaryJob ? (
        <View style={styles.jobSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>{activeJob ? 'CURRENT JOB' : 'NEXT PICKUP'}</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{activeJob ? 'Continue where you left off' : 'Up next'}</Text>
            </View>
          </View>
          <DriverJobCard job={primaryJob} prominent onPress={() => openJob(primaryJob)} />
          <View style={styles.nextStep}>
            <Text style={[styles.nextLabel, { color: colors.textMuted }]}>Next:</Text>
            <Text style={[styles.nextValue, { color: colors.text }]}>{nextActionCopy(primaryJob)}</Text>
          </View>
          <Button title={activeJob ? 'Resume Active Job' : 'View Pickup Details'} onPress={() => openJob(primaryJob)} style={styles.primaryAction} />
        </View>
      ) : (
        <View style={[styles.clearState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.clearIcon, { backgroundColor: colors.background }]}><Ionicons name="checkmark-circle-outline" size={34} color={colors.success} /></View>
          <Text style={[styles.clearTitle, { color: colors.text }]}>No assigned pickups</Text>
          <Text style={[styles.clearMessage, { color: colors.textMuted }]}>You’re all caught up. New Operations assignments will appear here automatically.</Text>
          <Button title="View Job History" variant="outline" onPress={() => router.push('/(driver)/jobs')} />
        </View>
      )}

      {nextJob && activeJob ? (
        <View style={styles.upNextSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>AFTER THIS JOB</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Next scheduled pickup</Text>
            </View>
          </View>
          <CompactNextJob job={nextJob} onPress={() => openJob(nextJob)} colors={colors} />
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function nextActionCopy(job: DriverJob): string {
  if (job.executionStatus === 'assigned') return 'Review pickup details and start your journey';
  if (job.executionStatus === 'en_route') return 'Continue to the pickup and mark your arrival';
  if (job.executionStatus === 'arrived') return 'Record material details and collection evidence';
  if (job.executionStatus === 'material_collected') return 'Deliver the collected material to the yard';
  return 'Review completed job details';
}

function ShiftMetric({ value, label }: { value: string; label: string }) {
  return <View style={styles.shiftMetric}><Text style={styles.shiftValue}>{value}</Text><Text style={styles.shiftLabel}>{label}</Text></View>;
}

function CompactNextJob({ job, onPress, colors }: { job: DriverJob; onPress: () => void; colors: (typeof semanticColors)[keyof typeof semanticColors] }) {
  const schedule = formatDriverSchedule(job.scheduledAt);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.compactJob, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.dateTile, { backgroundColor: colors.background }]}><Text style={[styles.dateTime, { color: colors.primary }]}>{schedule.time}</Text><Text style={[styles.dateLabel, { color: colors.textMuted }]} numberOfLines={1}>{schedule.date}</Text></View>
      <View style={styles.compactCopy}><Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>{job.customerName}</Text><Text style={[styles.compactMeta, { color: colors.textMuted }]} numberOfLines={1}>{formatDriverVehicle(job.assignment.vehicle)}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  hero: { marginHorizontal: -spacing.md, marginTop: -spacing.md, padding: spacing.lg, gap: spacing.lg, backgroundColor: brandColors.navy, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroCopy: { flex: 1, gap: spacing.xs },
  greeting: { color: 'rgba(251,252,248,0.76)', fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  heroTitle: { color: brandColors.white, fontFamily: typography.fontFamily.headingSemibold, fontSize: 27, lineHeight: 31 },
  driverIcon: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,164,107,0.14)', borderWidth: 1, borderColor: 'rgba(230,164,107,0.30)' },
  shiftSummary: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: 'rgba(251,252,248,0.09)' },
  shiftMetric: { flex: 1, gap: 2 },
  shiftValue: { color: brandColors.white, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl },
  shiftLabel: { color: 'rgba(251,252,248,0.68)', fontFamily: typography.fontFamily.bodyMedium, fontSize: 10 },
  shiftStatus: { flex: 1.25, alignItems: 'flex-end', gap: 3 },
  shiftState: { color: brandColors.lightCopper, fontFamily: typography.fontFamily.bodyBold, fontSize: typography.fontSize.sm },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 34, marginHorizontal: spacing.md, backgroundColor: 'rgba(251,252,248,0.2)' },
  offlineStrip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  offlineText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  notice: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  noticeText: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  jobSection: { gap: spacing.md },
  upNextSection: { gap: spacing.md, paddingTop: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  eyebrow: { fontFamily: typography.fontFamily.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  sectionTitle: { marginTop: 2, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  nextStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.xs },
  nextLabel: { fontFamily: typography.fontFamily.bodyBold, fontSize: typography.fontSize.sm },
  nextValue: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  primaryAction: { minHeight: 52, borderRadius: radius.lg },
  clearState: { alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl },
  clearIcon: { width: 62, height: 62, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  clearTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl },
  clearMessage: { maxWidth: 300, textAlign: 'center', fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  compactJob: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.sm },
  dateTile: { width: 92, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, padding: spacing.xs },
  dateTime: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  dateLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: 9 },
  compactCopy: { flex: 1, gap: 3 },
  compactName: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  compactMeta: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs },
});
