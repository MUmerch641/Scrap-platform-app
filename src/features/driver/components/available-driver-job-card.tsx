import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

import { formatDriverScheduleSummary, formatDriverWeight } from '../driver-job-formatters';
import { AvailableDriverJob } from '../types';

export function AvailableDriverJobCard({
  job,
  accepting,
  disabled,
  onAccept,
}: {
  job: AvailableDriverJob;
  accepting: boolean;
  disabled: boolean;
  onAccept: () => void;
}) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={[styles.iconDisc, { backgroundColor: colors.background }]}>
          <Ionicons name="radio-outline" size={20} color={colors.accent} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Pickup job</Text>
          <Text style={[styles.identifier, { color: colors.textMuted }]}>#{job.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={[styles.availableBadge, { backgroundColor: brandColors.navy }]}>
          <Text style={styles.availableText}>AVAILABLE</Text>
        </View>
      </View>

      <View style={styles.scheduleRow}>
        <Ionicons name="calendar-outline" size={17} color={colors.accent} />
        <Text style={[styles.schedule, { color: colors.text }]}>{formatDriverScheduleSummary(job.scheduledAt)}</Text>
      </View>

      <View style={styles.scheduleRow}>
        <Ionicons name="location-outline" size={17} color={colors.accent} />
        <Text style={[styles.schedule, { color: colors.text }]}>{job.pickupArea ?? 'Pickup area unavailable'}</Text>
      </View>

      <View style={[styles.metaGrid, { borderTopColor: colors.border }]}>
        <Meta icon="cube-outline" label="Material" value={job.materialType} colors={colors} />
        <Meta icon="scale-outline" label="Estimated" value={formatDriverWeight(job.estimatedWeight)} colors={colors} />
      </View>

      <Text style={[styles.privacyNote, { color: colors.textMuted }]}>Customer and exact pickup details unlock after acceptance.</Text>
      <Button title="Accept Job" onPress={onAccept} loading={accepting} disabled={disabled} style={styles.acceptButton} />
    </View>
  );
}

function Meta({
  icon,
  label,
  value,
  colors,
}: {
  icon: 'cube-outline' | 'scale-outline';
  label: string;
  value: string;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View style={styles.metaCopy}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconDisc: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 1 },
  title: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  identifier: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs },
  availableBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  availableText: { color: brandColors.lightCopper, fontFamily: typography.fontFamily.bodyBold, fontSize: 10, letterSpacing: 0.6 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  schedule: { flex: 1, fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  metaGrid: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaCopy: { flex: 1, gap: 1 },
  metaLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  privacyNote: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.xs },
  acceptButton: { minHeight: 50, borderRadius: radius.lg },
});
