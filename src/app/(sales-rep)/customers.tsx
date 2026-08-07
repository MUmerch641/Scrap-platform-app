import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { SearchField } from '@/components/ui/search-field';
import {
    createCustomer,
    Customer,
    fetchCustomersPage,
} from '@/services/customer-service';
import {
    showErrorMessage,
    showInfoMessage,
} from '@/services/native-feedback-service';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

// ── Pagination config ─────────────────────────────────────────────────────────
const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;
// ─────────────────────────────────────────────────────────────────────────────

// ── Customer row — stable render item for FlatList ───────────────────────────
interface CustomerRowProps {
  customer: Customer;
  index: number;
}

function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return semanticColors[isDark ? 'dark' : 'light'];
}

const ROW_STAGGER    = 40;
const ROW_DURATION   = 300;
const ROW_EASE       = Easing.out(Easing.cubic);
// Only animate the first 10 rows — beyond that skip delay to avoid long waits
const MAX_ANIM_INDEX = 10;

function CustomerRow({ customer, index }: CustomerRowProps) {
  const colors     = useColors();
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(8);

  React.useEffect(() => {
    const delay = Math.min(index, MAX_ANIM_INDEX) * ROW_STAGGER;
    const timer = setTimeout(() => {
      opacity.value    = withTiming(1, { duration: ROW_DURATION, easing: ROW_EASE });
      translateY.value = withTiming(0, { duration: ROW_DURATION, easing: ROW_EASE });
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Card style={styles.compactCustomerCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={[styles.customerPhone, { color: colors.primary }]} numberOfLines={1}>
            {customer.phone}
          </Text>
        </View>

        <View style={styles.iconRow}>
          <AppIcon name="location-outline" size={13} />
          <Text style={[styles.customerAddress, { color: colors.textMuted }]} numberOfLines={1}>
            {customer.address}
          </Text>
        </View>

        {customer.email ? (
          <View style={styles.iconRow}>
            <AppIcon name="mail-outline" size={13} />
            <Text style={[styles.customerEmail, { color: colors.textMuted }]} numberOfLines={1}>
              {customer.email}
            </Text>
          </View>
        ) : null}

        {customer.notes ? (
          <View style={styles.iconRow}>
            <AppIcon name="document-text-outline" size={13} />
            <Text style={[styles.customerNotes, { color: colors.textMuted }]} numberOfLines={1}>
              {customer.notes}
            </Text>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function renderCustomerRow({ item, index }: ListRenderItemInfo<Customer>) {
  return <CustomerRow customer={item} index={index} />;
}
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

  // ── List state ─────────────────────────────────────────────────────────────
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const currentPageRef              = useRef(0);
  const activeSearchRef             = useRef('');
  const searchDebounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Add customer modal state ───────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [address,  setAddress]  = useState('');
  const [notes,    setNotes]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Data fetching ──────────────────────────────────────────────────────────
  const loadPage = useCallback(async (searchTerm: string, page: number, append: boolean) => {
    if (page === 0 && !append) setLoading(true);
    else setLoadingMore(true);

    const result = await fetchCustomersPage(searchTerm, page, PAGE_SIZE);

    setLoading(false);
    setLoadingMore(false);

    if (!result.success) {
      if (!append) showErrorMessage(result.error ?? 'Failed to load customers.', 'Customer Error');
      return;
    }

    setHasMore(result.hasMore);
    currentPageRef.current = page;
    setCustomers(prev => append ? [...prev, ...result.customers] : result.customers);
  }, []);

  const reload = useCallback((term: string) => {
    activeSearchRef.current = term;
    void loadPage(term, 0, false);
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      reload(activeSearchRef.current);
    }, [reload])
  );

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      reload(text);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    void loadPage(activeSearchRef.current, currentPageRef.current + 1, true);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ── Add customer ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setName(''); setPhone(''); setEmail('');
    setAddress(''); setNotes(''); setFormError(null);
  };

  const handleCreateCustomer = async () => {
    if (isSubmittingRef.current || submitting) return;
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setFormError('Name, Phone, and Address are required.');
      return;
    }

    isSubmittingRef.current = true;
    setFormError(null);
    setSubmitting(true);

    try {
      const result = await createCustomer({ name, phone, email, address, notes });
      if (result.success) {
        showInfoMessage('Customer created successfully');
        resetForm();
        setShowFormModal(false);
        reload(activeSearchRef.current);
      } else {
        const msg = result.error ?? 'Failed to create customer.';
        setFormError(msg);
        showErrorMessage(msg, 'Creation Error');
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

  const renderRow = renderCustomerRow;

  const listHeader = (
    <View>
      <SearchField
        value={search}
        onChangeText={handleSearchChange}
        placeholder="Search by name, phone or email…"
      />
      {!loading && customers.length > 0 && (
        <Text style={[styles.listCountText, { color: colors.textMuted }]}>
          {customers.length}{hasMore ? '+' : ''} {customers.length === 1 ? 'Customer' : 'Customers'}
        </Text>
      )}
    </View>
  );

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  ) : null;

  return (
    <ScreenScaffold
      mode="standard"
      header={
        <AppHeader
          title="Customers"
          subtitle="Manage customer records"
          rightAction={
            <Button
              title="+ Add"
              onPress={() => setShowFormModal(true)}
              variant="secondary"
              style={styles.compactHeaderBtn}
            />
          }
        />
      }
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading customer directory…
          </Text>
        </View>
      ) : customers.length === 0 && !search ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="No customers found"
            message="Your customer directory will appear here. Add your first customer to get started."
            action={
              <Button
                title="Add Customer"
                onPress={() => setShowFormModal(true)}
                variant="primary"
              />
            }
            variant="dashboard"
          />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
              No customers match &ldquo;{search}&rdquo;
            </Text>
          }
          ListFooterComponent={listFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
        />
      )}

      {/* ── Add Customer Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showFormModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFormModal(false)}
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
            // iOS: 'padding' adds space below the KAV as the keyboard rises.
            // Android: 'height' shrinks the KAV height — needed because this is a
            // transparent Modal (separate Dialog window) which does NOT participate in
            // softwareKeyboardLayoutMode="resize" that applies to the main activity.
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Customer</Text>
                <Pressable
                  onPress={() => setShowFormModal(false)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                >
                  <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              </View>

              {/* Scrollable form */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
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
                    keyboardType="phone-pad" placeholder="e.g. +1 555-0192" />
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
                    multiline numberOfLines={2}
                    placeholder="Optional customer instructions or contact details" />
                </FormFieldAnimated>
              </ScrollView>

              {/* Sticky footer */}
              <View style={[styles.stickyFooter, { borderTopColor: colors.border }]}>
                <Button title="Cancel" variant="outline" style={styles.footerBtn}
                  onPress={() => { resetForm(); setShowFormModal(false); }} />
                <Button title="Add Customer" variant="primary" style={styles.footerBtn}
                  loading={submitting} disabled={submitting || !isFormValid}
                  onPress={() => void handleCreateCustomer()} />
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  listCountText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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
  compactHeaderBtn: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },

  // ── Customer card ──────────────────────────────────────────────────────────
  compactCustomerCard: {
    padding: spacing.sm,
    gap: spacing.xs / 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardHeaderRow: {    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  customerName: {
    flex: 1,
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  customerPhone: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  customerAddress: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  customerEmail: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  customerNotes: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalKAV: {
    width: '100%',
    maxHeight: '85%',
  },
  modalCard: {
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
  formScrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
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
