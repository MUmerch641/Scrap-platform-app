import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { AvailableDriverJobCard } from '@/features/driver/components/available-driver-job-card';
import { DriverJobCard } from '@/features/driver/components/driver-job-card';
import { notifyDriverJobsChanged, subscribeToDriverJobsChanged } from '@/features/driver/services/driver-job-refresh';
import { acceptDriverJob, DRIVER_JOB_PAGE_SIZE, DriverJobPageOptions, fetchAvailableDriverJobs, fetchDriverJobs, formatDriverLocalDate } from '@/features/driver/services/driver-job-service';
import { AvailableDriverJob, DriverExecutionStatus, DriverJob } from '@/features/driver/types';
import { showInfoMessage } from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

type JobsView = 'available' | 'mine';
type JobsFilter = 'today' | 'upcoming' | 'completed';
const FILTERS: { key: JobsFilter; label: string; icon: 'today-outline' | 'calendar-outline' | 'checkmark-done-outline' }[] = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
];
const OPEN_STATUSES: DriverExecutionStatus[] = ['assigned', 'en_route', 'arrived', 'material_collected'];
const ACTIVE_STATUSES: DriverExecutionStatus[] = ['en_route', 'arrived', 'material_collected'];

function tomorrow(): string { const date = new Date(); date.setDate(date.getDate() + 1); return formatDriverLocalDate(date); }
function emptyCopy(filter: JobsFilter) { return filter === 'today' ? ['No accepted jobs today', 'Jobs you accept for today will appear here.'] : filter === 'upcoming' ? ['No upcoming accepted jobs', 'Future jobs you accept will appear here.'] : ['No completed jobs yet', 'Delivered jobs will appear here as your history grows.']; }
function optionsFor(filter: JobsFilter, page: number): DriverJobPageOptions { return filter === 'today' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: formatDriverLocalDate(new Date()), scheduledTo: formatDriverLocalDate(new Date()), executionStatuses: OPEN_STATUSES } : filter === 'upcoming' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: tomorrow(), executionStatuses: ['assigned'] } : { page, pageSize: DRIVER_JOB_PAGE_SIZE, executionStatuses: ['delivered_to_yard'], sort: 'delivered_desc' }; }

