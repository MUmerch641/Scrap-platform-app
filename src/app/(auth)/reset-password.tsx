import React from 'react';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, TextInput as RNTextInput, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

import { useUserRole } from '@/context/UserRoleContext';
import { BrandHeader } from '@/components/ui/brand-header';
import { FormInput } from '@/components/ui/form-input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { createPasswordRecoverySession, updateRecoveredPassword } from '@/services/auth-service';
import { showErrorMessage, showSuccessMessage, triggerNegativeHaptic } from '@/services/native-feedback-service';
import { semanticColors, spacing, typography } from '@/shared/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const incomingUrl = Linking.useLinkingURL();
  const { signOut } = useUserRole();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string>();
  const [confirmationError, setConfirmationError] = React.useState<string>();
  const [preparing, setPreparing] = React.useState(true);
  const [recoveryReady, setRecoveryReady] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const processedUrlRef = React.useRef<string | undefined>(undefined);
  const confirmationRef = React.useRef<RNTextInput>(null);

  React.useEffect(() => {
    if (!incomingUrl || processedUrlRef.current === incomingUrl) return;
    processedUrlRef.current = incomingUrl;

    const prepareRecovery = async () => {
      const result = await createPasswordRecoverySession(incomingUrl);
      setPreparing(false);
      setRecoveryReady(result.success);
      if (!result.success) {
        showErrorMessage(result.error || 'This recovery link is invalid or has expired.', 'Password recovery');
      }
    };

    void prepareRecovery();
  }, [incomingUrl]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!processedUrlRef.current) setPreparing(false);
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  const handleUpdatePassword = async () => {
    if (submitting || !recoveryReady) return;
    setPasswordError(undefined);
    setConfirmationError(undefined);

    let valid = true;
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters.');
      valid = false;
    }
    if (confirmation !== password) {
      setConfirmationError('Passwords do not match.');
      valid = false;
    }
    if (!valid) {
      void triggerNegativeHaptic('error');
      return;
    }

    setSubmitting(true);
    const result = await updateRecoveredPassword(password);
    if (!result.success) {
      setSubmitting(false);
      showErrorMessage(result.error || 'Unable to update the password.', 'Password recovery');
      return;
    }

    await signOut();
    showSuccessMessage('Password updated. Sign in with your new password.');
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScreenScaffold
      mode="form"
      edges={['top', 'left', 'right', 'bottom']}
      avoidFloatingTabBar={false}
      contentContainerStyle={styles.content}
    >
      <BrandHeader />
      <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choose a new password for your account.</Text>

      {!preparing && !recoveryReady ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>Request a new recovery email from the sign in screen.</Text>
      ) : (
        <>
          <FormInput
            label="New password"
            placeholder="New password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setPasswordError(undefined);
            }}
            error={passwordError}
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            editable={recoveryReady && !submitting}
            returnKeyType="next"
            onSubmitEditing={() => confirmationRef.current?.focus()}
          />
          <FormInput
            ref={confirmationRef}
            label="Confirm password"
            placeholder="Confirm password"
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              setConfirmationError(undefined);
            }}
            error={confirmationError}
            isPassword
            autoComplete="new-password"
            textContentType="newPassword"
            editable={recoveryReady && !submitting}
            returnKeyType="done"
            onSubmitEditing={handleUpdatePassword}
          />
          <PrimaryButton
            title={preparing ? 'Preparing...' : 'Update Password'}
            onPress={handleUpdatePassword}
            loading={preparing || submitting}
            disabled={preparing || submitting || !recoveryReady || !password || !confirmation}
          />
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: { fontFamily: typography.fontFamily.heading, fontSize: 28, marginBottom: spacing.xs },
  subtitle: { fontFamily: typography.fontFamily.body, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  message: { fontFamily: typography.fontFamily.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
