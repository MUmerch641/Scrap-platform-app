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

  const borderColor = error ? colors.danger : colors.border;

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
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
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
    fontFamily: typography.fontFamily.body,
    flex: 1,
    height: '100%',
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  accessoryContainer: {
    marginLeft: spacing.xs,
  },
  helperText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
});
