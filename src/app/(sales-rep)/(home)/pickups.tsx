import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { PickupListCard } from '@/components/pickups/pickup-list-card';
import { PICKUP_STATUS_FILTERS } from '@/components/pickups/pickup-status-badge';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BrandSpinner,
  CONTENT_LOADER_SIZE,
  LoadingState,
} from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { SearchField } from '@/components/ui/search-field';
import { StaggeredFadeIn } from '@/components/ui/staggered-fade-in';
import { OfflineState } from '@/components/ui/offline-state';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import {
  fetchPickupRequestsPage,
  PickupRequest,
  PickupStatusFilter,
} from '@/services/pickup-service';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

interface AnimatedPickupRowProps {
  pickup: PickupRequest;
  index: number;
  runKey: number;
  onPress: (pickup: PickupRequest) => void;
}

const AnimatedPickupRow = React.memo(function AnimatedPickupRow({
  pickup,
  index,
  runKey,
  onPress,
}: AnimatedPickupRowProps) {
  return (
    <StaggeredFadeIn index={index} runKey={runKey}>
      <PickupListCard pickup={pickup} onPress={onPress} />
    </StaggeredFadeIn>
  );
}, (previous, next) => (
  previous.pickup === next.pickup
  && previous.index === next.index
  && previous.runKey === next.runKey
  && previous.onPress === next.onPress
));

