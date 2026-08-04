import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  useColorScheme,
  View,
} from 'react-native';

import { EyeIcon } from './eye-icon';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

export interface FormInputProps extends RNTextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export const FormInput = forwardRef<RNTextInput, FormInputProps>(
  ({ label, error, isPassword = false, style, onFocus, onBlur, ...props }, ref) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = semanticColors[isDark ? 'dark' : 'light'];

    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const getBorderColor = () => {
      if (error) return colors.danger;
      if (isFocused) return colors.primary;
      return isDark ? '#27272a' : '#e4e4e7';
    };

    const getBackgroundColor = () => {
      if (isDark) return '#18181b';
      return '#f9fafb';
    };

    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: isDark ? '#d4d4d8' : '#3f3f46' }]}>
          {label}
        </Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: getBackgroundColor(),
              borderColor: getBorderColor(),
            },
          ]}
        >
          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: colors.text,
              },
              style,
            ]}
            placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
            secureTextEntry={isPassword && !showPassword}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {isPassword && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={styles.eyeToggle}
            >
              <EyeIcon hidden={!showPassword} />
            </Pressable>
          )}
        </View>
        {error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        ) : null}
      </View>
    );
  }
);

FormInput.displayName = 'FormInput';

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium as '500',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  eyeToggle: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
});
