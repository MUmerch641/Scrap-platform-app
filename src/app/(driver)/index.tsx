import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { useUserRole } from '@/context/UserRoleContext';
import { semanticColors, spacing, typography } from '@/shared/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DriverJobCard } from '@/features/driver/components/driver-job-card';
import { fetchDriverJobSummary, fetchDriverJobs, formatDriverLocalDate } from '@/features/driver/services/driver-job-service';
import { DriverJob } from '@/features/driver/types';

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

  const openJob = (job: DriverJob) => router.push({ pathname: '/(driver)/active-job', params: { jobId: job.id } });
  const hasData = activeJobs.length > 0 || nextJob !== null || counts.today > 0 || counts.completed > 0;

  if (loading && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver workspace" />}><LoadingState message="Loading your jobs..." /></ScreenScaffold>;
  if (isOffline && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver workspace" />}><OfflineState message="Connect to the internet to load your assigned jobs." onRetry={() => void load()} /></ScreenScaffold>;
  if (error && !hasData) return <ScreenScaffold header={<AppHeader title="Home" subtitle="Driver workspace" />}><EmptyState title="Unable to load jobs" message={error} action={<Button title="Retry" variant="outline" onPress={() => void load()} />} /></ScreenScaffold>;

  return <ScreenScaffold mode="scroll" header={<AppHeader title="Home" subtitle={userProfile?.fullName ?? 'Driver workspace'} />} contentContainerStyle={styles.content}>
    {activeJobs.length > 1 ? <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.noticeText, { color: colors.text }]}>Multiple active jobs need Operations review. Resume the first listed job and contact Operations.</Text></View> : null}
    {activeJobs[0] ? <><Text style={[styles.sectionTitle, { color: colors.text }]}>Active Job</Text><DriverJobCard job={activeJobs[0]} onPress={() => openJob(activeJobs[0])} /><Button title="Resume Active Job" onPress={() => openJob(activeJobs[0])} /></> : null}
    {nextJob ? <><Text style={[styles.sectionTitle, { color: colors.text }]}>Next Assigned Job</Text><DriverJobCard job={nextJob} onPress={() => openJob(nextJob)} /></> : null}
    {!activeJobs[0] && !nextJob ? <EmptyState title="No assigned jobs" message="Your Operations assignments will appear here." variant="inline" /> : null}
    <View style={styles.counts}><View style={[styles.countCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.count, { color: colors.text }]}>{counts.today}</Text><Text style={[styles.countLabel, { color: colors.textMuted }]}>Today&apos;s Jobs</Text></View><View style={[styles.countCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.count, { color: colors.text }]}>{counts.completed}</Text><Text style={[styles.countLabel, { color: colors.textMuted }]}>Completed Today</Text></View></View>
  </ScreenScaffold>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, sectionTitle: { marginTop: spacing.sm, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg }, counts: { flexDirection: 'row', gap: spacing.sm }, countCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs }, count: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl }, countLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs }, notice: { borderWidth: 1, borderRadius: 12, padding: spacing.sm }, noticeText: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm } });
