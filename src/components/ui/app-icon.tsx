/**
 * AppIcon — thin wrapper around Ionicons with semantic color logic.
 *
 * Color rules:
 *  - informational icons  → textMuted  (dark grey in light, muted off-white in dark)
 *  - brand/action icons   → accent     (copper in light, light copper in dark)
 *  - explicit color prop  → overrides everything
 */
import React from 'react';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { semanticColors } from '@/shared/theme';

// Subset of Ionicons names used in this app — extend as needed
export type AppIconName =
  | 'location-outline'
  | 'mail-outline'
  | 'document-text-outline'
  | 'call-outline'
  | 'person-outline'
  | 'calendar-outline'
  | 'time-outline'
  | 'scale-outline'
  | 'construct-outline'
  | 'lock-closed-outline'
  | 'log-out-outline'
  | 'shield-checkmark-outline'
  | 'checkmark-circle-outline'
  | 'close-circle-outline'
  | 'alert-circle-outline'
  | 'chevron-forward'
  | 'search-outline';

export type AppIconVariant = 'informational' | 'brand';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  /** Override automatic semantic color */
  color?: string;
  variant?: AppIconVariant;
}

export function AppIcon({
  name,
  size = 14,
  color,
  variant = 'informational',
}: AppIconProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const resolvedColor =
    color ??
    (variant === 'brand' ? colors.accent : colors.textMuted);

  return <Ionicons name={name} size={size} color={resolvedColor} />;
}
