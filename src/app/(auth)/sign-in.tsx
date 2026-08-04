import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/ui/form-input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { authenticateUser } from '@/services/auth-service';
import {
  showErrorMessage,
  showInfoMessage,
  showSuccessMessage,
  triggerNegativeHaptic,
} from '@/services/native-feedback-service';
import { semanticColors, spacing } from '@/shared/theme';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const passwordInputRef = useRef<RNTextInput>(null);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(undefined);
    setPasswordError(undefined);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email address is required.');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    }

    if (!isValid) {
      triggerNegativeHaptic('error');
    }

    return isValid;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await authenticateUser({ email, password });
      if (result.success && result.session) {
        showSuccessMessage(`Signed in as ${result.session.role.replace('_', ' ')}`);
      } else {
        showErrorMessage(result.error || 'Please check your credentials.');
      }
    } catch {
      showErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    showInfoMessage('Password reset instructions sent.');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header section with entrance animation */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(100)}
              style={styles.headerSection}
            >
              {/* Space reserved for future company logo */}
              <View style={styles.logoSpace} />

              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>
                Sign in to continue to your workspace
              </Text>
            </Animated.View>

            {/* Form section with entrance animation */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.formSection}
            >
              <FormInput
                label="Email address"
                placeholder="name@company.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError(undefined);
                }}
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />

              <FormInput
                ref={passwordInputRef}
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError(undefined);
                }}
                error={passwordError}
                isPassword
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />

              <View style={styles.forgotRow}>
                <Pressable onPress={handleForgotPassword} hitSlop={10}>
                  <Text style={[styles.forgotText, { color: colors.primary }]}>
                    Forgot password?
                  </Text>
                </Pressable>
              </View>

              <PrimaryButton
                title="Sign In"
                onPress={handleSignIn}
                loading={loading}
                style={styles.submitButton}
              />
            </Animated.View>

            {/* Footer section with entrance animation */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.footerSection}
            >
              <Text style={[styles.footerText, { color: isDark ? '#71717a' : '#9ca3af' }]}>
                Secure access for authorised staff
              </Text>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  logoSpace: {
    height: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  formSection: {
    gap: 4,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -2,
    marginBottom: spacing.md,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  footerSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
