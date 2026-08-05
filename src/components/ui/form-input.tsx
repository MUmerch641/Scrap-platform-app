import React, { forwardRef, useState } from 'react';
import {
  Platform,
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
    const isAndroid = Platform.OS === 'android';

    const [isFocused, setIsFocused] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    const getBorderColor = () => {
      if (error) return colors.danger;
      if (isFocused) return colors.primary;
      return isDark ? '#3f3f46' : '#d4d4d8';
    };

    const getBackgroundColor = () => {
      if (isAndroid) {
        // Android uses a slightly elevated surface card feel
        return isDark ? '#1f1f23' : '#f9fafb';
      }
      // iOS rounded filled field
      return isDark ? '#1c1c1e' : '#f2f2f7';
    };

    return (
      <View style={styles.container}>
        <Text
          style={[
            styles.label,
            {
              color: isDark ? '#ababab' : '#3f3f46',
              // Android label sits closer to the field, iOS has a bit more breathing room
              marginBottom: isAndroid ? 4 : 6,
            },
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            styles.inputWrapper,
            isAndroid ? styles.inputWrapperAndroid : styles.inputWrapperIOS,
            {
              backgroundColor: getBackgroundColor(),
              borderColor: getBorderColor(),
            },
            isFocused && !isAndroid && styles.inputWrapperFocusedIOS,
            isFocused && isAndroid && { borderBottomWidth: 2, borderBottomColor: colors.primary },
          ]}
        >
          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              { color: colors.text },
              style,
            ]}
            placeholderTextColor={isDark ? '#636366' : '#aeaeb2'}
            secureTextEntry={isPassword && !showPassword}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            underlineColorAndroid="transparent"
            {...props}
          />
          {isPassword && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={({ pressed }) => [
                styles.eyeToggle,
                pressed && { opacity: 0.5 },
              ]}
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
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  // iOS: fully rounded outlined field with fill
  inputWrapperIOS: {
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  inputWrapperFocusedIOS: {
    // subtle shadow on focus for iOS
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  // Android: bottom-border-only field (Material outlined feel)
  inputWrapperAndroid: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: radius.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  eyeToggle: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
