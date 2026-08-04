import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  useColorScheme,
  View,
} from 'react-native';

import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  rightAccessory?: React.ReactNode;
}

export function TextInput({
  label,
  error,
  hint,
  rightAccessory,
  style,
  ...props
}: TextInputProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  const borderColor = error
    ? colors.danger
    : colorScheme === 'dark'
    ? '#3f3f46'
    : '#d4d4d8';

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderColor: borderColor,
          },
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            {
              color: colors.text,
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
        {rightAccessory && <View style={styles.accessoryContainer}>{rightAccessory}</View>}
      </View>
      {error ? (
        <Text style={[styles.helperText, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
  inputWrapper: {
    height: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  accessoryContainer: {
    marginLeft: spacing.xs,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
  },
});