export default function DriverJobsScreen() {
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [view, setView] = useState<JobsView>('available');
  const [filter, setFilter] = useState<JobsFilter>('today');
  const [availableJobs, setAvailableJobs] = useState<AvailableDriverJob[]>([]);
  const [availableHasMore, setAvailableHasMore] = useState(false);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const requestId = useRef(0);
  const acceptingRef = useRef<string | null>(null);

  const load = useCallback(async (refresh = false, quiet = false) => {
    if (isOffline) { setLoading(false); setRefreshing(false); return; }
    const id = ++requestId.current;
    if (refresh) setRefreshing(true); else if (!quiet) setLoading(true);
    setError(null);

    if (view === 'available') {
      const result = await fetchAvailableDriverJobs(0);
      if (id !== requestId.current) return;
      if (result.success) { setAvailableJobs(result.jobs); setAvailableHasMore(result.hasMore); }
      else setError(result.error ?? 'Unable to load available jobs.');
    } else {
      const [result, active] = await Promise.all([
        fetchDriverJobs(optionsFor(filter, 0)),
        filter === 'today' ? fetchDriverJobs({ page: 0, pageSize: 2, executionStatuses: ACTIVE_STATUSES }) : Promise.resolve(null),
      ]);
      if (id !== requestId.current) return;
      if (result.success) {
        const firstPageJobs = active?.success ? [...active.jobs, ...result.jobs.filter((job) => !active.jobs.some((activeJob) => activeJob.id === job.id))] : result.jobs;
        setJobs(firstPageJobs);
        setHasMore(result.hasMore);
      } else setError(result.error ?? 'Unable to load accepted jobs.');
    }

    if (!quiet) setLoading(false);
    setRefreshing(false);
  }, [filter, isOffline, view]);

  useFocusEffect(useCallback(() => { void load(); return () => { requestId.current += 1; }; }, [load]));
  React.useEffect(() => subscribeToDriverJobsChanged(() => load(false, true)), [load]);

  const loadMore = async () => {
    if (isOffline || loadingMore || loading || refreshing) return;
    if (view === 'available' && !availableHasMore) return;
    if (view === 'mine' && !hasMore) return;
    setLoadingMore(true);
    const id = ++requestId.current;
    if (view === 'available') {
      const result = await fetchAvailableDriverJobs(Math.ceil(availableJobs.length / DRIVER_JOB_PAGE_SIZE));
      if (id === requestId.current && result.success) {
        setAvailableJobs((previous) => [...previous, ...result.jobs.filter((job) => !previous.some((existing) => existing.id === job.id))]);
        setAvailableHasMore(result.hasMore);
      }
    } else {
      const result = await fetchDriverJobs(optionsFor(filter, Math.ceil(jobs.length / DRIVER_JOB_PAGE_SIZE)));
      if (id === requestId.current && result.success) {
        setJobs((previous) => [...previous, ...result.jobs.filter((job) => !previous.some((existing) => existing.id === job.id))]);
        setHasMore(result.hasMore);
      }
    }
    setLoadingMore(false);
  };

  const accept = async (jobId: string) => {
    if (isOffline || acceptingRef.current) return;
    acceptingRef.current = jobId;
    setAcceptingJobId(jobId);
    setNotice(null);
    const result = await acceptDriverJob(jobId);
    acceptingRef.current = null;
    setAcceptingJobId(null);

    if (!result.success) {
      if (result.failure === 'already-taken') setAvailableJobs((current) => current.filter((job) => job.id !== jobId));
      setNotice(result.error ?? 'Unable to accept this job. Refresh and try again.');
      notifyDriverJobsChanged();
      return;
    }

    setAvailableJobs((current) => current.filter((job) => job.id !== jobId));
    notifyDriverJobsChanged();
    showInfoMessage(result.alreadyAccepted ? 'This job is already assigned to you.' : 'Job accepted.');
    router.push({ pathname: '/(driver)/active-job', params: { pickupJobId: result.jobId ?? jobId } });
  };

  const visibleItems = view === 'available' ? availableJobs : jobs;
  const empty = emptyCopy(filter);
  const switchView = (next: JobsView) => {
    if (next === view) return;
    requestId.current += 1;
    setView(next);
    setError(null);
    setNotice(null);
    setLoading(true);
  };

  if (loading && !visibleItems.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Available and accepted pickups" />}><LoadingState message="Loading jobs..." /></ScreenScaffold>;
  if (isOffline && !visibleItems.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Available and accepted pickups" />}><OfflineState message="Connect to the internet to load jobs." onRetry={() => void load(true)} /></ScreenScaffold>;

  return (
    <ScreenScaffold mode="standard" header={<AppHeader title="Jobs" subtitle="Available and accepted pickups" />} contentContainerStyle={styles.screen}>
      <View style={[styles.viewBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ViewTab label="Available Jobs" icon="radio-outline" selected={view === 'available'} onPress={() => switchView('available')} colors={colors} />
        <ViewTab label="My Jobs" icon="briefcase-outline" selected={view === 'mine'} onPress={() => switchView('mine')} colors={colors} />
      </View>

      {view === 'mine' ? (
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            return <Pressable key={item.key} onPress={() => { setFilter(item.key); setJobs([]); setHasMore(false); setLoading(true); }} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.filter, selected && { backgroundColor: brandColors.navy }, pressed && styles.filterPressed]}><Ionicons name={item.icon} size={15} color={selected ? brandColors.lightCopper : colors.textMuted} /><Text style={[styles.filterText, { color: selected ? brandColors.white : colors.textMuted }]}>{item.label}</Text></Pressable>;
          })}
        </View>
      ) : null}

      {notice ? <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.warning }]}><Ionicons name="information-circle-outline" size={19} color={colors.warning} /><Text style={[styles.noticeText, { color: colors.text }]}>{notice}</Text></View> : null}

      {error && !visibleItems.length ? (
        <EmptyState title="Unable to load jobs" message={error} action={<Button title="Try Again" variant="outline" onPress={() => void load(true)} />} />
      ) : view === 'available' ? (
        <FlatList data={availableJobs} keyExtractor={(item) => item.id} renderItem={({ item }) => <AvailableDriverJobCard job={item} accepting={acceptingJobId === item.id} disabled={Boolean(acceptingJobId) || isOffline} onAccept={() => void accept(item.id)} />} contentContainerStyle={availableJobs.length ? styles.list : styles.empty} ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />} ListHeaderComponent={availableJobs.length ? <ListHeading title={`${availableJobs.length} ${availableJobs.length === 1 ? 'job' : 'jobs'} ready to accept`} colors={colors} /> : null} ListEmptyComponent={<EmptyPanel icon="radio-outline" title="No jobs available" message="New Operations-approved pickup jobs will appear here." colors={colors} />} onEndReached={() => void loadMore()} onEndReachedThreshold={0.4} ListFooterComponent={loadingMore ? <LoadingState message="Loading more jobs..." /> : null} />
      ) : (
        <FlatList data={jobs} keyExtractor={(item) => item.id} renderItem={({ item }) => <DriverJobCard job={item} prominent={ACTIVE_STATUSES.includes(item.executionStatus)} onPress={() => router.push({ pathname: '/(driver)/active-job', params: { jobId: item.id } })} />} contentContainerStyle={jobs.length ? styles.list : styles.empty} ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />} ListHeaderComponent={jobs.length ? <ListHeading title={`${jobs.length} accepted ${jobs.length === 1 ? 'pickup' : 'pickups'}`} colors={colors} /> : null} ListEmptyComponent={<EmptyPanel icon={filter === 'completed' ? 'checkmark-done-outline' : 'calendar-clear-outline'} title={empty[0]} message={empty[1]} colors={colors} />} onEndReached={() => void loadMore()} onEndReachedThreshold={0.4} ListFooterComponent={loadingMore ? <LoadingState message="Loading more jobs..." /> : null} />
      )}
    </ScreenScaffold>
  );
}

