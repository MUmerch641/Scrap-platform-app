import React from 'react';
import { StyleSheet, Text, useColorScheme } from 'react-native';

import { semanticColors } from '@/shared/theme';

interface EyeIconProps {
  hidden: boolean;
}

export function EyeIcon({ hidden }: EyeIconProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Text style={[styles.iconText, { color: colors.textMuted }]}>
      {hidden ? '👁' : '🙈'}
    </Text>
  );
}

const styles = StyleSheet.create({
  iconText: {
    fontSize: 16,
    lineHeight: 20,
  },
});