export default function MyPickupsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isOffline } = useNetworkStatus();

  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PickupStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [listAnimationKey, setListAnimationKey] = useState(0);

  const currentPageRef = useRef(0);
  const activeSearchRef = useRef('');
  const activeStatusRef = useRef<PickupStatusFilter>('all');
  const requestSequenceRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingMoreRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasRecordsRef = useRef(false);

  const loadPage = useCallback(async (
    searchTerm: string,
    statusFilter: PickupStatusFilter,
    page: number,
    append: boolean,
    isRefresh = false,
  ) => {
    const requestSequence = ++requestSequenceRef.current;

    if (isOffline) {
      setLoading(false);
      setQuerying(false);
      setRefreshing(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
      if (!hasRecordsRef.current) setLoadError('No internet connection.');
      return;
    }

    if (append) {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
      setLoadMoreError(null);
    } else if (isRefresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else if (hasLoadedRef.current) {
      setLoading(false);
      setQuerying(true);
      setLoadError(null);
      setRefreshError(null);
    } else {
      setLoading(true);
      setQuerying(false);
      setLoadError(null);
    }

    const result = await fetchPickupRequestsPage({
      search: searchTerm,
      status: statusFilter,
      page,
      pageSize: PAGE_SIZE,
      includeTotalCount: page === 0,
    });

    if (requestSequence !== requestSequenceRef.current) return;

    setLoading(false);
    setQuerying(false);
    setRefreshing(false);
    setLoadingMore(false);
    isLoadingMoreRef.current = false;
    hasLoadedRef.current = true;

    if (!result.success) {
      const message = result.error ?? 'Unable to load pickup requests.';
      if (append) {
        setLoadMoreError(message);
      } else if (hasRecordsRef.current || isRefresh) {
        setRefreshError(message);
      } else {
        setRequests([]);
        setHasMore(false);
        setTotalCount(null);
        setLoadError(message);
      }
      return;
    }

    setRefreshError(null);
    setHasMore(result.hasMore);
    if (page === 0) setTotalCount(result.totalCount ?? null);
    if (page === 0 && !append) {
      setListAnimationKey((currentValue) => currentValue + 1);
    }
    currentPageRef.current = page;
    setRequests((previous) => {
      const existingIds = new Set(previous.map((request) => request.id));
      const nextRequests = append
        ? [
            ...previous,
            ...result.requests.filter((request) => !existingIds.has(request.id)),
          ]
        : result.requests;
      hasRecordsRef.current = nextRequests.length > 0;
      return nextRequests;
    });
  }, [isOffline]);

  const reload = useCallback((
    searchTerm: string,
    statusFilter: PickupStatusFilter,
    isRefresh = false,
  ) => {
    activeSearchRef.current = searchTerm;
    activeStatusRef.current = statusFilter;
    setTotalCount(null);
    void loadPage(searchTerm, statusFilter, 0, false, isRefresh);
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      isLoadingMoreRef.current = false;
      setLoadingMore(false);
      setRefreshing(false);
      reload(activeSearchRef.current, activeStatusRef.current);
      return () => {
        requestSequenceRef.current += 1;
        isLoadingMoreRef.current = false;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      };
    }, [reload]),
  );

  React.useEffect(() => () => {
    requestSequenceRef.current += 1;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const resetInFlightState = () => {
    requestSequenceRef.current += 1;
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
    setRefreshing(false);
    setLoadMoreError(null);
    setRefreshError(null);
  };

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (isOffline) return;
    activeSearchRef.current = text.trim();
    setQuerying(true);
    setTotalCount(null);
    resetInFlightState();
    setLoadError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      reload(activeSearchRef.current, activeStatusRef.current);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleStatusChange = (nextStatus: PickupStatusFilter) => {
    if (nextStatus === status) return;
    if (isOffline) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    resetInFlightState();
    setStatus(nextStatus);
    activeStatusRef.current = nextStatus;
    setLoadError(null);
    reload(search.trim(), nextStatus);
  };

  const handleRefresh = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    resetInFlightState();
    reload(search.trim(), activeStatusRef.current, true);
  };

  const handleLoadMore = () => {
    if (isOffline || isLoadingMoreRef.current || loadingMore || !hasMore || querying || refreshing) return;
    void loadPage(
      activeSearchRef.current,
      activeStatusRef.current,
      currentPageRef.current + 1,
      true,
    );
  };

  const handlePickupPress = useCallback((pickup: PickupRequest) => {
    router.push({
      pathname: '/(sales-rep)/(home)/pickup/[id]',
      params: { id: pickup.id },
    });
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PickupRequest>) => (
      <AnimatedPickupRow
        pickup={item}
        index={index}
        runKey={listAnimationKey}
        onPress={handlePickupPress}
      />
    ),
    [handlePickupPress, listAnimationKey],
  );

  const countLabel = totalCount === null
    ? (querying ? 'Searching...' : 'Pickups')
    : `${totalCount.toLocaleString()} ${
        search.trim() || status !== 'all'
          ? (totalCount === 1 ? 'Result' : 'Results')
          : (totalCount === 1 ? 'Pickup' : 'Pickups')
      }`;

  const isFiltered = Boolean(search.trim()) || status !== 'all';

  const listFooter = loadingMore ? (
    <View style={styles.footerContainer}>
      <BrandSpinner size={24} accessibilityLabel="Loading more pickups" />
    </View>
  ) : !isOffline && loadMoreError ? (
    <View style={styles.footerContainer}>
      <Text style={[styles.errorText, { color: colors.danger }]}>{loadMoreError}</Text>
      <Button title="Retry" variant="outline" onPress={handleLoadMore} style={styles.retryButton} />
    </View>
  ) : requests.length > 0 && !hasMore ? (
    <Text style={[styles.endText, { color: colors.textMuted }]}>All pickups loaded</Text>
  ) : null;

  return (
    <ScreenScaffold
      mode="standard"
      contentContainerStyle={styles.screenContent}
      header={(
        <AppHeader
          title="My Pickups"
          subtitle="Your submitted pickup requests"
          onBack={() => router.back()}
          backIconOnly
          compact
        />
      )}
    >
      <View style={styles.tools}>
        <SearchField
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search customer, phone, address or material"
          compact
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filterContent}
        >
          {PICKUP_STATUS_FILTERS.map((filter) => {
            const selected = filter.value === status;
            return (
              <Pressable
                key={filter.value}
                onPress={() => handleStatusChange(filter.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter by ${filter.label}`}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: selected ? colors.surfaceSelected : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: selected ? colors.onPrimary : colors.textMuted },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.metaRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.countText, { color: colors.textMuted }]}
          >
            {countLabel}
          </Text>
        </View>

        {!isOffline && refreshError ? (
          <Pressable
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Retry refreshing pickups"
            style={styles.inlineErrorRow}
          >
            <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>
              {refreshError} Tap to retry.
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <LoadingState message="Loading pickups..." />
      ) : isOffline && requests.length === 0 ? (
        <OfflineState
          message="Connect to the internet to load your pickups."
          onRetry={handleRefresh}
        />
      ) : (
        <FlatList
          style={styles.list}
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            isOffline ? (
              <OfflineState
                message="Connect to the internet to load your pickups."
                onRetry={handleRefresh}
              />
            ) : loadError ? (
              <View style={styles.errorState}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{loadError}</Text>
                <Button
                  title="Retry"
                  variant="outline"
                  onPress={() => reload(activeSearchRef.current, activeStatusRef.current)}
                  style={styles.retryButton}
                />
              </View>
            ) : querying ? (
              <View style={styles.emptyLoading}>
                <BrandSpinner
                  size={CONTENT_LOADER_SIZE}
                  accessibilityLabel="Searching pickups"
                />
              </View>
            ) : isFiltered ? (
              <EmptyState
                title="No pickups match this filter"
                message="Try another status or search term."
                variant="inline"
              />
            ) : (
              <EmptyState
                title="No pickup requests yet"
                message="Create your first pickup request to get started."
                action={(
                  <Button
                    title="Create Pickup"
                    variant="primary"
                    onPress={() => router.push('/(sales-rep)/create-job')}
                  />
                )}
                variant="inline"
              />
            )
          }
          ListFooterComponent={listFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0,
  },
  tools: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterContent: {
    gap: spacing.xs,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  filterText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  metaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inlineErrorRow: {
    minHeight: 36,
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  emptyLoading: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  errorState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  footerContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  retryButton: {
    minWidth: 112,
  },
  endText: {
    paddingVertical: spacing.md,
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
});
