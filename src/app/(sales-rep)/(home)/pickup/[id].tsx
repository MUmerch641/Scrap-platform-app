import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  getPickupStatusPresentation,
  PickupStatusBadge,
} from '@/components/pickups/pickup-status-badge';
import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { OfflineState } from '@/components/ui/offline-state';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import {
  fetchPickupRequestById,
  PickupRequest,
} from '@/services/pickup-service';
import {
  formatPickupCalendarDate,
  formatPickupCreatedAt,
  formatPickupTime,
  formatPickupWeight,
} from '@/shared/pickup-formatters';
import { semanticColors, spacing, typography } from '@/shared/theme';

interface DetailRowProps {
  label: string;
  value: string;
  multiline?: boolean;
}

function DetailRow({ label, value, multiline = false }: DetailRowProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.detailRow, multiline && styles.detailRowMultiline]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          multiline && styles.detailValueMultiline,
          { color: colors.text },
        ]}
        selectable={multiline}
      >
        {value}
      </Text>
    </View>
  );
}

export default function PickupDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const pickupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isOffline } = useNetworkStatus();

  const [request, setRequest] = useState<PickupRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const loadDetails = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    if (isOffline) {
      setLoading(false);
      setError('No internet connection.');
      return;
    }
    setLoading(true);
    setError(null);

    const result = await fetchPickupRequestById(pickupId ?? '');
    if (requestSequence !== requestSequenceRef.current) return;

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Unable to load pickup details.');
      return;
    }

    setRequest(result.request ?? null);
  }, [isOffline, pickupId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
      return () => {
        requestSequenceRef.current += 1;
      };
    }, [loadDetails]),
  );

  const requestedTime = request ? formatPickupTime(request.requestedTime) : null;
  const weight = request ? formatPickupWeight(request.estimatedWeight) : null;

  return (
    <ScreenScaffold
      mode="scroll"
      iosNativeHeader
      header={(
        <AppHeader
          title={request?.customerName ?? 'Pickup Details'}
          subtitle="Submitted request"
          onBack={() => router.back()}
        />
      )}
    >
      {loading ? (
        <LoadingState message="Loading pickup details..." />
      ) : isOffline && !request ? (
        <OfflineState
          message="Connect to the internet to load this pickup."
          onRetry={() => void loadDetails()}
        />
      ) : error && !request ? (
        <EmptyState
          title="Could not load pickup"
          message={error}
          action={<Button title="Retry" variant="outline" onPress={() => void loadDetails()} />}
          variant="full-screen"
        />
      ) : !request ? (
        <EmptyState
          title="Pickup not found"
          message="This pickup is unavailable or you do not have access to it."
          action={<Button title="Go Back" variant="outline" onPress={() => router.back()} />}
          variant="full-screen"
        />
      ) : (
        <View style={styles.content}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text
                style={[styles.customerName, { color: colors.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {request.customerName ?? 'Customer Request'}
              </Text>
              <PickupStatusBadge status={request.status} />
            </View>
            {request.customerPhone ? (
              <Text
                style={[styles.customerPhone, { color: colors.textMuted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {request.customerPhone}
              </Text>
            ) : null}
          </Card>

          <Card style={styles.detailCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup</Text>
            <DetailRow label="Pickup address" value={request.pickupAddress} multiline />
            <DetailRow
              label="Requested date"
              value={formatPickupCalendarDate(request.requestedDate)}
            />
            <DetailRow label="Requested time" value={requestedTime ?? 'Not specified'} />
            <DetailRow label="Material" value={request.materialType} />
            <DetailRow label="Estimated weight" value={weight ?? 'Not specified'} />
          </Card>

          <Card style={styles.detailCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Request information</Text>
            <DetailRow
              label="Status"
              value={getPickupStatusPresentation(request.status).label}
            />
            <DetailRow label="Created" value={formatPickupCreatedAt(request.createdAt)} />
            <DetailRow label="Notes" value={request.notes ?? 'No notes provided'} multiline />
          </Card>
        </View>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  content: {
    gap: spacing.sm,
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  customerName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.lg,
    lineHeight: typography.lineHeight.lg,
  },
  customerPhone: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  detailCard: {
    padding: spacing.md,
    gap: 0,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.md,
  },
  detailRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailRowMultiline: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    flexShrink: 0,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  detailValue: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  detailValueMultiline: {
    textAlign: 'left',
  },
});
