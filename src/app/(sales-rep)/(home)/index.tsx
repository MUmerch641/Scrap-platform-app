import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
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
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { useUserRole } from '@/context/UserRoleContext';
import { PickupListCard } from '@/components/pickups/pickup-list-card';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import {
    fetchPickupDashboard,
    PickupMetrics,
    PickupRequest,
} from '@/services/pickup-service';
import { semanticColors, spacing, typography } from '@/shared/theme';

// ── Animation constants ───────────────────────────────────────────────────────
const STAGGER_MS = 65;
const DURATION_MS = 340;
const EASE = Easing.out(Easing.cubic);

// Stagger order — each slot × STAGGER_MS = delay
const S_GREETING    = 0;
const S_BUTTON      = 1;
const S_SEC_METRICS = 2;
const S_CARD_0      = 3; // Pending  / Scheduled (row 1 left, row 2 left)
const S_CARD_1      = 4; // Approved / Completed (row 1 right, row 2 right)
const S_SEC_RECENT  = 5;
const S_RECENT_CARD = 6;
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_METRICS: PickupMetrics = {
  pending: 0,
  approved: 0,
  scheduled: 0,
  completed: 0,
};

// ── FadeSlide — entrance fade + subtle upward slide ──────────────────────────
interface FadeSlideProps {
  children: React.ReactNode;
  delay: number;
}

