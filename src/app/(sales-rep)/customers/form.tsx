import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { LoadingState } from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import {
  createCustomer,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  Customer,
  CustomerStatus,
  CustomerType,
  fetchCustomerById,
  findCustomerByClientRequestId,
  findLikelyExistingCustomer,
  PREFERRED_CONTACT_METHOD_OPTIONS,
  PreferredContactMethod,
  updateCustomer,
  validateCustomerInput,
} from '@/services/customer-service';
import { createClientRequestId } from '@/shared/client-request-id';
import { useAppDialog } from '@/context/AppDialogContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import {
  showErrorMessage,
  showInfoMessage,
  showNativeConfirmation,
} from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

const SEARCH_DEBOUNCE_MS = 350;

function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return semanticColors[isDark ? 'dark' : 'light'];
}

function formatCustomerStatus(status: CustomerStatus): string {
  return status.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export default function CustomerFormScreen() {
  const router = useRouter();
  const { editCustomerId } = useLocalSearchParams<{ editCustomerId?: string }>();
  const colors = useColors();
  const { showDialog } = useAppDialog();
  const { isOffline } = useNetworkStatus();

  const [loading, setLoading] = useState(!!editCustomerId);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('business');
  const [billingAddress, setBillingAddress] = useState('');
  const [abn, setAbn] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState<PreferredContactMethod | null>(null);
  const [customerStatus, setCustomerStatus] = useState<CustomerStatus>('new_lead');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [likelyExistingCustomer, setLikelyExistingCustomer] = useState<Customer | null>(null);

  const isSubmittingRef = useRef(false);
  const requestedEditCustomerIdRef = useRef<string | null>(null);
  const duplicateSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createAttemptRef = useRef<{
    clientRequestId: string;
    fingerprint: string;
    attempted: boolean;
  } | null>(null);

  useEffect(() => {
    const customerId = editCustomerId?.trim();
    if (!customerId || requestedEditCustomerIdRef.current === customerId) return;
    requestedEditCustomerIdRef.current = customerId;
    
    setLoading(true);
    fetchCustomerById(customerId).then((result) => {
      if (result.success && result.customer) {
        const customer = result.customer;
        setEditingCustomer(customer);
        setName(customer.name);
        setContactPerson(customer.contactPerson ?? '');
        setPhone(customer.phone);
        setEmail(customer.email ?? '');
        setAddress(customer.address);
        setCustomerType(customer.customerType);
        setBillingAddress(customer.billingAddress ?? '');
        setAbn(customer.abn ?? '');
        setPreferredContactMethod(customer.preferredContactMethod);
        setCustomerStatus(customer.customerStatus);
        setNotes(customer.notes ?? '');
      } else {
        setFormError('Failed to load customer details.');
      }
      setLoading(false);
    });
  }, [editCustomerId]);

  useEffect(() => {
    if (duplicateSearchRef.current) clearTimeout(duplicateSearchRef.current);
    if (isOffline) return undefined;

    const input = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    if (!input.name && !input.phone && !input.email) {
      duplicateSearchRef.current = setTimeout(() => setLikelyExistingCustomer(null), 0);
      return undefined;
    }

    duplicateSearchRef.current = setTimeout(() => {
      findLikelyExistingCustomer(input, editingCustomer?.id).then((result) => {
        setLikelyExistingCustomer(result.success ? result.customer ?? null : null);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (duplicateSearchRef.current) clearTimeout(duplicateSearchRef.current);
    };
  }, [editingCustomer?.id, email, isOffline, name, phone]);

  const isFormDirty = editingCustomer
    ? name !== editingCustomer.name
      || contactPerson !== (editingCustomer.contactPerson ?? '')
      || phone !== editingCustomer.phone
      || email !== (editingCustomer.email ?? '')
      || address !== editingCustomer.address
      || customerType !== editingCustomer.customerType
      || billingAddress !== (editingCustomer.billingAddress ?? '')
      || abn !== (editingCustomer.abn ?? '')
      || preferredContactMethod !== editingCustomer.preferredContactMethod
      || customerStatus !== editingCustomer.customerStatus
      || notes !== (editingCustomer.notes ?? '')
    : Boolean(name || contactPerson || phone || email || address || customerType !== 'business' || billingAddress || abn || preferredContactMethod || customerStatus !== 'new_lead' || notes);

  const requestCloseForm = () => {
    if (submitting) return;
    if (!isFormDirty) {
      router.back();
      return;
    }

    const message = editingCustomer
      ? 'Your customer edits have not been saved.'
      : 'The new customer has not been saved.';
    if (Platform.OS === 'ios') {
      showNativeConfirmation('Discard changes?', message, () => router.back(), 'Discard');
    } else {
      showDialog({
        title: 'Discard changes?',
        message,
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
        destructive: true,
        icon: 'alert-circle-outline',
        dismissible: false,
        onConfirm: () => router.back(),
      });
    }
  };

  const handleSaveCustomer = async (allowDuplicatePhone = false) => {
    if (isSubmittingRef.current || submitting) return;
    const validation = validateCustomerInput({
      name, contactPerson, phone, email, address, customerType, billingAddress,
      abn, preferredContactMethod, customerStatus, notes,
    });
    if (!validation.success) {
      setFormError(validation.error);
      return;
    }

    if (isOffline) {
      setFormError('No internet connection. Your information is still here. Reconnect and try again.');
      return;
    }

    isSubmittingRef.current = true;
    setFormError(null);
    setSubmitting(true);

    try {
      let createAttempt = createAttemptRef.current;
      if (!editingCustomer) {
        const fingerprint = JSON.stringify(validation.value);
        if (!createAttempt || createAttempt.fingerprint !== fingerprint) {
          createAttempt = {
            clientRequestId: createClientRequestId(),
            fingerprint,
            attempted: false,
          };
          createAttemptRef.current = createAttempt;
        }

        if (createAttempt.attempted) {
          const confirmation = await findCustomerByClientRequestId(
            createAttempt.clientRequestId,
          );
          if (confirmation.success && confirmation.customer) {
            showInfoMessage('Customer created successfully');
            router.back();
            return;
          }
        }
      }

      if (!allowDuplicatePhone) {
        const duplicateResult = await findLikelyExistingCustomer(
          validation.value,
          editingCustomer?.id,
        );
        if (duplicateResult.success && duplicateResult.customer) {
          const existingCustomer = duplicateResult.customer;
          const duplicateMessage =
            `${existingCustomer.name} already uses this phone number. ` +
            `Customer names may repeat. ${editingCustomer ? 'Save these changes' : 'Create this customer'} anyway?`;
          const confirmLabel = editingCustomer ? 'Save Anyway' : 'Create Anyway';
          if (Platform.OS === 'ios') {
            showNativeConfirmation(
              'Possible duplicate phone',
              `${existingCustomer.name} already uses ${existingCustomer.phone}. ` +
                `Customer names may repeat. ${editingCustomer ? 'Save these changes' : 'Create this customer'} anyway?`,
              () => { void handleSaveCustomer(true); },
              confirmLabel,
            );
          } else {
            showDialog({
              title: 'Customer already exists',
              message: duplicateMessage,
              confirmLabel,
              cancelLabel: 'Cancel',
              icon: 'alert-circle-outline',
              dismissible: false,
              onConfirm: () => handleSaveCustomer(true),
            });
          }
          return;
        }
      }

      if (createAttempt) createAttempt.attempted = true;
      const result = editingCustomer
        ? await updateCustomer(editingCustomer.id, validation.value)
        : await createCustomer(validation.value, createAttempt!.clientRequestId);
      
      if (result.success) {
        showInfoMessage(
          editingCustomer ? 'Customer updated successfully' : 'Customer created successfully',
        );
        router.back();
      } else {
        const msg = result.error
          ?? `Failed to ${editingCustomer ? 'update' : 'create'} customer.`;
        setFormError(msg);
        if (Platform.OS === 'ios') {
          showErrorMessage(msg, editingCustomer ? 'Update Error' : 'Creation Error');
        }
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const isFormValid = Boolean(name.trim() && phone.trim() && address.trim());

  if (loading) {
    return (
      <ScreenScaffold
        mode="standard"
        iosNativeHeader
        header={
          <AppHeader 
            title={editCustomerId ? 'Edit Customer' : 'Add New Customer'} 
            onBack={requestCloseForm} 
          />
        }
      >
        <LoadingState message="Loading customer details..." />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      mode="standard"
      iosNativeHeader
      avoidFloatingTabBar={false}
      contentContainerStyle={styles.scaffoldContent}
      header={
        <AppHeader
          title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          onBack={requestCloseForm}
        />
      }
    >
      <ScrollView
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
      <View style={styles.formContainer}>
        {formError ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
        ) : null}

        {!isOffline && likelyExistingCustomer ? (
          <Pressable
            onPress={() => {
              router.replace({ pathname: '/(sales-rep)/customers/[id]', params: { id: likelyExistingCustomer.id } } as unknown as Href);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open possible existing customer ${likelyExistingCustomer.name}`}
            style={[styles.duplicateSuggestion, { borderColor: colors.primary, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.duplicateSuggestionTitle, { color: colors.text }]}>Possible existing customer</Text>
            <Text style={[styles.duplicateSuggestionText, { color: colors.textMuted }]}>{likelyExistingCustomer.name} · {likelyExistingCustomer.phone}. Open and reuse this record.</Text>
          </Pressable>
        ) : null}

        <FormInput label="Customer Name *" value={name} onChangeText={setName}
          placeholder="e.g. Acme Scrap Recycling" />

        <FormInput label="Contact Person" value={contactPerson} onChangeText={setContactPerson}
          autoCapitalize="words" placeholder="e.g. Jordan Smith" />

        <FormInput label="Phone Number *" value={phone} onChangeText={setPhone}
          keyboardType="phone-pad" placeholder="e.g. +61 412 345 678" />

        <FormInput label="Email Address" value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none"
          placeholder="e.g. contact@acmescrap.com" />

        <FormInput label="Pickup Address *" value={address} onChangeText={setAddress}
          multiline numberOfLines={2}
          placeholder="e.g. 100 Industrial Parkway, Dock 4" />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Customer Type</Text>
        <View style={styles.optionRow}>
          {CUSTOMER_TYPE_OPTIONS.map((option) => (
            <Pressable key={option} onPress={() => setCustomerType(option)} style={[styles.optionChip, {
              borderColor: customerType === option ? colors.accent : colors.border,
              backgroundColor: customerType === option ? colors.accent : 'transparent',
            }]}>
              <Text style={[styles.optionChipText, { color: customerType === option ? colors.onPrimary : colors.textMuted }]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <FormInput label="Billing Address (Optional)" value={billingAddress} onChangeText={setBillingAddress}
          multiline numberOfLines={2} placeholder="Leave blank if same as pickup address" />

        <FormInput label="ABN (Optional)" value={abn} onChangeText={setAbn}
          keyboardType="number-pad" placeholder="11 digits" />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Preferred Contact Method (Optional)</Text>
        <View style={styles.optionRow}>
          <Pressable onPress={() => setPreferredContactMethod(null)} style={[styles.optionChip, {
            borderColor: preferredContactMethod === null ? colors.accent : colors.border,
            backgroundColor: preferredContactMethod === null ? colors.accent : 'transparent',
          }]}><Text style={[styles.optionChipText, { color: preferredContactMethod === null ? colors.onPrimary : colors.textMuted }]}>none</Text></Pressable>
          {PREFERRED_CONTACT_METHOD_OPTIONS.map((option) => (
            <Pressable key={option} onPress={() => setPreferredContactMethod(option)} style={[styles.optionChip, {
              borderColor: preferredContactMethod === option ? colors.accent : colors.border,
              backgroundColor: preferredContactMethod === option ? colors.accent : 'transparent',
            }]}><Text style={[styles.optionChipText, { color: preferredContactMethod === option ? colors.onPrimary : colors.textMuted }]}>{option}</Text></Pressable>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Customer Status</Text>
        <View style={styles.optionRow}>
          {CUSTOMER_STATUS_OPTIONS.map((option) => (
            <Pressable key={option} onPress={() => setCustomerStatus(option)} style={[styles.optionChip, {
              borderColor: customerStatus === option ? colors.accent : colors.border,
              backgroundColor: customerStatus === option ? colors.accent : 'transparent',
            }]}><Text style={[styles.optionChipText, { color: customerStatus === option ? colors.onPrimary : colors.textMuted }]}>{formatCustomerStatus(option)}</Text></Pressable>
          ))}
        </View>

        <FormInput label="Notes" value={notes} onChangeText={setNotes}
          multiline numberOfLines={4} style={styles.notesInput}
          placeholder="Optional customer instructions or contact details" />
          
        <View style={styles.actions}>
          <Button 
            title={editingCustomer ? 'Save Changes' : 'Add Customer'}
            variant="primary" 
            loading={submitting} 
            disabled={submitting || !isFormValid}
            onPress={() => void handleSaveCustomer()} 
          />
        </View>
      </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scaffoldContent: {
    padding: 0,
  },
  formScrollContent: {
    padding: spacing.md,
    paddingBottom: 120,
  },
  formContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  optionChipText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  errorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  duplicateSuggestion: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    marginBottom: spacing.sm,
  },
  duplicateSuggestionTitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  duplicateSuggestionText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  actions: {
    marginTop: spacing.lg,
  },
});
