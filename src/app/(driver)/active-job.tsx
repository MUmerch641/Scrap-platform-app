import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { DriverJob } from '@/features/driver/types';
import { fetchDriverJobs } from '@/features/driver/services/driver-job-service';
import { formatDriverSchedule, formatDriverStatus, formatDriverVehicle, formatDriverWeight } from '@/features/driver/driver-job-formatters';
import { semanticColors, spacing, typography } from '@/shared/theme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, useColorScheme, View } from 'react-native';

const ACTIVE_STATUSES = ['en_route', 'arrived', 'material_collected'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScreenState = 'ready' | 'unavailable' | 'conflict' | 'error';

export default function DriverActiveJobScreen() {
  const router = useRouter();
  const { jobId: routeJobId } = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof routeJobId === 'string' ? routeJobId : undefined;
  const { isOffline } = useNetworkStatus();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [job, setJob] = useState<DriverJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const requestId = useRef(0);
  const hasLoadedJobRef = useRef(false);

  const load = useCallback(async () => {
    if (isOffline) { setLoading(false); return; }
    if (jobId && !UUID_PATTERN.test(jobId)) { setJob(null); setScreenState('unavailable'); setLoading(false); return; }
    const id = ++requestId.current;
    setScreenState('ready');
    const result = await fetchDriverJobs({ page: 0, pageSize: 2, jobId, executionStatuses: jobId ? undefined : ACTIVE_STATUSES });
    if (id !== requestId.current) return;
    if (!result.success) { if (!hasLoadedJobRef.current) setScreenState('error'); setLoading(false); return; }
    if (result.jobs.length > 1 && !jobId) { setJob(null); hasLoadedJobRef.current = false; setScreenState('conflict'); setLoading(false); return; }
    setJob(result.jobs[0] ?? null);
    hasLoadedJobRef.current = result.jobs.length > 0;
    setScreenState(result.jobs.length ? 'ready' : 'unavailable');
    setLoading(false);
  }, [isOffline, jobId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const callCustomer = async () => {
    if (!job) return;
    const phone = job.customerPhone.replace(/[^\d+]/g, '');
    if (!phone) return;
    try {
      const url = `tel:${phone}`;
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      // The visible phone number remains available if this device cannot open the dialer.
    }
  };

  const header = <AppHeader title="Active Job" subtitle="Driver workspace" />;
  if (loading && !job) return <ScreenScaffold header={header}><LoadingState message="Loading job details..." /></ScreenScaffold>;
  if (isOffline && !job) return <ScreenScaffold header={header}><OfflineState message="Connect to the internet to load this job." onRetry={() => void load()} /></ScreenScaffold>;
  if (screenState === 'error' && !job) return <ScreenScaffold header={header}><ErrorState title="Unable to load job" message="Check your connection and try again." onRetry={() => void load()} /></ScreenScaffold>;
  if (!job) return <ScreenScaffold header={header}><EmptyState title={screenState === 'conflict' ? 'Multiple active jobs' : jobId ? 'Job unavailable' : 'No active job'} message={screenState === 'conflict' ? 'Your assignments need Operations review before you continue.' : jobId ? 'This job is no longer available to your account.' : 'Your assigned jobs will appear here once work begins.'} action={<Button title="View Jobs" variant="outline" onPress={() => router.push('/(driver)/jobs')} />} variant="dashboard" /></ScreenScaffold>;

  const schedule = formatDriverSchedule(job.scheduledAt);
  return <ScreenScaffold mode="scroll" header={<AppHeader title="Job Details" subtitle={formatDriverStatus(job.executionStatus)} />} contentContainerStyle={styles.content}>
    <Section title="Customer" colors={colors}><Text style={[styles.customerName, { color: colors.text }]}>{job.customerName}</Text><Detail label="Phone" value={job.customerPhone} colors={colors} />{job.customerPhone.replace(/[^\d+]/g, '') ? <Button title="Call Customer" variant="outline" onPress={() => void callCustomer()} /> : null}</Section>
    <Section title="Pickup" colors={colors}><Detail label="Historical pickup address" value={job.pickupAddress} colors={colors} /><Detail label="Scheduled date" value={schedule.date} colors={colors} /><Detail label="Scheduled time" value={schedule.time} colors={colors} /><Detail label="Material" value={job.materialType} colors={colors} /><Detail label="Estimated weight" value={formatDriverWeight(job.estimatedWeight)} colors={colors} /></Section>
    <Section title="Assignment" colors={colors}><Detail label="Vehicle" value={formatDriverVehicle(job.assignment.vehicle)} colors={colors} /><Detail label="Current status" value={formatDriverStatus(job.executionStatus)} colors={colors} />{job.actualCollectedWeight != null ? <Detail label="Actual collected weight" value={formatDriverWeight(job.actualCollectedWeight)} colors={colors} /> : null}{job.deliveredToYardAt ? <Detail label="Delivered to yard" value={`${formatDriverSchedule(job.deliveredToYardAt).date} at ${formatDriverSchedule(job.deliveredToYardAt).time}`} colors={colors} /> : null}</Section>
    {job.pickupNotes ? <Section title="Pickup Instructions" colors={colors}><Text style={[styles.instructions, { color: colors.text }]}>{job.pickupNotes}</Text></Section> : null}
  </ScreenScaffold>;
}

function Section({ title, colors, children }: { title: string; colors: (typeof semanticColors)[keyof typeof semanticColors]; children: React.ReactNode }) { return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Detail({ label, value, colors }: { label: string; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.detail}><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.value, { color: colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ content: { gap: spacing.md }, section: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.md }, sectionTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, customerName: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl }, detail: { gap: spacing.xs }, label: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs }, value: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: typography.lineHeight.md }, instructions: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: typography.lineHeight.md } });
