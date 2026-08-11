import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { semanticColors, spacing, typography } from '@/shared/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DriverJobCard } from '@/features/driver/components/driver-job-card';
import { DRIVER_JOB_PAGE_SIZE, DriverJobPageOptions, fetchDriverJobs, formatDriverLocalDate } from '@/features/driver/services/driver-job-service';
import { DriverExecutionStatus, DriverJob } from '@/features/driver/types';

type JobsFilter = 'today' | 'upcoming' | 'completed';
const FILTERS: { key: JobsFilter; label: string }[] = [{ key: 'today', label: 'Today' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'completed', label: 'Completed' }];
const OPEN_STATUSES: DriverExecutionStatus[] = ['assigned', 'en_route', 'arrived', 'material_collected'];
const ACTIVE_STATUSES: DriverExecutionStatus[] = ['en_route', 'arrived', 'material_collected'];

function tomorrow(): string { const date = new Date(); date.setDate(date.getDate() + 1); return formatDriverLocalDate(date); }
function emptyCopy(filter: JobsFilter) { return filter === 'today' ? ['No jobs today', 'Your jobs scheduled for today will appear here.'] : filter === 'upcoming' ? ['No upcoming jobs', 'Future Operations assignments will appear here.'] : ['No completed jobs yet', 'Delivered jobs will appear here.']; }
function optionsFor(filter: JobsFilter, page: number): DriverJobPageOptions { return filter === 'today' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: formatDriverLocalDate(new Date()), scheduledTo: formatDriverLocalDate(new Date()), executionStatuses: OPEN_STATUSES } : filter === 'upcoming' ? { page, pageSize: DRIVER_JOB_PAGE_SIZE, scheduledFrom: tomorrow(), executionStatuses: ['assigned'] } : { page, pageSize: DRIVER_JOB_PAGE_SIZE, executionStatuses: ['delivered_to_yard'], sort: 'delivered_desc' }; }

export default function DriverJobsScreen() {
  const router = useRouter(); const { isOffline } = useNetworkStatus(); const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [filter, setFilter] = useState<JobsFilter>('today'); const [jobs, setJobs] = useState<DriverJob[]>([]); const [hasMore, setHasMore] = useState(false); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState<string | null>(null); const requestId = useRef(0);
  const load = useCallback(async (refresh = false) => { if (isOffline) { setLoading(false); setRefreshing(false); return; } const id = ++requestId.current; if (refresh) setRefreshing(true); else setLoading(true); setError(null); const [result, active] = await Promise.all([fetchDriverJobs(optionsFor(filter, 0)), filter === 'today' ? fetchDriverJobs({ page: 0, pageSize: 2, executionStatuses: ACTIVE_STATUSES }) : Promise.resolve(null)]); if (id !== requestId.current) return; if (result.success) { const firstPageJobs = active?.success ? [...active.jobs, ...result.jobs.filter(job => !active.jobs.some(activeJob => activeJob.id === job.id))] : result.jobs; setJobs(firstPageJobs); setHasMore(result.hasMore); } else if (!jobs.length) setError(result.error ?? 'Unable to load jobs.'); setLoading(false); setRefreshing(false); }, [filter, isOffline, jobs.length]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const loadMore = async () => { if (isOffline || !hasMore || loadingMore || loading || refreshing) return; setLoadingMore(true); const id = ++requestId.current; const result = await fetchDriverJobs(optionsFor(filter, Math.ceil(jobs.length / DRIVER_JOB_PAGE_SIZE))); if (id === requestId.current && result.success) { setJobs(previous => [...previous, ...result.jobs.filter(job => !previous.some(existing => existing.id === job.id))]); setHasMore(result.hasMore); } setLoadingMore(false); };
  const title = emptyCopy(filter);
  if (loading && !jobs.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Your assigned pickups" />}><LoadingState message="Loading your jobs..." /></ScreenScaffold>;
  if (isOffline && !jobs.length) return <ScreenScaffold header={<AppHeader title="Jobs" subtitle="Your assigned pickups" />}><OfflineState message="Connect to the internet to load your jobs." onRetry={() => void load(true)} /></ScreenScaffold>;
  return <ScreenScaffold mode="standard" header={<AppHeader title="Jobs" subtitle="Your assigned pickups" />} contentContainerStyle={styles.screen}><View style={styles.filters}>{FILTERS.map(item => <Pressable key={item.key} onPress={() => { setFilter(item.key); setJobs([]); setHasMore(false); }} style={[styles.filter, { borderColor: colors.border, backgroundColor: filter === item.key ? colors.surfaceSelected : colors.surface }]} accessibilityRole="button"><Text style={[styles.filterText, { color: filter === item.key ? colors.onPrimary : colors.text }]}>{item.label}</Text></Pressable>)}</View>{error && !jobs.length ? <EmptyState title="Unable to load jobs" message={error} action={<Button title="Retry" variant="outline" onPress={() => void load(true)} />} /> : <FlatList data={jobs} keyExtractor={item => item.id} renderItem={({ item }) => <DriverJobCard job={item} onPress={() => router.push({ pathname: '/(driver)/active-job', params: { jobId: item.id } })} />} contentContainerStyle={jobs.length ? styles.list : styles.empty} ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />} ListEmptyComponent={<EmptyState title={title[0]} message={title[1]} variant="inline" />} onEndReached={() => void loadMore()} onEndReachedThreshold={0.4} ListFooterComponent={loadingMore ? <LoadingState message="Loading more jobs..." /> : null} />}</ScreenScaffold>;
}
const styles = StyleSheet.create({ screen: { padding: spacing.md, gap: spacing.md }, filters: { flexDirection: 'row', gap: spacing.xs }, filter: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 8 }, filterText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm }, list: { paddingBottom: spacing.xl }, empty: { flexGrow: 1, justifyContent: 'center' } });
