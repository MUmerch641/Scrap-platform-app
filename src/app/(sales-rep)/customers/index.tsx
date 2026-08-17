import { Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    ListRenderItemInfo,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { AppHeader } from '@/components/ui/app-header';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BrandSpinner,
  CONTENT_LOADER_SIZE,
  LoadingState,
} from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { SearchField } from '@/components/ui/search-field';
import { StaggeredFadeIn } from '@/components/ui/staggered-fade-in';
import {
    CUSTOMER_STATUS_OPTIONS,
    CUSTOMER_TYPE_OPTIONS,
    Customer,
    CustomerStatus,
    CustomerType,
    fetchCustomersPage,
    PREFERRED_CONTACT_METHOD_OPTIONS,
    PreferredContactMethod,
} from '@/services/customer-service';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { OfflineState } from '@/components/ui/offline-state';
import {
    showInfoMessage,
} from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, statusColors, typography } from '@/shared/theme';

// ── Pagination config ─────────────────────────────────────────────────────────
const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;
// ─────────────────────────────────────────────────────────────────────────────

function formatCustomerStatus(status: CustomerStatus): string {
  return status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

// ── Customer row — stable render item for FlatList ───────────────────────────
interface CustomerRowProps {
  customer: Customer;
  onOpen: (customer: Customer) => void;
  onCreatePickup: (customer: Customer) => void;
}

function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return semanticColors[isDark ? 'dark' : 'light'];
}

function customerStatusTone(status: CustomerStatus, isDark: boolean) {
  const palette = statusColors[isDark ? 'dark' : 'light'];
  if (status === 'active_customer') return palette.success;
  if (status === 'inactive' || status === 'not_interested' || status === 'do_not_contact') return palette.danger;
  if (status === 'contacted') {
    return isDark
      ? { surface: 'rgba(121, 192, 229, 0.16)', text: '#BCE8FF', border: 'rgba(121, 192, 229, 0.42)' }
      : { surface: '#EDF7FC', text: '#075985', border: '#BAE6FD' };
  }
  return isDark
    ? { surface: 'rgba(230, 164, 107, 0.18)', text: '#F4C08F', border: 'rgba(230, 164, 107, 0.48)' }
    : { surface: '#FFF4E8', text: '#9A541D', border: '#F1C18C' };
}

