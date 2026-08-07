import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
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

import { useUserRole } from '@/app/context/UserRoleContext';
import { AppHeader } from '@/components/ui/app-header';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { StatusBadge, StatusVariant } from '@/components/ui/status-badge';
import {
    fetchPickupRequests,
    PickupMetrics,
    PickupRequest,
    PickupRequestStatus,
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

function getStatusBadgeVariant(status: PickupRequestStatus): { label: string; variant: StatusVariant } {
  switch (status) {
    case 'pending_review': return { label: 'Pending',   variant: 'warning' };
    case 'approved':       return { label: 'Approved',  variant: 'success' };
    case 'scheduled':      return { label: 'Scheduled', variant: 'neutral' };
    case 'completed':      return { label: 'Completed', variant: 'success' };
    case 'rejected':       return { label: 'Rejected',  variant: 'danger'  };
    default:               return { label: status,      variant: 'neutral' };
  }
}

export default function SalesRepHomeScreen() {
  const router      = useRouter();
  const { userProfile } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const colors      = semanticColors[isDark ? 'dark' : 'light'];

  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [metrics,  setMetrics]  = useState<PickupMetrics>(DEFAULT_METRICS);
  const [loading,  setLoading]  = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await fetchPickupRequests();
    setLoading(false);
    if (result.success) {
      setRequests(result.requests);
      setMetrics(result.metrics);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleCreatePickup = () => {
    router.push('/(sales-rep)/create-job');
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

        {/* ── Section header: Recent Pickups ─────────────────────────────── */}
        <FadeSlide delay={S_SEC_RECENT * STAGGER_MS}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Pickups</Text>
          </View>
        </FadeSlide>

        {/* ── Recent pickups content ─────────────────────────────────────── */}
        <FadeSlide delay={S_RECENT_CARD * STAGGER_MS}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
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
              {requests.slice(0, 5).map((req) => {
                const badge = getStatusBadgeVariant(req.status);
                return (
                  <Card key={req.id} style={styles.requestCard}>
                    <View style={styles.reqHeaderRow}>
                      <Text style={[styles.reqCustomerName, { color: colors.text }]}>
                        {req.customerName || 'Customer Request'}
                      </Text>
                      <StatusBadge label={badge.label} variant={badge.variant} />
                    </View>
                    <View style={styles.reqDetailRow}>
                      <Text style={[styles.reqMeta, { color: colors.textMuted }]}>
                        Material: <Text style={{ color: colors.text }}>{req.materialType}</Text>
                      </Text>
                      <Text style={[styles.reqMeta, { color: colors.textMuted }]}>
                        Date: <Text style={{ color: colors.text }}>{req.requestedDate}</Text>
                      </Text>
                    </View>
                    <View style={styles.reqAddressRow}>
                      <AppIcon name="location-outline" size={12} />
                      <Text style={[styles.reqAddress, { color: colors.textMuted }]} numberOfLines={1}>
                        {req.pickupAddress}
                      </Text>
                    </View>
                  </Card>
                );
              })}
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
    marginTop: spacing.xs,
    marginBottom: -(spacing.xs / 2),
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reqCustomerName: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
    flex: 1,
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
