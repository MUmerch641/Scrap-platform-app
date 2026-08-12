import { useFocusEffect, useRouter } from 'expo-router';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppHeader } from '@/components/ui/app-header';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormInput } from '@/components/ui/form-input';
import {
  BrandSpinner,
  CONTENT_LOADER_SIZE,
  LoadingState,
} from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { OfflineState } from '@/components/ui/offline-state';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { SearchField } from '@/components/ui/search-field';
import {
  Customer,
  fetchCustomersPage,
} from '@/services/customer-service';
import {
  showErrorMessage,
  showInfoMessage,
} from '@/services/native-feedback-service';
import {
  createPickupRequest,
  findPickupByClientRequestId,
  formatLocalCalendarDate,
  MATERIAL_OPTIONS,
  parseEstimatedWeightInput,
  validatePickupRequestInput,
} from '@/services/pickup-service';
import { createClientRequestId } from '@/shared/client-request-id';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────────────────────────
const SELECTOR_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

const STAGGER_MS  = 55;
const DURATION_MS = 320;
const EASE        = Easing.out(Easing.cubic);
// ─────────────────────────────────────────────────────────────────────────────

// ── Animation helpers ─────────────────────────────────────────────────────────
interface FadeSlideProps { children: React.ReactNode; delay: number; }
function FadeSlide({ children, delay }: FadeSlideProps) {
  const reduceMotion = useReducedMotion();
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(0);
  React.useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 12;
      return;
    }
    const cfg = { duration: DURATION_MS, easing: EASE };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(12, cfg));
  }, [delay, opacity, reduceMotion, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: 12 - translateY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

interface FormCardProps { children: React.ReactNode; delay: number; }
function FormCard({ children, delay }: FormCardProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.96);
  React.useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION_MS, easing: EASE }));
    scale.value   = withDelay(delay, withSpring(1, { mass: 0.5, stiffness: 230, damping: 20 }));
  }, [delay, opacity, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── CustomerSelectorModal ─────────────────────────────────────────────────────
interface CustomerSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

function CustomerSelectorModal({ visible, onClose, onSelect }: CustomerSelectorModalProps) {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const colors      = semanticColors[isDark ? 'dark' : 'light'];
  const { isOffline } = useNetworkStatus();

  const [search,      setSearch]      = useState('');
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const pageRef           = useRef(0);
  const activeSearchRef   = useRef('');
  const debounceRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  // Track the last visibility value so we only trigger on rising edge (false→true)
  const prevVisibleRef    = useRef(false);

  // Load a page of customers into the selector
  const loadPage = useCallback(async (term: string, page: number, append: boolean) => {
    const requestSequence = ++requestSequenceRef.current;
    if (isOffline) {
      setLoading(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
      return;
    }
    if (page === 0) setLoading(true);
    else {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
    }

    if (append) setLoadMoreError(null);
    else setLoadError(null);

    const result = await fetchCustomersPage(term, page, SELECTOR_PAGE_SIZE);

    if (requestSequence !== requestSequenceRef.current) return;

    setLoading(false);
    setLoadingMore(false);
    isLoadingMoreRef.current = false;

    if (!result.success) {
      const message = result.error ?? 'Failed to load customers.';
      if (append) setLoadMoreError(message);
      else {
        setCustomers([]);
        setHasMore(false);
        setLoadError(message);
      }
      return;
    }

    pageRef.current = page;
    setHasMore(result.hasMore);
    setCustomers((previous) => {
      if (!append) return result.customers;
      const existingIds = new Set(previous.map((customer) => customer.id));
      return [
        ...previous,
        ...result.customers.filter((customer) => !existingIds.has(customer.id)),
      ];
    });
  }, [isOffline]);

  // Trigger reset+load only on the rising edge (modal just opened).
  // All setState calls here are inside an async callback, not synchronous in the effect body.
  React.useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (!visible) {
      requestSequenceRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (!justOpened) return;

    // Defer state resets so they are not synchronous in the effect body
    const reset = async () => {
      setSearch('');
      setCustomers([]);
      setLoadError(null);
      setLoadMoreError(null);
      activeSearchRef.current = '';
      await loadPage('', 0, false);
    };
    void reset();
  }, [visible, loadPage]);

  React.useEffect(() => () => {
    requestSequenceRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (isOffline) return;
    requestSequenceRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const normalizedSearch = text.trim();
      activeSearchRef.current = normalizedSearch;
      void loadPage(normalizedSearch, 0, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleLoadMore = () => {
    if (isOffline || isLoadingMoreRef.current || loadingMore || !hasMore) return;
    void loadPage(activeSearchRef.current, pageRef.current + 1, true);
  };

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Customer>) => (
    <Pressable
      onPress={() => { onSelect(item); }}
      style={({ pressed }) => [
        styles.selectorRow,
        {
          backgroundColor: pressed ? colors.surface : 'transparent',
          borderBottomColor: colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.name}, phone ${item.phone}, address ${item.address}`}
    >
      <View style={styles.selectorRowContent}>
        <Text style={[styles.selectorName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.selectorPhone, { color: colors.primary }]} numberOfLines={1}>
          {item.phone}
        </Text>
      </View>
      {item.address ? (
        <View style={styles.selectorAddressRow}>
          <AppIcon name="location-outline" size={13} />
          <Text style={[styles.selectorAddress, { color: colors.textMuted }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      ) : null}
    </Pressable>
  ), [onSelect, colors]);

  const listFooter = loadingMore ? (
    <View style={styles.selectorFooterLoader}>
      <BrandSpinner size={24} accessibilityLabel="Loading more customers" />
    </View>
  ) : loadMoreError ? (
    <View style={styles.selectorFooterError}>
      <Text style={[styles.selectorErrorText, { color: colors.danger }]}>
        {loadMoreError}
      </Text>
      <Button title="Retry" variant="outline" onPress={handleLoadMore} />
    </View>
  ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.selectorContainer, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.selectorHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.selectorTitle, { color: colors.text }]}>Select Customer</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close customer selector"
          >
            <Text style={[styles.selectorClose, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.selectorSearchContainer}>
          <SearchField
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search by name, phone or email..."
          />
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.selectorLoading}>
            <BrandSpinner
              size={CONTENT_LOADER_SIZE}
              accessibilityLabel="Loading customers"
            />
          </View>
        ) : loadError ? (
          <View style={styles.selectorLoading}>
            <Text style={[styles.selectorErrorText, { color: colors.danger }]}>
              {loadError}
            </Text>
            <Button
              title="Retry"
              variant="outline"
              onPress={() => void loadPage(activeSearchRef.current, 0, false)}
            />
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={[styles.selectorEmpty, { color: colors.textMuted }]}>
                {search.trim() ? `No customers match "${search.trim()}"` : 'No customers found.'}
              </Text>
            }
            ListFooterComponent={listFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── CustomerSelectorField — the closed trigger shown in the form ──────────────
interface CustomerSelectorFieldProps {
  selected: Customer | null;
  onPress: () => void;
  colors: ReturnType<typeof getColors>;
}

function getColors(isDark: boolean) {
  return semanticColors[isDark ? 'dark' : 'light'];
}

function CustomerSelectorField({ selected, onPress, colors }: CustomerSelectorFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Select Customer *</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={selected ? `Selected customer: ${selected.name}. Tap to change.` : 'Select a customer'}
        style={({ pressed }) => [
          styles.selectorTrigger,
          {
            backgroundColor: colors.inputSurface,
            borderColor: colors.inputBorder,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {selected ? (
          <View style={styles.selectorTriggerContent}>
            <View style={styles.selectorTriggerLeft}>
              <Text style={[styles.selectorTriggerName, { color: colors.inputText }]} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={[styles.selectorTriggerPhone, { color: colors.textMuted }]} numberOfLines={1}>
                {selected.phone}
              </Text>
            </View>
            <Text style={[styles.selectorTriggerChange, { color: colors.primary }]}>
              Change
            </Text>
          </View>
        ) : (
          <View style={styles.selectorTriggerContent}>
            <Text style={[styles.selectorTriggerPlaceholder, { color: colors.inputPlaceholder }]}>
              Select a customer...
            </Text>
            <AppIcon name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        )}
      </Pressable>
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function getTodayString(): string {
  return formatLocalCalendarDate(new Date());
}

function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatLocalCalendarDate(tomorrow);
}

function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
}

function parseClockTime(value: string): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0);
  return date;
}

function formatClockTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

type CustomerAvailability = 'loading' | 'available' | 'empty' | 'error';

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CreatePickupScreen() {
  const router      = useRouter();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const colors      = getColors(isDark);
  const { isOffline } = useNetworkStatus();

  // Customer selector state
  const [selectedCustomer,    setSelectedCustomer]    = useState<Customer | null>(null);
  const [selectorVisible,     setSelectorVisible]     = useState(false);
  const [customerAvailability, setCustomerAvailability] =
    useState<CustomerAvailability>('loading');
  const [checkingCustomers, setCheckingCustomers] = useState(false);
  const customerAvailabilityRequestRef = useRef(0);

  // Form state
  const [pickupAddress,   setPickupAddress]   = useState('');
  const [requestedDate,   setRequestedDate]   = useState(getTodayString());
  const [requestedTime,   setRequestedTime]   = useState('09:00');
  const [materialType,    setMaterialType]    = useState('Copper');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [notes,           setNotes]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const pickupAttemptRef = useRef<{
    clientRequestId: string;
    fingerprint: string;
    attempted: boolean;
  } | null>(null);
  const minimumPickupDate = new Date();
  minimumPickupDate.setHours(0, 0, 0, 0);

  // This bounded one-row check supports the empty state without loading the directory.
  const checkCustomers = useCallback(async () => {
    const requestSequence = ++customerAvailabilityRequestRef.current;
    if (isOffline) {
      setCheckingCustomers(false);
      setCustomerAvailability('error');
      return;
    }
    setCheckingCustomers(true);
    const result = await fetchCustomersPage('', 0, 1);
    if (requestSequence !== customerAvailabilityRequestRef.current) return;

    setCheckingCustomers(false);
    if (result.success) {
      setCustomerAvailability(result.customers.length > 0 ? 'available' : 'empty');
    } else {
      setCustomerAvailability('error');
    }
  }, [isOffline]);

  useFocusEffect(
    useCallback(() => {
      void checkCustomers();
      return () => {
        customerAvailabilityRequestRef.current += 1;
      };
    }, [checkCustomers])
  );

  const handleCustomerSelected = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPickupAddress(customer.address);
    setFormError(null);
    setSelectorVisible(false);
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || submitting) return;

    if (!selectedCustomer) {
      setFormError('Please select a customer.');
      return;
    }

    const weightResult = parseEstimatedWeightInput(estimatedWeight);
    if (!weightResult.success) {
      setFormError(weightResult.error);
      return;
    }

    const validation = validatePickupRequestInput({
      customerId: selectedCustomer.id,
      pickupAddress,
      requestedDate,
      requestedTime,
      materialType,
      estimatedWeight: weightResult.value,
      notes,
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
      const fingerprint = JSON.stringify(validation.value);
      let pickupAttempt = pickupAttemptRef.current;
      if (!pickupAttempt || pickupAttempt.fingerprint !== fingerprint) {
        pickupAttempt = {
          clientRequestId: createClientRequestId(),
          fingerprint,
          attempted: false,
        };
        pickupAttemptRef.current = pickupAttempt;
      }

      if (pickupAttempt.attempted) {
        const confirmation = await findPickupByClientRequestId(
          pickupAttempt.clientRequestId,
        );
        if (confirmation.success && confirmation.request) {
          pickupAttemptRef.current = null;
          showInfoMessage('Pickup request submitted successfully');
          router.push('/(sales-rep)/(home)');
          return;
        }
      }

      pickupAttempt.attempted = true;
      const result = await createPickupRequest(
        validation.value,
        pickupAttempt.clientRequestId,
      );

      if (result.success) {
        pickupAttemptRef.current = null;
        showInfoMessage('Pickup request submitted successfully');
        router.push('/(sales-rep)/(home)');
      } else {
        const msg = result.error ?? 'Failed to submit pickup request.';
        setFormError(msg);
        if (Platform.OS === 'ios') showErrorMessage(msg, 'Submission Error');
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Still checking whether customers exist
  if (customerAvailability === 'loading') {
    return (
      <ScreenScaffold mode="scroll" header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}>
        <LoadingState message="Loading customer directory..." />
      </ScreenScaffold>
    );
  }

  if (customerAvailability === 'error') {
    return (
      <ScreenScaffold mode="scroll" header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}>
        {isOffline ? (
          <OfflineState
            message="Connect to the internet to load your customers."
            onRetry={() => void checkCustomers()}
            loading={checkingCustomers}
          />
        ) : (
          <EmptyState
            title="Could not load customers"
            message="Check your connection and try again."
            action={
              <Button
                title="Retry"
                variant="primary"
                loading={checkingCustomers}
                disabled={checkingCustomers}
                onPress={() => void checkCustomers()}
              />
            }
            variant="dashboard"
          />
        )}
      </ScreenScaffold>
    );
  }

  if (customerAvailability === 'empty') {
    return (
      <ScreenScaffold mode="scroll" header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}>
        <EmptyState
          title="No customers available"
          message="You must add a customer before creating a pickup request."
          action={
            <Button title="Go to Customers" variant="primary"
              onPress={() => router.push('/(sales-rep)/customers')} />
          }
          variant="dashboard"
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      mode="form"
      header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}
    >
      <View style={styles.container}>
        {formError ? (
          <FadeSlide delay={0}>
            <Text style={[styles.errorBanner, { color: colors.danger }]}>{formError}</Text>
          </FadeSlide>
        ) : null}

        {/* Customer selector */}
        <FormCard delay={0 * STAGGER_MS}>
          <CustomerSelectorField
            selected={selectedCustomer}
            onPress={() => setSelectorVisible(true)}
            colors={colors}
          />
        </FormCard>

        {/* Pickup Address */}
        <FormCard delay={1 * STAGGER_MS}>
          <FormInput
            label="Pickup Address *"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
            numberOfLines={2}
            placeholder="Full address for driver pickup"
          />
        </FormCard>

        {/* Requested Date */}
        <FormCard delay={2 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            {Platform.OS === 'ios' ? (
              <View style={styles.nativePickerField}>
                <Text style={[styles.nativePickerLabel, { color: colors.text }]}>Requested Date *</Text>
                <View
                  style={[
                    styles.nativePickerControl,
                    { backgroundColor: colors.inputSurface, borderColor: colors.inputBorder },
                  ]}
                >
                  <DateTimePicker
                    value={parseCalendarDate(requestedDate) ?? minimumPickupDate}
                    mode="date"
                    display="compact"
                    minimumDate={minimumPickupDate}
                    accentColor={colors.accent}
                    themeVariant={isDark ? 'dark' : 'light'}
                    onValueChange={(_, date) => setRequestedDate(formatLocalCalendarDate(date))}
                  />
                </View>
              </View>
            ) : (
              <FormInput
                label="Requested Date * (YYYY-MM-DD)"
                value={requestedDate}
                onChangeText={setRequestedDate}
                placeholder="YYYY-MM-DD"
              />
            )}
            <View style={styles.presetRow}>
              <Pressable onPress={() => setRequestedDate(getTodayString())}
                hitSlop={10}
                style={[styles.presetChip, { borderColor: colors.border }]}>
                <Text style={[styles.presetText, { color: colors.primary }]}>Today</Text>
              </Pressable>
              <Pressable onPress={() => setRequestedDate(getTomorrowString())}
                hitSlop={10}
                style={[styles.presetChip, { borderColor: colors.border }]}>
                <Text style={[styles.presetText, { color: colors.primary }]}>Tomorrow</Text>
              </Pressable>
            </View>
          </View>
        </FormCard>

        {/* Requested Time */}
        <FormCard delay={3 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            {Platform.OS === 'ios' ? (
              <View style={styles.nativePickerField}>
                <Text style={[styles.nativePickerLabel, { color: colors.text }]}>Requested Time</Text>
                <View
                  style={[
                    styles.nativePickerControl,
                    { backgroundColor: colors.inputSurface, borderColor: colors.inputBorder },
                  ]}
                >
                  <DateTimePicker
                    value={parseClockTime(requestedTime)}
                    mode="time"
                    display="compact"
                    accentColor={colors.accent}
                    themeVariant={isDark ? 'dark' : 'light'}
                    onValueChange={(_, date) => setRequestedTime(formatClockTime(date))}
                  />
                </View>
              </View>
            ) : (
              <FormInput
                label="Requested Time (Optional)"
                value={requestedTime}
                onChangeText={setRequestedTime}
                placeholder="e.g. 09:00 or 14:00"
              />
            )}
            <View style={styles.presetRow}>
              {['09:00', '11:00', '14:00', '16:00'].map((t) => (
                <Pressable key={t} onPress={() => setRequestedTime(t)}
                  hitSlop={10}
                  style={[styles.presetChip, {
                    borderColor:     requestedTime === t ? colors.accent : colors.border,
                    backgroundColor: requestedTime === t ? colors.accent : 'transparent',
                  }]}>
                  <Text style={[styles.presetText, {
                    color: requestedTime === t ? colors.onPrimary : colors.textMuted,
                  }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </FormCard>

        {/* Material Type */}
        <FormCard delay={4 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput
              label="Material Type *"
              value={materialType}
              onChangeText={setMaterialType}
              placeholder="e.g. Copper, Brass, Heavy Iron"
            />
            <View style={styles.presetRow}>
              {MATERIAL_OPTIONS.map((m) => (
                <Pressable key={m} onPress={() => setMaterialType(m)}
                  hitSlop={10}
                  style={[styles.presetChip, {
                    borderColor:     materialType === m ? colors.accent : colors.border,
                    backgroundColor: materialType === m ? colors.accent : 'transparent',
                  }]}>
                  <Text style={[styles.presetText, {
                    color: materialType === m ? colors.onPrimary : colors.textMuted,
                  }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </FormCard>

        {/* Estimated Weight */}
        <FormCard delay={5 * STAGGER_MS}>
          <FormInput
            label="Estimated Weight (Optional, kg)"
            value={estimatedWeight}
            onChangeText={setEstimatedWeight}
            keyboardType="decimal-pad"
            showDoneAccessory
            placeholder="e.g. 500"
          />
        </FormCard>

        {/* Notes */}
        <FormCard delay={6 * STAGGER_MS}>
          <FormInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Access code, loading dock details, site instructions..."
          />
        </FormCard>

        {/* Submit */}
        <FadeSlide delay={7 * STAGGER_MS}>
          <Button
            title="Submit Pickup Request"
            onPress={() => void handleSubmit()}
            loading={submitting}
            disabled={submitting}
            variant="primary"
            style={styles.submitBtn}
          />
        </FadeSlide>
      </View>

      {/* Customer selector modal */}
      <CustomerSelectorModal
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        onSelect={handleCustomerSelected}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  errorBanner: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Selector trigger ───────────────────────────────────────────────────────
  selectorTrigger: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  selectorTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectorTriggerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectorTriggerName: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  selectorTriggerPhone: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  selectorTriggerPlaceholder: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  selectorTriggerChange: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
  },
  selectorTriggerChevron: {
    fontSize: 20,
    lineHeight: 22,
  },

  // ── Selector modal ─────────────────────────────────────────────────────────
  selectorContainer: {
    flex: 1,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectorTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  selectorClose: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  selectorSearchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  selectorLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  selectorRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  selectorRowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectorName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  selectorPhone: {
    flexShrink: 1,
    maxWidth: '45%',
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  selectorAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectorAddress: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  selectorEmpty: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  selectorFooterLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  selectorFooterError: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectorErrorText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },

  // ── Form chips ─────────────────────────────────────────────────────────────
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.xs,
  },
  nativePickerField: {
    width: '100%',
    marginBottom: spacing.sm,
    gap: 6,
  },
  nativePickerLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.bodyMedium,
    letterSpacing: -0.1,
  },
  nativePickerControl: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  submitBtn: {
    marginTop: spacing.sm,
  },
});
