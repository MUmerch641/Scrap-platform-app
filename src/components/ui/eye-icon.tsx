import React from 'react';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { semanticColors } from '@/shared/theme';

interface EyeIconProps {
  hidden: boolean;
}

export function EyeIcon({ hidden }: EyeIconProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <Ionicons
      name={hidden ? 'eye-off-outline' : 'eye-outline'}
      size={20}
      color={colors.textMuted}
    />
  );
}
