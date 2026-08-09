import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import {
  getPickupStatusPresentation,
  PickupStatusBadge,
} from '@/components/pickups/pickup-status-badge';
import { AppIcon } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { PickupRequest } from '@/services/pickup-service';
import {
  formatPickupCalendarDate,
  formatPickupTime,
  formatPickupWeight,
} from '@/shared/pickup-formatters';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface PickupListCardProps {
  pickup: PickupRequest;
  onPress: (pickup: PickupRequest) => void;
}

export function PickupListCard({ pickup, onPress }: PickupListCardProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const requestedTime = formatPickupTime(pickup.requestedTime);
  const weight = formatPickupWeight(pickup.estimatedWeight);
  const statusLabel = getPickupStatusPresentation(pickup.status).label;

  return (
    <Pressable
      onPress={() => onPress(pickup)}
      accessibilityRole="button"
      accessibilityLabel={`${pickup.customerName ?? 'Customer pickup'}, ${formatPickupCalendarDate(pickup.requestedDate)}, ${statusLabel}`}
      accessibilityHint="Opens pickup details"
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressablePressed,
      ]}
    >
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.customerName, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {pickup.customerName ?? 'Customer Request'}
          </Text>
          <PickupStatusBadge status={pickup.status} />
        </View>

        <View style={styles.iconRow}>
          <AppIcon name="location-outline" size={12} />
          <Text
            style={[styles.address, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {pickup.pickupAddress}
          </Text>
        </View>

        <Text
          style={[styles.meta, { color: colors.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {formatPickupCalendarDate(pickup.requestedDate)}
          {requestedTime ? ` • ${requestedTime}` : ''}
        </Text>

        <View style={styles.materialRow}>
          <Text
            style={[styles.material, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {pickup.materialType}
            {weight ? ` • ${weight}` : ''}
          </Text>
          <AppIcon name="chevron-forward" size={13} color={colors.textMuted} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.lg,
  },
  pressablePressed: {
    transform: [{ scale: 0.995 }],
  },
  card: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  customerName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingTop: 2,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.sm,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  address: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  meta: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  material: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
});
