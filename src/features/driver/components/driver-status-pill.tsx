import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { brandColors, radius, spacing, typography } from '@/shared/theme';

import { formatDriverStatus } from '../driver-job-formatters';
import { DriverExecutionStatus } from '../types';

const STATUS_TONES: Record<DriverExecutionStatus, { background: string; foreground: string }> = {
  assigned: { background: 'rgba(230, 164, 107, 0.18)', foreground: brandColors.copper },
  en_route: { background: 'rgba(0, 65, 98, 0.12)', foreground: brandColors.navy },
  arrived: { background: '#FFF4E8', foreground: '#9A541D' },
  material_collected: { background: '#EEF7F2', foreground: '#286347' },
  delivered_to_yard: { background: '#EEF1F3', foreground: '#52616A' },
};

export function DriverStatusPill({
  status,
  inverse = false,
}: {
  status: DriverExecutionStatus;
  inverse?: boolean;
}) {
  const tone = STATUS_TONES[status];
  const isDark = useColorScheme() === 'dark';
  const foreground = inverse || isDark ? (status === 'delivered_to_yard' ? 'rgba(251,252,248,0.76)' : brandColors.lightCopper) : tone.foreground;
  return (
    <View style={[
      styles.pill,
      { backgroundColor: inverse || isDark ? 'rgba(251, 252, 248, 0.12)' : tone.background },
    ]}>
      <Ionicons name={status === 'delivered_to_yard' ? 'checkmark-circle' : 'ellipse'} size={10} color={foreground} />
      <Text style={[styles.label, { color: foreground }]}>{formatDriverStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 0.15,
  },
});