function FadeSlide({ children, delay }: FadeSlideProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  React.useEffect(() => {
    const cfg = { duration: DURATION_MS, easing: EASE };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(0, cfg));
  // shared values are stable refs — no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── MetricCard — fade + pop scale on entrance ────────────────────────────────
interface MetricCardProps {
  label: string;
  count: number;
  delay: number;
}

function MetricCard({ label, count, delay }: MetricCardProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.94);

  React.useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION_MS, easing: EASE }));
    scale.value   = withDelay(delay, withSpring(1, { mass: 0.5, stiffness: 240, damping: 20 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    flex: 1,
  }));

  return (
    <Animated.View style={animStyle}>
      <Card style={styles.metricCard}>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: colors.text }]}>{count}</Text>
      </Card>
    </Animated.View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SalesRepHomeScreen() {
  const router      = useRouter();
  const { userProfile } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const colors      = semanticColors[isDark ? 'dark' : 'light'];

  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [metrics,  setMetrics]  = useState<PickupMetrics>(DEFAULT_METRICS);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const hasRecentRef = useRef(false);

  const loadData = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    setLoadingRecent(!hasRecentRef.current);
    setRecentError(null);
    setMetricsError(null);
    const result = await fetchPickupDashboard();
    if (requestSequence !== requestSequenceRef.current) return;

    setLoadingRecent(false);
    if (result.requestsSuccess) {
      setRequests(result.requests);
      hasRecentRef.current = result.requests.length > 0;
    } else {
      setRecentError(result.requestsError ?? 'Unable to load recent pickups.');
    }
    if (result.metricsSuccess) {
      setMetrics(result.metrics);
    } else {
      setMetricsError(result.metricsError ?? 'Unable to load pickup counts.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return () => {
        requestSequenceRef.current += 1;
      };
    }, [loadData])
  );

  const handleCreatePickup = () => {
    router.push('/(sales-rep)/create-job');
  };

  const handleViewAllPickups = () => {
    router.push('/(sales-rep)/(home)/pickups');
  };

  const handlePickupPress = (pickup: PickupRequest) => {
    router.push({
      pathname: '/(sales-rep)/(home)/pickup/[id]',
      params: { id: pickup.id },
    });
  };

  const fullName      = userProfile?.fullName?.trim();
  const firstName     = fullName ? fullName.split(' ')[0] : undefined;
  const greetingTitle = firstName ? `Welcome back ${firstName}` : 'Welcome back';

  return (
    <ScreenScaffold
      mode="scroll"
      header={<AppHeader title="Home" subtitle="Sales workspace" />}
    >
      <View style={styles.container}>

        {/* ── Greeting ───────────────────────────────────────────────────── */}
        <FadeSlide delay={S_GREETING * STAGGER_MS}>
          <View style={styles.greetingHeader}>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>
              {greetingTitle}
            </Text>
            <Text style={[styles.greetingSubtitle, { color: colors.textMuted }]}>
              Create and track customer pickup requests
            </Text>
          </View>
        </FadeSlide>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <FadeSlide delay={S_BUTTON * STAGGER_MS}>
          <Button
            title="Create Pickup"
            onPress={handleCreatePickup}
            variant="primary"
            style={styles.ctaButton}
          />
        </FadeSlide>

        {/* ── Section header: Pickup Requests ────────────────────────────── */}
        <FadeSlide delay={S_SEC_METRICS * STAGGER_MS}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup Requests</Text>
          </View>
        </FadeSlide>

        {/* ── Metric cards — individually staggered ──────────────────────── */}
        <View style={styles.metricsGrid}>
          <View style={styles.gridRow}>
            <MetricCard label="Pending"  count={metrics.pending}   delay={S_CARD_0 * STAGGER_MS} />
            <MetricCard label="Approved" count={metrics.approved}  delay={S_CARD_1 * STAGGER_MS} />
          </View>
          <View style={styles.gridRow}>
            <MetricCard label="Scheduled" count={metrics.scheduled} delay={S_CARD_0 * STAGGER_MS} />
            <MetricCard label="Completed" count={metrics.completed} delay={S_CARD_1 * STAGGER_MS} />
          </View>
        </View>
        {metricsError ? (
          <Button title="Retry counts" variant="outline" onPress={() => void loadData()} />
        ) : null}

        {/* ── Section header: Recent Pickups ─────────────────────────────── */}
        <FadeSlide delay={S_SEC_RECENT * STAGGER_MS}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Pickups</Text>
            <Pressable
              onPress={handleViewAllPickups}
              accessibilityRole="button"
              accessibilityLabel="View all pickup requests"
              hitSlop={8}
              style={({ pressed }) => [
                styles.viewAllButton,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
            </Pressable>
          </View>
        </FadeSlide>

        {/* ── Recent pickups content ─────────────────────────────────────── */}
        <FadeSlide delay={S_RECENT_CARD * STAGGER_MS}>
          {loadingRecent ? (
            <LoadingState message="Loading recent pickups…" />
          ) : recentError && requests.length === 0 ? (
            <EmptyState
              title="Could not load recent pickups"
              message={recentError}
              action={<Button title="Retry" variant="outline" onPress={() => void loadData()} />}
              variant="inline"
            />
          ) : requests.length === 0 ? (
            <Card style={styles.recentPickupsCard}>
              <EmptyState
                title="No pickup requests yet"
                message="Create your first pickup request to get started."
                variant="inline"
              />
            </Card>
          ) : (
            <View style={styles.requestList}>
              {recentError ? (
                <Button title="Retry recent pickups" variant="outline" onPress={() => void loadData()} />
              ) : null}
              {requests.map((request) => (
                <PickupListCard
                  key={request.id}
                  pickup={request}
                  onPress={handlePickupPress}
                />
              ))}
            </View>
          )}
        </FadeSlide>

      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  greetingHeader: {
    paddingVertical: spacing.xs,
    gap: spacing.xs / 2,
  },
  greetingTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.lg,
  },
  greetingSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  ctaButton: {
    marginVertical: spacing.xs / 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: -(spacing.xs / 2),
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  viewAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    marginVertical: -spacing.sm,
  },
  viewAllText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  metricsGrid: {
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  metricLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
  },
  metricValue: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.xl,
  },
  recentPickupsCard: {
    paddingVertical: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  requestList: {
    gap: spacing.sm,
  },
  requestCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  reqCustomerName: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  reqDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs / 2,
  },
  reqMeta: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
  },
  reqAddress: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  reqAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
  },
});