function ViewTab({ label, icon, selected, onPress, colors }: { label: string; icon: 'radio-outline' | 'briefcase-outline'; selected: boolean; onPress: () => void; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} style={({ pressed }) => [styles.viewTab, selected && { backgroundColor: brandColors.navy }, pressed && styles.filterPressed]}><Ionicons name={icon} size={17} color={selected ? brandColors.lightCopper : colors.textMuted} /><Text style={[styles.viewTabText, { color: selected ? brandColors.white : colors.textMuted }]}>{label}</Text></Pressable>; }
function ListHeading({ title, colors }: { title: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.listHeader}><Text style={[styles.listTitle, { color: colors.text }]}>{title}</Text></View>; }
function EmptyPanel({ icon, title, message, colors }: { icon: 'radio-outline' | 'checkmark-done-outline' | 'calendar-clear-outline'; title: string; message: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.emptyPanel}><View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}><Ionicons name={icon} size={32} color={colors.accent} /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text></View>; }

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  viewBar: { flexDirection: 'row', gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs },
  viewTab: { minHeight: 46, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  viewTabText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  filterBar: { flexDirection: 'row', gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs },
  filter: { minHeight: 42, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderRadius: radius.lg, paddingHorizontal: spacing.xs },
  filterPressed: { opacity: 0.72 },
  filterText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  noticeText: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  list: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  empty: { flexGrow: 1, justifyContent: 'center' },
  listHeader: { minHeight: 54, justifyContent: 'center', paddingBottom: spacing.md },
  listTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  emptyPanel: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl },
  emptyMessage: { maxWidth: 290, textAlign: 'center', fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
});
