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
import { DriverJobCard } from '@/features/driver/components/driver-job-card';
import { subscribeToDriverJobsChanged } from '@/features/driver/services/driver-job-refresh';
import { DRIVER_JOB_PAGE_SIZE, DriverJobPageOptions, fetchDriverJobs, formatDriverLocalDate } from '@/features/driver/services/driver-job-service';
import { DriverExecutionStatus, DriverJob } from '@/features/driver/types';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

type JobsFilter = 'today' | 'upcoming' | 'completed';
const FILTERS: { key: JobsFilter; label: string; icon: 'today-outline' | 'calendar-outline' | 'checkmark-done-outline' }[] = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
];
const OPEN_STATUSES: DriverExecutionStatus[] = ['assigned', 'en_route', 'arrived', 'material_collected'];
const ACTIVE_STATUSES: DriverExecutionStatus[] = ['en_route', 'arrived', 'material_collected'];

function tomorrow(): string { const date = new Date(); date.setDate(date.getDate() + 1); return formatDriverLocalDate(date); }
function emptyCopy(filter: JobsFilter) { return filter === 'today' ? ['No jobs today', 'Your pickups scheduled for today will appear here.'] : filter === 'upcoming' ? ['No upcoming jobs', 'Future Operations assignments will appear here.'] : ['No completed jobs yet', 'Delivered jobs will appear here as your history grows.']; }
function optionsFor(filter: JobsFilter, page: number): DriverJobPageOptions { return filter === 'today' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: formatDriverLocalDate(new Date()), scheduledTo: formatDriverLocalDate(new Date()), executionStatuses: OPEN_STATUSES } : filter === 'upcoming' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: tomorrow(), executionStatuses: ['assigned'] } : { page, pageSize: DRIVER_JOB_PAGE_SIZE, executionStatuses: ['delivered_to_yard'], sort: 'delivered_desc' }; }

export default function DriverJobsScreen() {
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [filter, setFilter] = useState<JobsFilter>('today');
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false, quiet = false) => {
    if (isOffline) { setLoading(false); setRefreshing(false); return; }
    const id = ++requestId.current;
    if (refresh) setRefreshing(true); else if (!quiet) setLoading(true);
    setError(null);
    const [result, active] = await Promise.all([
      fetchDriverJobs(optionsFor(filter, 0)),
      filter === 'today' ? fetchDriverJobs({ page: 0, pageSize: 2, executionStatuses: ACTIVE_STATUSES }) : Promise.resolve(null),
    ]);
    if (id !== requestId.current) return;
    if (result.success) {
      const firstPageJobs = active?.success
        ? [...active.jobs, ...result.jobs.filter((job) => !active.jobs.some((activeJob) => activeJob.id === job.id))]
        : result.jobs;
      setJobs(firstPageJobs);
      setHasMore(result.hasMore);
    } else if (!jobs.length) setError(result.error ?? 'Unable to load jobs.');
    if (!quiet) setLoading(false);
    setRefreshing(false);
  }, [filter, isOffline, jobs.length]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  React.useEffect(() => subscribeToDriverJobsChanged(() => load(false, true)), [load]);

  const loadMore = async () => {
    if (isOffline || !hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    const id = ++requestId.current;
    const result = await fetchDriverJobs(optionsFor(filter, Math.ceil(jobs.length / DRIVER_JOB_PAGE_SIZE)));
    if (id === requestId.current && result.success) {
      setJobs((previous) => [...previous, ...result.jobs.filter((job) => !previous.some((existing) => existing.id === job.id))]);
      setHasMore(result.hasMore);
    }
    setLoadingMore(false);
  };

  const empty = emptyCopy(filter);
  if (loading && !jobs.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Pickup schedule" />}><LoadingState message="Loading your schedule..." /></ScreenScaffold>;
  if (isOffline && !jobs.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Pickup schedule" />}><OfflineState message="Connect to the internet to load your jobs." onRetry={() => void load(true)} /></ScreenScaffold>;

  return (
    <ScreenScaffold mode="standard" header={<AppHeader title="Jobs" subtitle="Pickup schedule" />} contentContainerStyle={styles.screen}>
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => { setFilter(item.key); setJobs([]); setHasMore(false); }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.filter, selected && { backgroundColor: brandColors.navy }, pressed && styles.filterPressed]}
            >
              <Ionicons name={item.icon} size={15} color={selected ? brandColors.lightCopper : colors.textMuted} />
              <Text style={[styles.filterText, { color: selected ? brandColors.white : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && !jobs.length ? (
        <EmptyState title="Unable to load jobs" message={error} action={<Button title="Try Again" variant="outline" onPress={() => void load(true)} />} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DriverJobCard job={item} prominent={ACTIVE_STATUSES.includes(item.executionStatus)} onPress={() => router.push({ pathname: '/(driver)/active-job', params: { jobId: item.id } })} />}
          contentContainerStyle={jobs.length ? styles.list : styles.empty}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
          ListHeaderComponent={jobs.length ? <View style={styles.listHeader}><View><Text style={[styles.listEyebrow, { color: colors.accent }]}>{filter.toUpperCase()}</Text><Text style={[styles.listTitle, { color: colors.text }]}>{jobs.length} {jobs.length === 1 ? 'pickup' : 'pickups'}</Text></View>{isOffline ? <View style={styles.offlineBadge}><Ionicons name="cloud-offline-outline" size={14} color={colors.warning} /><Text style={[styles.offlineLabel, { color: colors.warning }]}>Offline</Text></View> : null}</View> : null}
          ListEmptyComponent={<View style={styles.emptyPanel}><View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}><Ionicons name={filter === 'completed' ? 'checkmark-done-outline' : 'calendar-clear-outline'} size={32} color={colors.accent} /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>{empty[0]}</Text><Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{empty[1]}</Text></View>}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <LoadingState message="Loading more jobs..." /> : null}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  filterBar: { flexDirection: 'row', gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xs },
  filter: { minHeight: 42, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderRadius: radius.lg, paddingHorizontal: spacing.xs },
  filterPressed: { opacity: 0.72 },
  filterText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: 11 },
  list: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  empty: { flexGrow: 1, justifyContent: 'center' },
  listHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md },
  listEyebrow: { fontFamily: typography.fontFamily.bodyBold, fontSize: 10, letterSpacing: 1 },
  listTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  offlineBadge: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  offlineLabel: { fontFamily: typography.fontFamily.bodyBold, fontSize: typography.fontSize.xs },
  emptyPanel: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl },
  emptyMessage: { maxWidth: 280, textAlign: 'center', fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
});
