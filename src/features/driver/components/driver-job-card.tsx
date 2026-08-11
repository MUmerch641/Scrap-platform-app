import { AppIcon } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { semanticColors, spacing, typography } from '@/shared/theme';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DriverJob } from '../types';
import { formatDriverScheduleSummary, formatDriverStatus, formatDriverWeight } from '../driver-job-formatters';

export function DriverJobCard({ job, onPress }: { job: DriverJob; onPress: () => void }) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open job for ${job.customerName}`}>
    <Card style={styles.card}>
      <View style={styles.top}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{job.customerName}</Text><Text style={[styles.status, { color: colors.accent }]}>{formatDriverStatus(job.executionStatus)}</Text></View>
      <View style={styles.row}><AppIcon name="calendar-outline" /><Text style={[styles.detail, { color: colors.textMuted }]}>{formatDriverScheduleSummary(job.scheduledAt)}</Text></View>
      <View style={styles.row}><AppIcon name="location-outline" /><Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={2}>{job.pickupAddress}</Text></View>
      <View style={styles.bottom}><Text style={[styles.meta, { color: colors.textMuted }]}>{job.materialType}{job.estimatedWeight != null ? ` | ${formatDriverWeight(job.estimatedWeight)}` : ''}</Text><Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>{job.assignment.vehicle.label}</Text><AppIcon name="chevron-forward" variant="brand" /></View>
    </Card>
  </Pressable>;
}

const styles = StyleSheet.create({ card: { gap: spacing.sm }, top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, name: { flex: 1, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, status: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs }, row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }, detail: { flex: 1, fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm }, bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, meta: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs } });
