import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  useColorScheme,
  View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { useUserRole } from '@/context/UserRoleContext'
import { BrandHeader } from '@/components/ui/brand-header'
import { FormInput } from '@/components/ui/form-input'
import { PrimaryButton } from '@/components/ui/primary-button'
import { ScreenScaffold } from '@/components/ui/screen-scaffold'
import { requestPasswordRecovery } from '@/services/auth-service'
import {
  showErrorMessage,
  showInfoMessage,
  showSuccessMessage,
  triggerNegativeHaptic,
} from '@/services/native-feedback-service'
import { semanticColors, spacing, typography } from '@/shared/theme'

const RECOVERY_SENT_MESSAGE =
  'If the address can receive recovery email password reset instructions have been sent'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignInScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const { signIn, authError, clearAuthError } = useUserRole()

  const colors =
    semanticColors[colorScheme === 'dark' ? 'dark' : 'light']

  const passwordInputRef = useRef<RNTextInput>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)

  const [notice, setNotice] = useState<string>()
  const [emailError, setEmailError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()

  const busy = loading || recovering

  useEffect(() => {
    if (!authError) {
      return
    }

    showErrorMessage(authError, 'Account access')
    clearAuthError()
  }, [authError, clearAuthError])

  useFocusEffect(
    useCallback(() => {
      return () => {
        setEmailError(undefined)
        setPasswordError(undefined)
        setNotice(undefined)
        setLoading(false)
        setRecovering(false)
      }
    }, [])
  )

  const validate = (): boolean => {
    const trimmedEmail = email.trim()

    let valid = true

    setEmailError(undefined)
    setPasswordError(undefined)

    if (!trimmedEmail) {
      setEmailError('Email address is required')
      valid = false
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address')
      valid = false
    }

    if (!password) {
      setPasswordError('Password is required')
      valid = false
    }

    if (!valid) {
      void triggerNegativeHaptic('error')
    }

    return valid
  }

  const handleEmailChange = (value: string): void => {
    setEmail(value)
    setNotice(undefined)

    if (emailError) {
      setEmailError(undefined)
    }
  }

  const handlePasswordChange = (value: string): void => {
    setPassword(value)

    if (passwordError) {
      setPasswordError(undefined)
    }
  }

  const handleSignIn = async (): Promise<void> => {
    if (busy || !validate()) {
      return
    }

    setNotice(undefined)
    setLoading(true)

    try {
      const result = await signIn(email.trim(), password)

      if (result.success && result.route) {
        showSuccessMessage('Signed in successfully')
        router.replace(result.route)
        return
      }

      showErrorMessage(
        result.error || 'Unable to sign in',
        'Sign in failed'
      )
    } catch {
      showErrorMessage(
        'Unable to connect Check your connection and try again',
        'Sign in failed'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (): Promise<void> => {
    if (busy) {
      return
    }

    const trimmedEmail = email.trim()

    setNotice(undefined)

    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError(
        'Enter a valid email address to reset your password'
      )

      void triggerNegativeHaptic('error')
      return
    }

    setEmailError(undefined)
    setRecovering(true)

    try {
      const result = await requestPasswordRecovery(trimmedEmail)

      if (result.success) {
        setNotice(RECOVERY_SENT_MESSAGE)
        showInfoMessage(RECOVERY_SENT_MESSAGE)
        return
      }

      showErrorMessage(
        result.error || 'Unable to send a recovery email',
        'Password recovery'
      )
    } catch {
      showErrorMessage(
        'Unable to connect Check your connection and try again',
        'Password recovery'
      )
    } finally {
      setRecovering(false)
    }
  }

  return (
    <ScreenScaffold
      mode="form"
      edges={['top', 'left', 'right', 'bottom']}
      avoidFloatingTabBar={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Animated.View
        entering={FadeInDown.duration(350).delay(50)}
        style={styles.brandContainer}
      >
        <BrandHeader />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(350).delay(100)}
        style={styles.headerSection}
      >
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            {
              color: colors.text,
            },
          ]}
        >
          Welcome back
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textMuted,
            },
          ]}
        >
          Sign in to continue to your workspace
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(350).delay(150)}
        style={styles.formSection}
      >
        <FormInput
          label="Email"
          placeholder="name@company.com"
          value={email}
          onChangeText={handleEmailChange}
          error={emailError}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!busy}
          onSubmitEditing={() => {
            passwordInputRef.current?.focus()
          }}
        />

        <FormInput
          ref={passwordInputRef}
          label="Password"
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          error={passwordError}
          isPassword
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          editable={!busy}
          onSubmitEditing={() => {
            void handleSignIn()
          }}
        />

        <View style={styles.forgotRow}>
          <Pressable
            onPress={() => {
              void handleForgotPassword()
            }}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            accessibilityState={{
              disabled: busy,
              busy: recovering,
            }}
            style={({ pressed }) => [
              styles.forgotButton,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.forgotText,
                {
                  color: colors.primary,
                },
              ]}
            >
              {recovering ? 'Sending recovery email' : 'Forgot password?'}
            </Text>
          </Pressable>
        </View>

        {notice ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                color: colors.textMuted,
              },
            ]}
          >
            {notice}
          </Text>
        ) : null}

        <PrimaryButton
          title="Sign In"
          onPress={() => {
            void handleSignIn()
          }}
          loading={loading}
          disabled={busy || !email.trim() || !password}
          style={styles.submitButton}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(350).delay(200)}
        style={styles.footerSection}
      >
        <Text
          style={[
            styles.footerText,
            {
              color: colors.textMuted,
            },
          ]}
        >
          Secure access for authorised staff
        </Text>
      </Animated.View>
    </ScreenScaffold>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
  },

  brandContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },

  headerSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },

  title: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },

  formSection: {
    width: '100%',
    gap: spacing.xs,
  },

  forgotRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  forgotButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  forgotText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },

  notice: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },

  submitButton: {
    marginTop: spacing.xs,
  },

  footerSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingBottom: spacing.sm,
  },

  footerText: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.7,
  },
})