const CustomerRow = React.memo(function CustomerRow({ customer, onOpen, onCreatePickup }: CustomerRowProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const statusTone = customerStatusTone(customer.customerStatus, isDark);
  return (
    <Pressable
      onPress={() => onOpen(customer)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${customer.name}, phone ${customer.phone}, address ${customer.address}`}
      accessibilityHint="Opens the customer record"
      style={({ pressed }) => [
        styles.customerTilePressable,
        pressed && styles.customerTilePressed,
      ]}
    >
      <Card style={styles.compactCustomerCard}>
        <View style={styles.cardHeaderRow}>
          <Text
            style={[styles.customerName, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {customer.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusTone.surface, borderColor: statusTone.border }]}>
            <Text style={[styles.statusText, { color: statusTone.text }]} numberOfLines={1}>{formatCustomerStatus(customer.customerStatus)}</Text>
          </View>
        </View>

        <View style={styles.iconRow}>
          <AppIcon name="call-outline" size={12} />
          <Text
            style={[styles.customerPhone, { color: colors.primary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {customer.phone}
          </Text>
        </View>

        <View style={styles.iconRow}>
          <AppIcon name="location-outline" size={12} />
          <Text
            style={[styles.customerAddress, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {customer.address}
          </Text>
        </View>

        {customer.contactPerson ? (
          <View style={styles.iconRow}>
            <AppIcon name="person-outline" size={12} />
            <Text
              style={[styles.customerEmail, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {customer.contactPerson}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={(event) => { event.stopPropagation(); onCreatePickup(customer); }}
          accessibilityRole="button"
          accessibilityLabel={`Create pickup for ${customer.name}`}
          style={({ pressed }) => [styles.createPickupAction, { borderColor: colors.border }, pressed && styles.customerTilePressed]}
        >
          <AppIcon name="create-outline" size={15} color={colors.primary} />
          <Text style={[styles.createPickupActionText, { color: colors.primary }]}>Create Pickup</Text>
        </Pressable>
      </Card>
    </Pressable>
  );
});

interface AnimatedCustomerRowProps {
  customer: Customer;
  index: number;
  runKey: number;
  onOpen: (customer: Customer) => void;
  onCreatePickup: (customer: Customer) => void;
}

const AnimatedCustomerRow = React.memo(function AnimatedCustomerRow({
  customer,
  index,
  runKey,
  onOpen,
  onCreatePickup,
}: AnimatedCustomerRowProps) {
  return (
    <StaggeredFadeIn index={index} runKey={runKey}>
      <CustomerRow customer={customer} onOpen={onOpen} onCreatePickup={onCreatePickup} />
    </StaggeredFadeIn>
  );
}, (previous, next) => (
  previous.customer === next.customer
  && previous.index === next.index
  && previous.runKey === next.runKey
  && previous.onOpen === next.onOpen
  && previous.onCreatePickup === next.onCreatePickup
));
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isOffline } = useNetworkStatus();

  // ── List state ─────────────────────────────────────────────────────────────
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [searching, setSearching]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [listAnimationKey, setListAnimationKey] = useState(0);
  const currentPageRef              = useRef(0);
  const activeSearchRef             = useRef('');
  const searchDebounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef          = useRef(0);
  const isLoadingMoreRef            = useRef(false);
  const hasLoadedRef                = useRef(false);
  const hasRecordsRef               = useRef(false);
  // ──────────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────────

  // ── Data fetching ──────────────────────────────────────────────────────────
  const loadPage = useCallback(async (
    searchTerm: string,
    page: number,
    append: boolean,
    isRefresh = false,
  ) => {
    const requestSequence = ++requestSequenceRef.current;
    if (isOffline) {
      setLoading(false);
      setSearching(false);
      setRefreshing(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
      if (!hasRecordsRef.current) setLoadError('No internet connection.');
      return;
    }
    if (isRefresh) setRefreshing(true);
    else if (page === 0 && !append) {
      if (hasLoadedRef.current) setSearching(true);
      else setLoading(true);
    }
    else {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
    }

    if (append) setLoadMoreError(null);
    else setLoadError(null);

    const result = await fetchCustomersPage(
      searchTerm,
      page,
      PAGE_SIZE,
      page === 0,
    );

    if (requestSequence !== requestSequenceRef.current) return;

    setLoading(false);
    setSearching(false);
    setRefreshing(false);
    setLoadingMore(false);
    isLoadingMoreRef.current = false;
    hasLoadedRef.current = true;

    if (!result.success) {
      const message = result.error ?? 'Failed to load customers.';
      if (append) setLoadMoreError(message);
      else if (!hasRecordsRef.current) {
        setCustomers([]);
        setHasMore(false);
        setTotalCount(null);
        setLoadError(message);
      } else {
        setLoadError(message);
      }
      return;
    }

    setHasMore(result.hasMore);
    if (page === 0) setTotalCount(result.totalCount ?? result.customers.length);
    if (page === 0 && !append) {
      setListAnimationKey((currentValue) => currentValue + 1);
    }
    currentPageRef.current = page;
    setCustomers((previous) => {
      if (!append) {
        hasRecordsRef.current = result.customers.length > 0;
        return result.customers;
      }
      const existingIds = new Set(previous.map((customer) => customer.id));
      const nextCustomers = [
        ...previous,
        ...result.customers.filter((customer) => !existingIds.has(customer.id)),
      ];
      hasRecordsRef.current = nextCustomers.length > 0;
      return nextCustomers;
    });
  }, [isOffline]);

  const reload = useCallback((term: string) => {
    activeSearchRef.current = term;
    setTotalCount(null);
    void loadPage(term, 0, false);
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      reload(activeSearchRef.current);
      return () => {
        requestSequenceRef.current += 1;
        isLoadingMoreRef.current = false;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      };
    }, [reload])
  );

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (isOffline) return;
    setSearching(true);
    setTotalCount(null);
    requestSequenceRef.current += 1;
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
    setRefreshing(false);
    setLoadMoreError(null);
    setLoadError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      reload(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleLoadMore = () => {
    if (isOffline || isLoadingMoreRef.current || loadingMore || !hasMore) return;
    void loadPage(activeSearchRef.current, currentPageRef.current + 1, true);
  };

  const handleRefresh = () => {
    requestSequenceRef.current += 1;
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
    void loadPage(activeSearchRef.current, 0, false, true);
  };

  React.useEffect(() => () => {
    requestSequenceRef.current += 1;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────────

  const renderRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Customer>) => (
      <AnimatedCustomerRow
        customer={item}
        index={index}
        runKey={listAnimationKey}
        onOpen={(customer) => router.push({ pathname: '/(sales-rep)/customers/[id]', params: { id: customer.id } } as unknown as Href)}
        onCreatePickup={(customer) => router.push({ pathname: '/(sales-rep)/create-job', params: { customerId: customer.id } })}
      />
    ),
    [listAnimationKey, router],
  );

  const countLabel = totalCount === null
    ? (searching ? 'Searching...' : 'Customers')
    : `${totalCount.toLocaleString()} ${
        search.trim()
          ? (totalCount === 1 ? 'Match' : 'Matches')
          : (totalCount === 1 ? 'Customer' : 'Customers')
      }`;

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <BrandSpinner size={24} accessibilityLabel="Loading more customers" />
    </View>
  ) : loadMoreError ? (
    <View style={styles.listErrorContainer}>
      <Text style={[styles.inlineErrorText, { color: colors.danger }]}>
        {loadMoreError}
      </Text>
      <Button
        title="Retry"
        variant="outline"
        onPress={handleLoadMore}
        style={styles.retryButton}
      />
    </View>
  ) : null;

  return (
    <ScreenScaffold
      mode="standard"
      contentContainerStyle={styles.screenContent}
      header={
        <AppHeader
          title="Customers"
          subtitle="Customer directory"
          compact
          rightAction={
            <Pressable
              onPress={() => router.push('/(sales-rep)/customers/form')}
              hitSlop={5}
              accessibilityRole="button"
              accessibilityLabel="Add customer"
              accessibilityHint="Opens the new customer form"
              android_ripple={{
                color: 'rgba(230, 164, 107, 0.22)',
                borderless: false,
              }}
              style={({ pressed }) => [
                styles.headerAddButton,
                {
                  borderColor: brandColors.lightCopper,
                  backgroundColor: pressed
                    ? 'rgba(230, 164, 107, 0.22)'
                    : 'rgba(230, 164, 107, 0.10)',
                  opacity: Platform.OS === 'ios' && pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text style={styles.headerAddText}>+ Add</Text>
            </Pressable>
          }
        />
      }
    >
      <View style={styles.directoryTools}>
        <SearchField
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search name, phone or email"
          compact
        />
        <View style={styles.directoryMetaRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.listCountText, { color: colors.textMuted }]}
          >
            {countLabel}
          </Text>
          {searching ? (
            <BrandSpinner size={20} accessibilityLabel="Searching customers" />
          ) : null}
        </View>
      </View>

      {loading ? (
        <LoadingState message="Loading customer directory..." />
      ) : isOffline && customers.length === 0 ? (
        <OfflineState
          message="Connect to the internet to load your customers."
          onRetry={handleRefresh}
        />
      ) : (
        <FlatList
          style={styles.list}
          data={customers}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          ListHeaderComponent={!isOffline && loadError && customers.length > 0 ? (
            <View style={styles.listErrorContainer}>
              <Text style={[styles.inlineErrorText, { color: colors.danger }]}>{loadError}</Text>
              <Button title="Retry" variant="outline" onPress={handleRefresh} style={styles.retryButton} />
            </View>
          ) : null}
          ListEmptyComponent={
            isOffline ? (
              <OfflineState
                message="Connect to the internet to load your customers."
                onRetry={handleRefresh}
              />
            ) : loadError ? (
              <View style={styles.listErrorContainer}>
                <Text style={[styles.inlineErrorText, { color: colors.danger }]}>
                  {loadError}
                </Text>
                <Button
                  title="Retry"
                  variant="outline"
                  onPress={() => reload(activeSearchRef.current)}
                  style={styles.retryButton}
                />
              </View>
            ) : searching ? (
              <View style={styles.emptyListLoading}>
                <BrandSpinner
                  size={CONTENT_LOADER_SIZE}
                  accessibilityLabel="Searching customers"
                />
              </View>
            ) : search.trim() ? (
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
                {`No customers match "${search.trim()}"`}
              </Text>
            ) : (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  title="No customers found"
                  message="Your customer directory will appear here. Add your first customer to get started."
                  action={
                    <Button
                      title="Add Customer"
                      onPress={() => router.push('/(sales-rep)/customers/form')}
                      variant="primary"
                    />
                  }
                  variant="dashboard"
                />
              </View>
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
          removeClippedSubviews
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0,
  },
  list: {
    flex: 1,
  },
  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
    paddingTop: 2,
    paddingBottom: 0,
    gap: spacing.xs,
  },
  directoryTools: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  directoryMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listCountText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyListLoading: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  noResultsText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingTop: spacing.xl,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  listErrorContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  inlineErrorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 112,
  },
  emptyWrapper: {
    flex: 1,
  },

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── Header button ──────────────────────────────────────────────────────────
  headerAddButton: {
    minHeight: 34,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAddText: {
    color: brandColors.offWhite,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },

  // ── Customer card ──────────────────────────────────────────────────────────
  customerTilePressable: {
    borderRadius: radius.md,
  },
  customerTilePressed: {
    transform: [{ scale: 0.995 }],
  },
  compactCustomerCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.md,
    gap: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: typography.lineHeight.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  statusBadge: { flexShrink: 1, maxWidth: '46%', minHeight: 24, justifyContent: 'center', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm },
  customerName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: 15,
    lineHeight: typography.lineHeight.sm,
  },
  customerPhone: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerAddress: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerEmail: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerNotes: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontStyle: 'italic',
  },
  statusText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  createPickupAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  createPickupActionText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
  },
});
