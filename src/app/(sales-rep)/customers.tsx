import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    ListRenderItemInfo,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { AppHeader } from '@/components/ui/app-header';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormInput } from '@/components/ui/form-input';
import {
  BrandSpinner,
  CONTENT_LOADER_SIZE,
  LoadingState,
} from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { SearchField } from '@/components/ui/search-field';
import { StaggeredFadeIn } from '@/components/ui/staggered-fade-in';
import {
    createCustomer,
    Customer,
    fetchCustomersPage,
    findCustomerByClientRequestId,
    findCustomerByPhone,
    updateCustomer,
    validateCustomerInput,
} from '@/services/customer-service';
import { createClientRequestId } from '@/shared/client-request-id';
import { useAppDialog } from '@/context/AppDialogContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { OfflineState } from '@/components/ui/offline-state';
import {
    showErrorMessage,
    showInfoMessage,
    showNativeConfirmation,
} from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

// ── Pagination config ─────────────────────────────────────────────────────────
const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;
// ─────────────────────────────────────────────────────────────────────────────

// ── Customer row — stable render item for FlatList ───────────────────────────
interface CustomerRowProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return semanticColors[isDark ? 'dark' : 'light'];
}

const CustomerRow = React.memo(function CustomerRow({ customer, onEdit }: CustomerRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onEdit(customer)}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${customer.name}, phone ${customer.phone}, address ${customer.address}`}
      accessibilityHint="Opens the customer edit form"
      style={({ pressed }) => [
        styles.customerTilePressable,
        pressed && styles.customerTilePressed,
      ]}
    >
      <Card style={styles.compactCustomerCard}>
        <View style={styles.cardHeaderRow}>
          <Text
            style={[styles.customerName, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {customer.name}
          </Text>
          <View style={styles.cardHeaderMeta}>
            <Text
              style={[styles.customerPhone, { color: colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {customer.phone}
            </Text>
            <AppIcon name="create-outline" size={14} color={colors.textMuted} />
          </View>
        </View>

        <View style={styles.iconRow}>
          <AppIcon name="location-outline" size={12} />
          <Text
            style={[styles.customerAddress, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {customer.address}
          </Text>
        </View>

        {customer.email ? (
          <View style={styles.iconRow}>
            <AppIcon name="mail-outline" size={12} />
            <Text
              style={[styles.customerEmail, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {customer.email}
            </Text>
          </View>
        ) : null}

        {customer.notes ? (
          <View style={styles.iconRow}>
            <AppIcon name="document-text-outline" size={12} />
            <Text
              style={[styles.customerNotes, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {customer.notes}
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
});

interface AnimatedCustomerRowProps {
  customer: Customer;
  index: number;
  runKey: number;
  onEdit: (customer: Customer) => void;
}

const AnimatedCustomerRow = React.memo(function AnimatedCustomerRow({
  customer,
  index,
  runKey,
  onEdit,
}: AnimatedCustomerRowProps) {
  return (
    <StaggeredFadeIn index={index} runKey={runKey}>
      <CustomerRow customer={customer} onEdit={onEdit} />
    </StaggeredFadeIn>
  );
}, (previous, next) => (
  previous.customer === next.customer
  && previous.index === next.index
  && previous.runKey === next.runKey
  && previous.onEdit === next.onEdit
));
// ─────────────────────────────────────────────────────────────────────────────

// ── Modal form fields with staggered entrance ────────────────────────────────
const MODAL_STAGGER  = 45;
const MODAL_DURATION = 300;
const MODAL_EASE = Easing.out(Easing.cubic);

interface FormFieldAnimatedProps {
  delay: number;
  children: React.ReactNode;
}

function FormFieldAnimated({ delay, children }: FormFieldAnimatedProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(10);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value    = withTiming(1, { duration: MODAL_DURATION, easing: MODAL_EASE });
      translateY.value = withTiming(0, { duration: MODAL_DURATION, easing: MODAL_EASE });
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const colors = useColors();
  const { showDialog } = useAppDialog();
  const { isOffline } = useNetworkStatus();

  // ── List state ─────────────────────────────────────────────────────────────
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [searching, setSearching]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [listAnimationKey, setListAnimationKey] = useState(0);
  const currentPageRef              = useRef(0);
  const activeSearchRef             = useRef('');
  const searchDebounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef          = useRef(0);
  const isLoadingMoreRef            = useRef(false);
  const hasLoadedRef                = useRef(false);
  const hasRecordsRef               = useRef(false);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Add customer modal state ───────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [address,  setAddress]  = useState('');
  const [notes,    setNotes]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const createAttemptRef = useRef<{
    clientRequestId: string;
    fingerprint: string;
    attempted: boolean;
  } | null>(null);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Data fetching ──────────────────────────────────────────────────────────
  const loadPage = useCallback(async (
    searchTerm: string,
    page: number,
    append: boolean,
    isRefresh = false,
  ) => {
    const requestSequence = ++requestSequenceRef.current;
    if (isOffline) {
      setLoading(false);
      setSearching(false);
      setRefreshing(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
      if (!hasRecordsRef.current) setLoadError('No internet connection.');
      return;
    }
    if (isRefresh) setRefreshing(true);
    else if (page === 0 && !append) {
      if (hasLoadedRef.current) setSearching(true);
      else setLoading(true);
    }
    else {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
    }

    if (append) setLoadMoreError(null);
    else setLoadError(null);

    const result = await fetchCustomersPage(
      searchTerm,
      page,
      PAGE_SIZE,
      page === 0,
    );

    if (requestSequence !== requestSequenceRef.current) return;

    setLoading(false);
    setSearching(false);
    setRefreshing(false);
    setLoadingMore(false);
    isLoadingMoreRef.current = false;
    hasLoadedRef.current = true;

    if (!result.success) {
      const message = result.error ?? 'Failed to load customers.';
      if (append) setLoadMoreError(message);
      else if (!hasRecordsRef.current) {
        setCustomers([]);
        setHasMore(false);
        setTotalCount(null);
        setLoadError(message);
      } else {
        setLoadError(message);
      }
      return;
    }

    setHasMore(result.hasMore);
    if (page === 0) setTotalCount(result.totalCount ?? result.customers.length);
    if (page === 0 && !append) {
      setListAnimationKey((currentValue) => currentValue + 1);
    }
    currentPageRef.current = page;
    setCustomers((previous) => {
      if (!append) {
        hasRecordsRef.current = result.customers.length > 0;
        return result.customers;
      }
      const existingIds = new Set(previous.map((customer) => customer.id));
      const nextCustomers = [
        ...previous,
        ...result.customers.filter((customer) => !existingIds.has(customer.id)),
      ];
      hasRecordsRef.current = nextCustomers.length > 0;
      return nextCustomers;
    });
  }, [isOffline]);

  const reload = useCallback((term: string) => {
    activeSearchRef.current = term;
    setTotalCount(null);
    void loadPage(term, 0, false);
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      reload(activeSearchRef.current);
      return () => {
        requestSequenceRef.current += 1;
        isLoadingMoreRef.current = false;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      };
    }, [reload])
  );

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (isOffline) return;
    setSearching(true);
    setTotalCount(null);
    requestSequenceRef.current += 1;
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
    setRefreshing(false);
    setLoadMoreError(null);
    setLoadError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      reload(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleLoadMore = () => {
    if (isOffline || isLoadingMoreRef.current || loadingMore || !hasMore) return;
    void loadPage(activeSearchRef.current, currentPageRef.current + 1, true);
  };

  const handleRefresh = () => {
    requestSequenceRef.current += 1;
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
    void loadPage(activeSearchRef.current, 0, false, true);
  };

  React.useEffect(() => () => {
    requestSequenceRef.current += 1;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Add customer ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setName(''); setPhone(''); setEmail('');
    setAddress(''); setNotes(''); setFormError(null);
    createAttemptRef.current = null;
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingCustomer(null);
    resetForm();
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    resetForm();
    setShowFormModal(true);
  };

  const handleEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email ?? '');
    setAddress(customer.address);
    setNotes(customer.notes ?? '');
    setFormError(null);
    setShowFormModal(true);
  }, []);

  const isFormDirty = editingCustomer
    ? name !== editingCustomer.name
      || phone !== editingCustomer.phone
      || email !== (editingCustomer.email ?? '')
      || address !== editingCustomer.address
      || notes !== (editingCustomer.notes ?? '')
    : Boolean(name || phone || email || address || notes);

  const requestCloseForm = () => {
    if (submitting) return;
    if (!isFormDirty) {
      closeFormModal();
      return;
    }

    const message = editingCustomer
      ? 'Your customer edits have not been saved.'
      : 'The new customer has not been saved.';
    if (Platform.OS === 'ios') {
      showNativeConfirmation('Discard changes?', message, closeFormModal, 'Discard');
    } else {
      showDialog({
        title: 'Discard changes?',
        message,
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
        destructive: true,
        icon: 'alert-circle-outline',
        dismissible: false,
        onConfirm: closeFormModal,
      });
    }
  };

  const handleSaveCustomer = async (allowDuplicatePhone = false) => {
    if (isSubmittingRef.current || submitting) return;
    const validation = validateCustomerInput({ name, phone, email, address, notes });
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
            closeFormModal();
            reload(activeSearchRef.current);
            return;
          }
        }
      }

      if (!allowDuplicatePhone) {
        const duplicateResult = await findCustomerByPhone(
          validation.value.phone,
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
        closeFormModal();
        reload(activeSearchRef.current);
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
  // ──────────────────────────────────────────────────────────────────────────

  // ── Modal animation ────────────────────────────────────────────────────────
  const modalScale   = useSharedValue(0.94);
  const modalOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (showFormModal) {
      modalOpacity.value = withTiming(1, { duration: 200 });
      modalScale.value   = withSpring(1, { mass: 0.6, stiffness: 260, damping: 22 });
    } else {
      modalOpacity.value = 0;
      modalScale.value   = 0.94;
    }
  }, [showFormModal, modalOpacity, modalScale]);

  const modalAnimStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));
  // ──────────────────────────────────────────────────────────────────────────

  const renderRow = useCallback(
    ({ item, index }: ListRenderItemInfo<Customer>) => (
      <AnimatedCustomerRow
        customer={item}
        index={index}
        runKey={listAnimationKey}
        onEdit={handleEditCustomer}
      />
    ),
    [handleEditCustomer, listAnimationKey],
  );

  const countLabel = totalCount === null
    ? (searching ? 'Searching...' : 'Customers')
    : `${totalCount.toLocaleString()} ${
        search.trim()
          ? (totalCount === 1 ? 'Match' : 'Matches')
          : (totalCount === 1 ? 'Customer' : 'Customers')
      }`;

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <BrandSpinner size={24} accessibilityLabel="Loading more customers" />
    </View>
  ) : loadMoreError ? (
    <View style={styles.listErrorContainer}>
      <Text style={[styles.inlineErrorText, { color: colors.danger }]}>
        {loadMoreError}
      </Text>
      <Button
        title="Retry"
        variant="outline"
        onPress={handleLoadMore}
        style={styles.retryButton}
      />
    </View>
  ) : null;

  return (
    <ScreenScaffold
      mode="standard"
      contentContainerStyle={styles.screenContent}
      header={
        <AppHeader
          title="Customers"
          subtitle="Customer directory"
          compact
          rightAction={
            <Pressable
              onPress={openAddCustomer}
              hitSlop={5}
              accessibilityRole="button"
              accessibilityLabel="Add customer"
              accessibilityHint="Opens the new customer form"
              android_ripple={{
                color: 'rgba(230, 164, 107, 0.22)',
                borderless: false,
              }}
              style={({ pressed }) => [
                styles.headerAddButton,
                {
                  borderColor: brandColors.lightCopper,
                  backgroundColor: pressed
                    ? 'rgba(230, 164, 107, 0.22)'
                    : 'rgba(230, 164, 107, 0.10)',
                  opacity: Platform.OS === 'ios' && pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text style={styles.headerAddText}>+ Add</Text>
            </Pressable>
          }
        />
      }
    >
      <View style={styles.directoryTools}>
        <SearchField
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search name, phone or email"
          compact
        />
        <View style={styles.directoryMetaRow}>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.listCountText, { color: colors.textMuted }]}
          >
            {countLabel}
          </Text>
          {searching ? (
            <BrandSpinner size={20} accessibilityLabel="Searching customers" />
          ) : null}
        </View>
      </View>

      {loading ? (
        <LoadingState message="Loading customer directory..." />
      ) : isOffline && customers.length === 0 ? (
        <OfflineState
          message="Connect to the internet to load your customers."
          onRetry={handleRefresh}
        />
      ) : (
        <FlatList
          style={styles.list}
          data={customers}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          ListHeaderComponent={!isOffline && loadError && customers.length > 0 ? (
            <View style={styles.listErrorContainer}>
              <Text style={[styles.inlineErrorText, { color: colors.danger }]}>{loadError}</Text>
              <Button title="Retry" variant="outline" onPress={handleRefresh} style={styles.retryButton} />
            </View>
          ) : null}
          ListEmptyComponent={
            isOffline ? (
              <OfflineState
                message="Connect to the internet to load your customers."
                onRetry={handleRefresh}
              />
            ) : loadError ? (
              <View style={styles.listErrorContainer}>
                <Text style={[styles.inlineErrorText, { color: colors.danger }]}>
                  {loadError}
                </Text>
                <Button
                  title="Retry"
                  variant="outline"
                  onPress={() => reload(activeSearchRef.current)}
                  style={styles.retryButton}
                />
              </View>
            ) : searching ? (
              <View style={styles.emptyListLoading}>
                <BrandSpinner
                  size={CONTENT_LOADER_SIZE}
                  accessibilityLabel="Searching customers"
                />
              </View>
            ) : search.trim() ? (
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
                {`No customers match "${search.trim()}"`}
              </Text>
            ) : (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  title="No customers found"
                  message="Your customer directory will appear here. Add your first customer to get started."
                  action={
                    <Button
                      title="Add Customer"
                      onPress={openAddCustomer}
                      variant="primary"
                    />
                  }
                  variant="dashboard"
                />
              </View>
            )
          }
          ListFooterComponent={listFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
        />
      )}

      {/* ── Add Customer Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showFormModal}
        animationType="fade"
        transparent
        onRequestClose={requestCloseForm}
      >
        {/*
         * On iOS, KeyboardAvoidingView must NOT wrap the transparent overlay.
         * Doing so shifts the entire semi-transparent backdrop when the keyboard
         * opens, which looks broken and displaces the modal to the top on small
         * iPhones. Instead, the overlay is a plain View (fixed in place) and KAV
         * wraps only the card interior so the card itself adjusts for the keyboard.
         */}
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            // Keep this container full-height and pad only the actual keyboard
            // overlap. This works whether Android's dialog window resizes or not,
            // while the fixed outer View keeps the backdrop from shifting on iOS.
            behavior="padding"
            style={styles.modalKAV}
          >
            <Animated.View
              style={[
                styles.modalCard,
                { backgroundColor: colors.modalSurface, borderColor: colors.border },
                modalAnimStyle,
              ]}
            >
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </Text>
                <Pressable
                  onPress={requestCloseForm}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                  style={styles.closeButton}
                >
                  <AppIcon name="close-circle-outline" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Scrollable form */}
              <ScrollView
                style={styles.formScroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                showsVerticalScrollIndicator
                contentContainerStyle={styles.formScrollContent}
              >
                {formError ? (
                  <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
                ) : null}

                <FormFieldAnimated delay={MODAL_STAGGER * 0}>
                  <FormInput label="Customer Name *" value={name} onChangeText={setName}
                    placeholder="e.g. Acme Scrap Recycling" />
                </FormFieldAnimated>

                <FormFieldAnimated delay={MODAL_STAGGER * 1}>
                  <FormInput label="Phone Number *" value={phone} onChangeText={setPhone}
                    keyboardType="phone-pad" placeholder="e.g. +61 412 345 678" />
                </FormFieldAnimated>

                <FormFieldAnimated delay={MODAL_STAGGER * 2}>
                  <FormInput label="Email Address" value={email} onChangeText={setEmail}
                    keyboardType="email-address" autoCapitalize="none"
                    placeholder="e.g. contact@acmescrap.com" />
                </FormFieldAnimated>

                <FormFieldAnimated delay={MODAL_STAGGER * 3}>
                  <FormInput label="Pickup Address *" value={address} onChangeText={setAddress}
                    multiline numberOfLines={2}
                    placeholder="e.g. 100 Industrial Parkway, Dock 4" />
                </FormFieldAnimated>

                <FormFieldAnimated delay={MODAL_STAGGER * 4}>
                  <FormInput label="Notes" value={notes} onChangeText={setNotes}
                    multiline numberOfLines={4} style={styles.notesInput}
                    placeholder="Optional customer instructions or contact details" />
                </FormFieldAnimated>
              </ScrollView>

              {/* Sticky footer */}
              <View style={[styles.stickyFooter, { borderTopColor: colors.border }]}>
                <Button title="Cancel" variant="outline" style={styles.footerBtn}
                  onPress={requestCloseForm} />
                <Button title={editingCustomer ? 'Save Changes' : 'Add Customer'}
                  variant="primary" style={styles.footerBtn}
                  loading={submitting} disabled={submitting || !isFormValid}
                  onPress={() => void handleSaveCustomer()} />
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0,
  },
  list: {
    flex: 1,
  },
  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
    paddingTop: 2,
    paddingBottom: 0,
    gap: spacing.xs,
  },
  directoryTools: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  directoryMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listCountText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyListLoading: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  noResultsText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingTop: spacing.xl,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  listErrorContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  inlineErrorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 112,
  },
  emptyWrapper: {
    flex: 1,
  },

  // ── Loading ────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },

  // ── Header button ──────────────────────────────────────────────────────────
  headerAddButton: {
    minHeight: 34,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAddText: {
    color: brandColors.offWhite,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },

  // ── Customer card ──────────────────────────────────────────────────────────
  customerTilePressable: {
    borderRadius: radius.md,
  },
  customerTilePressed: {
    transform: [{ scale: 0.995 }],
  },
  compactCustomerCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.md,
    gap: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: typography.lineHeight.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  cardHeaderMeta: {
    flexShrink: 1,
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  customerName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: 15,
    lineHeight: typography.lineHeight.sm,
  },
  customerPhone: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerAddress: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerEmail: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
  },
  customerNotes: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.lineHeight.xs,
    fontStyle: 'italic',
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalKAV: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  modalCard: {
    maxHeight: '85%',
    flexShrink: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  closeText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.lg,
  },
  closeButton: {
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  formScroll: {
    flexShrink: 1,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  errorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  stickyFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
  },
});
