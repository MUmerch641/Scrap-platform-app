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
import {
  radius,
  semanticColors,
  spacing,
  typography,
} from '@/shared/theme';

export interface FormInputProps extends RNTextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export const FormInput = forwardRef<RNTextInput, FormInputProps>(
  (
    {
      label,
      error,
      isPassword = false,
      style,
      onFocus,
      onBlur,
      secureTextEntry,
      selectionColor,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const isAndroid = Platform.OS === 'android';

    const colors = semanticColors[isDark ? 'dark' : 'light'];

    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const borderColor = error
      ? colors.danger
      : isFocused
        ? colors.inputBorderFocused
        : colors.inputBorder;

    const useAndroidLightStyle = isAndroid && !isDark;

    return (
      <View style={styles.container}>
        <Text
          style={[
            styles.label,
            {
              color: colors.text,
              marginBottom: isAndroid ? spacing.xs : 6,
            },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.inputWrapper,
            useAndroidLightStyle
              ? styles.inputWrapperAndroidLight
              : styles.inputWrapperOutlined,
            {
              backgroundColor: colors.inputSurface,
              borderColor,
            },
            isFocused &&
            useAndroidLightStyle && {
              borderBottomWidth: 2,
              borderBottomColor: colors.inputBorderFocused,
            },
            isFocused &&
            !isAndroid && [
              styles.inputWrapperFocusedIOS,
              {
                shadowColor: colors.inputBorderFocused,
              },
            ],
          ]}
        >
          <RNTextInput
            {...props}
            ref={ref}
            style={[
              styles.input,
              {
                color: colors.inputText,
              },
              style,
            ]}
            placeholderTextColor={colors.inputPlaceholder}
            selectionColor={
              selectionColor ?? colors.inputBorderFocused
            }
            secureTextEntry={
              isPassword ? !showPassword : secureTextEntry
            }
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
            underlineColorAndroid="transparent"
          />

          {isPassword ? (
            <Pressable
              onPress={() => {
                setShowPassword((currentValue) => !currentValue);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
              style={({ pressed }) => [
                styles.eyeToggle,
                {
                  opacity: pressed
                    ? 0.5
                    : isDark
                      ? 0.78
                      : 1,
                },
              ]}
            >
              <EyeIcon hidden={!showPassword} />
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.errorText,
              {
                color: colors.danger,
              },
            ]}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  }
);

FormInput.displayName = 'FormInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.sm,
  },

  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.bodyMedium,
    letterSpacing: -0.1,
  },

  inputWrapper: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
  },

  inputWrapperOutlined: {
    borderWidth: 1,
    borderRadius: radius.lg,
  },

  inputWrapperAndroidLight: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: radius.sm,
  },

  inputWrapperFocusedIOS: {
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },

  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    paddingRight: spacing.sm,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    fontFamily: typography.fontFamily.body,
  },

  eyeToggle: {
    width: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontFamily: typography.fontFamily.body,
  },
});