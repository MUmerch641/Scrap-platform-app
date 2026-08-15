import React, {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  InputAccessoryView,
  Keyboard,
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
  showDoneAccessory?: boolean;
}

export const FormInput = forwardRef<RNTextInput, FormInputProps>(
  (
    {
      label,
      error,
      isPassword = false,
      showDoneAccessory = false,
      style,
      onFocus,
      onBlur,
      secureTextEntry,
      selectionColor,
      inputAccessoryViewID,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const isAndroid = Platform.OS === 'android';
    const useCompactIOSInput = Platform.OS === 'ios' && props.multiline !== true;

    const colors = semanticColors[isDark ? 'dark' : 'light'];

    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const inputRef = useRef<RNTextInput>(null);
    const generatedAccessoryId = `form-input-${useId().replace(/:/g, '')}`;
    const resolvedAccessoryId = inputAccessoryViewID
      ?? (Platform.OS === 'ios' && showDoneAccessory ? generatedAccessoryId : undefined);

    useImperativeHandle(ref, () => inputRef.current as RNTextInput);

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
            useCompactIOSInput && styles.inputWrapperCompactIOS,
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
          onTouchEnd={() => {
            if (props.editable !== false) {
              inputRef.current?.focus();
            }
          }}
        >
          <RNTextInput
            {...props}
            ref={inputRef}
            style={[
              styles.input,
              useCompactIOSInput && styles.inputCompactIOS,
              {
                color: colors.inputText,
              },
              style,
            ]}
            placeholderTextColor={colors.inputPlaceholder}
            selectionColor={
              selectionColor ?? colors.inputBorderFocused
            }
            inputAccessoryViewID={resolvedAccessoryId}
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
                useCompactIOSInput && styles.eyeToggleCompactIOS,
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

        {Platform.OS === 'ios' && showDoneAccessory && resolvedAccessoryId ? (
          <InputAccessoryView nativeID={resolvedAccessoryId}>
            <View
              style={[
                styles.accessoryBar,
                { backgroundColor: colors.modalSurface, borderTopColor: colors.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done editing"
                hitSlop={8}
                onPress={Keyboard.dismiss}
                style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
              >
                <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}

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
  inputWrapperCompactIOS: {
    minHeight: 44,
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
  inputCompactIOS: {
    minHeight: 44,
    height: 44,
  },

  eyeToggle: {
    width: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeToggleCompactIOS: {
    minHeight: 44,
    width: 44,
  },

  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontFamily: typography.fontFamily.body,
  },
  accessoryBar: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  doneButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonPressed: {
    opacity: 0.55,
  },
  doneText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemibold,
  },
});
