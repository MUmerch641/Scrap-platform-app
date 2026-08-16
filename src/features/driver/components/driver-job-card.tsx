import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

import { formatDriverScheduleSummary, formatDriverWeight, formatDriverVehicle } from '../driver-job-formatters';
import { DriverJob } from '../types';
import { DriverStatusPill } from './driver-status-pill';

export function DriverJobCard({
  job,
  onPress,
  prominent = false,
}: {
  job: DriverJob;
  onPress: () => void;
  prominent?: boolean;
}) {
  const isDark = useColorScheme() === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];
  const completed = job.executionStatus === 'delivered_to_yard';
  const hasYardConfirmation = completed && Boolean(job.yardConfirmedAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open job for ${job.customerName}`}
      style={({ pressed }) => [
        styles.card,
        prominent && styles.prominentCard,
        {
          backgroundColor: colors.surface,
          borderColor: prominent ? brandColors.copper : colors.border,
          opacity: pressed ? 0.82 : completed ? 0.78 : 1,
        },
        Platform.OS === 'android' && !isDark && styles.androidShadow,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{job.customerName}</Text>
            <Text style={[styles.schedule, { color: colors.textMuted }]}>{formatDriverScheduleSummary(job.scheduledAt)}</Text>
          </View>
          <DriverStatusPill
            status={job.executionStatus}
            label={hasYardConfirmation ? 'Yard Weight Confirmed' : undefined}
          />
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.iconDisc, { backgroundColor: colors.background }]}>
            <Ionicons name="location" size={16} color={colors.accent} />
          </View>
          <Text style={[styles.address, { color: colors.text }]} numberOfLines={2}>{job.pickupAddress}</Text>
        </View>

        {hasYardConfirmation && job.finalYardWeight != null ? (
          <View style={styles.yardWeightRow}>
            <Ionicons name="scale-outline" size={14} color={colors.success} />
            <Text style={[styles.yardWeightText, { color: colors.textMuted }]}>
              Final yard weight: {formatDriverWeight(job.finalYardWeight)}
            </Text>
          </View>
        ) : null}

        <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
          <Meta icon="cube-outline" value={job.materialType} colors={colors} />
          <Meta icon="scale-outline" value={formatDriverWeight(job.estimatedWeight)} colors={colors} />
          <Meta icon="car-outline" value={formatDriverVehicle(job.assignment.vehicle)} colors={colors} grow />
          <Ionicons name="chevron-forward" size={19} color={colors.accent} />
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ icon, value, colors, grow = false }: { icon: 'cube-outline' | 'scale-outline' | 'car-outline'; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors]; grow?: boolean }) {
  return (
    <View style={[styles.meta, grow && styles.metaGrow]}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 154,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  prominentCard: { borderWidth: 1 },
  androidShadow: { elevation: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.sm + 2 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleBlock: { flex: 1, gap: 3 },
  name: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.lg },
  schedule: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconDisc: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  address: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  yardWeightRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  yardWeightText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  metaRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  meta: { flex: 1, minWidth: 0, maxWidth: 92, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaGrow: { flex: 1, maxWidth: undefined },
  metaText: { flexShrink: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: 11 },
});
