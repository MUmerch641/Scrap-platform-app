import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Href, useFocusEffect, useRouter } from 'expo-router';

import { useUserRole } from '@/app/context/UserRoleContext';
import { BrandHeader } from '@/components/ui/brand-header';
import { FormInput } from '@/components/ui/form-input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { authenticateUser } from '@/services/auth-service';
import {
  showErrorMessage,
  showInfoMessage,
  showSuccessMessage,
  triggerNegativeHaptic,
} from '@/services/native-feedback-service';
import { semanticColors, spacing } from '@/shared/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { setUserProfile } = useUserRole();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  // Start with clean, empty inputs for production readiness
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const passwordInputRef = useRef<RNTextInput>(null);

  // Reset errors and clean sensitive state when screen focus changes
  useFocusEffect(
    useCallback(() => {
      return () => {
        setEmailError(undefined);
        setPasswordError(undefined);
        setLoading(false);
      };
    }, [])
  );

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
    if (loading) return; // Prevent duplicate submissions
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await authenticateUser({ email, password });
      if (result.success && result.session && result.targetRoute) {
        setUserProfile({
          userId: result.session.userId,
          email: result.session.email,
          role: result.session.role,
        });
        showSuccessMessage('Signed in successfully');
        router.replace(result.targetRoute as Href);
      } else {
        showErrorMessage(result.error || 'Invalid email or password.');
      }
    } catch {
      showErrorMessage('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    showInfoMessage('Password recovery will be enabled once backend authentication is connected.');
  };

  const isFormEmpty = !email.trim() || !password;

  return (
    <ScreenScaffold
      mode="form"
      edges={['top', 'left', 'right', 'bottom']}
      avoidFloatingTabBar={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* 1. Branding Section (Logo + Company Name Placeholder) */}
      <Animated.View
        entering={FadeInDown.duration(350).delay(50)}
        style={styles.brandContainer}
      >
        <BrandHeader />
      </Animated.View>

      {/* 2. Welcome Title & Subtitle */}
      <Animated.View
        entering={FadeInDown.duration(350).delay(100)}
        style={styles.headerSection}
      >
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>
          Sign in to continue to your workspace
        </Text>
      </Animated.View>

      {/* 3. Form Section (Email, Password, Forgot Link, Sign In Button) */}
      <Animated.View
        entering={FadeInDown.duration(350).delay(150)}
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
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!loading}
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
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          editable={!loading}
          onSubmitEditing={handleSignIn}
        />

        <View style={styles.forgotRow}>
          <Pressable
            onPress={handleForgotPassword}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Forgot password?
            </Text>
          </Pressable>
        </View>

        <PrimaryButton
          title="Sign In"
          onPress={handleSignIn}
          loading={loading}
          disabled={loading || isFormEmpty}
          style={styles.submitButton}
        />
      </Animated.View>

      {/* 4. Authorised Staff Footer */}
      <Animated.View
        entering={FadeInDown.duration(350).delay(200)}
        style={styles.footerSection}
      >
        <Text style={[styles.footerText, { color: isDark ? '#71717a' : '#9ca3af' }]}>
          Secure access for authorised staff
        </Text>
      </Animated.View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  brandContainer: {
    marginBottom: spacing.xs,
  },
  headerSection: {
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
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
