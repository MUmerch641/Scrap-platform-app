import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

import { DriverExecutionStatus } from '../types';

const STEPS: { status: DriverExecutionStatus; shortLabel: string }[] = [
  { status: 'assigned', shortLabel: 'Assigned' },
  { status: 'en_route', shortLabel: 'En Route' },
  { status: 'arrived', shortLabel: 'Arrived' },
  { status: 'material_collected', shortLabel: 'Collected' },
  { status: 'delivered_to_yard', shortLabel: 'Delivered' },
];

export function DriverJobProgress({ status }: { status: DriverExecutionStatus }) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const activeIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>JOB PROGRESS</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>{activeIndex + 1} of {STEPS.length}</Text>
      </View>
      <View style={styles.trackRow}>
        {STEPS.map((step, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;
          return (
            <React.Fragment key={step.status}>
              <View style={styles.step}>
                <View style={[
                  styles.dot,
                  {
                    backgroundColor: complete || active ? brandColors.copper : colors.background,
                    borderColor: complete || active ? brandColors.copper : colors.border,
                  },
                  active && styles.activeDot,
                ]}>
                  {complete ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabel,
                    { color: active ? colors.text : colors.textMuted },
                    active && styles.activeLabel,
                  ]}
                >
                  {step.shortLabel}
                </Text>
              </View>
              {index < STEPS.length - 1 ? (
                <View style={[styles.line, { backgroundColor: index < activeIndex ? brandColors.copper : colors.border }]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
  },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: typography.fontFamily.bodyBold, fontSize: 11, letterSpacing: 1 },
  count: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs },
  trackRow: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 48, alignItems: 'center', gap: 6 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: { borderColor: brandColors.lightCopper, borderWidth: 4 },
  check: { color: brandColors.white, fontFamily: typography.fontFamily.bodyBold, fontSize: 11 },
  stepLabel: { width: 62, textAlign: 'center', fontFamily: typography.fontFamily.bodyMedium, fontSize: 10 },
  activeLabel: { fontFamily: typography.fontFamily.bodyBold },
  line: { flex: 1, height: 2, marginTop: 10, marginHorizontal: -5 },
});
