import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
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
  fetchCustomerById,
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
  AUSTRALIAN_STATE_OPTIONS,
  MATERIAL_OPTIONS,
  parseEstimatedWeightInput,
  validatePickupRequestInput,
} from '@/services/pickup-service';
import {
  PendingSalesRepPickupPhoto,
  discardSalesRepPickupPhoto,
  uploadSalesRepPickupPhoto,
  validatePendingSalesRepPickupPhoto,
} from '@/services/sales-rep-pickup-photo-service';
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

function formatPickerDate(value: string): string {
  const date = parseCalendarDate(value);
  return date
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : value;
}

function formatPickerTime(value: string): string {
  return parseClockTime(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

type IOSPickerMode = 'date' | 'time';

interface IOSPickerFieldProps {
  label: string;
  value: string;
  mode: IOSPickerMode;
  onPress: () => void;
}

function IOSPickerField({ label, value, mode, onPress }: IOSPickerFieldProps) {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme === 'dark');

  return (
    <View style={styles.nativePickerField}>
      <Text style={[styles.nativePickerLabel, { color: colors.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityHint={`Opens the ${mode} picker`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.nativePickerTrigger,
          {
            backgroundColor: colors.inputSurface,
            borderColor: colors.inputBorder,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <AppIcon
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={19}
          color={colors.primary}
        />
        <Text style={[styles.nativePickerValue, { color: colors.inputText }]}>{value}</Text>
        <AppIcon name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

interface IOSPickerSheetProps {
  mode: IOSPickerMode | null;
  value: Date;
  minimumDate: Date;
  onValueChange: (value: Date) => void;
  onCancel: () => void;
  onDone: () => void;
}

function IOSPickerSheet({
  mode,
  value,
  minimumDate,
  onValueChange,
  onCancel,
  onDone,
}: IOSPickerSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = getColors(isDark);
  const { width } = useWindowDimensions();
  const pickerWidth = Math.min(width - spacing.lg * 2, 380);
  const sheetHeight = mode === 'date' ? 470 : 340;

  return (
    <BottomSheet
      index={mode === null ? -1 : 0}
      snapPoints={[sheetHeight]}
      enablePanDownToClose
      onClose={onCancel}
      backgroundStyle={{ backgroundColor: colors.background }}
    >
      <BottomSheetView style={styles.pickerSheet}>
        <View style={[styles.pickerSheetHeader, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.pickerSheetButton, pressed && styles.pickerSheetButtonPressed]}
          >
            <Text style={[styles.pickerSheetAction, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.pickerSheetTitle, { color: colors.text }]}>
            {mode === 'date' ? 'Select Date' : 'Select Time'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.pickerSheetButton, pressed && styles.pickerSheetButtonPressed]}
          >
            <Text style={[styles.pickerSheetDone, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.pickerSheetContent}>
          {mode ? (
            <DateTimePicker
              value={value}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              style={{ width: pickerWidth }}
              minimumDate={mode === 'date' ? minimumDate : undefined}
              accentColor={colors.accent}
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_, date) => onValueChange(date)}
            />
          ) : null}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

type CustomerAvailability = 'loading' | 'available' | 'empty' | 'error';

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CreatePickupScreen() {
  const router      = useRouter();
  const { customerId, pickupAddress: reuseAddress, pickupSuburb: reuseSuburb, pickupState: reuseState, pickupPostcode: reusePostcode } = useLocalSearchParams<{
    customerId?: string;
    pickupAddress?: string;
    pickupSuburb?: string;
    pickupState?: string;
    pickupPostcode?: string;
  }>();
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
  const preloadedCustomerIdRef = useRef<string | null>(null);

  // Form state
  const [pickupAddress,   setPickupAddress]   = useState('');
  const [pickupSuburb,    setPickupSuburb]    = useState('');
  const [pickupState,     setPickupState]     = useState('');
  const [pickupPostcode,  setPickupPostcode]  = useState('');
  const [requestedDate,   setRequestedDate]   = useState(getTodayString());
  const [requestedTime,   setRequestedTime]   = useState('09:00');
  const [materialType,    setMaterialType]    = useState('Copper');
  const [materialDescription, setMaterialDescription] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [siteAccessInstructions, setSiteAccessInstructions] = useState('');
  const [loadingRequirements, setLoadingRequirements] = useState('');
  const [deliveryYardName, setDeliveryYardName] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notes,           setNotes]           = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingSalesRepPickupPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<PendingSalesRepPickupPhoto | null>(null);
  const [submittedPickupId, setSubmittedPickupId] = useState<string | null>(null);
  const [submitting,      setSubmitting]      = useState(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [activeIOSPicker, setActiveIOSPicker] = useState<IOSPickerMode | null>(null);
  const [pickerDraft, setPickerDraft] = useState(() => new Date());
  const isSubmittingRef = useRef(false);
  const pickupAttemptRef = useRef<{
    clientRequestId: string;
    fingerprint: string;
    attempted: boolean;
  } | null>(null);
  const minimumPickupDate = new Date();
  minimumPickupDate.setHours(0, 0, 0, 0);

  const showSubmissionFailure = (message: string) => {
    setFormError(message);
    showErrorMessage(message, 'Submission Error');
  };

  const openIOSPicker = (mode: IOSPickerMode) => {
    setPickerDraft(
      mode === 'date'
        ? (parseCalendarDate(requestedDate) ?? minimumPickupDate)
        : parseClockTime(requestedTime),
    );
    setActiveIOSPicker(mode);
  };

  const applyIOSPicker = () => {
    if (activeIOSPicker === 'date') {
      setRequestedDate(formatLocalCalendarDate(pickerDraft));
    } else if (activeIOSPicker === 'time') {
      setRequestedTime(formatClockTime(pickerDraft));
    }
    setActiveIOSPicker(null);
  };

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

  React.useEffect(() => {
    const normalizedCustomerId = customerId?.trim();
    if (!normalizedCustomerId || preloadedCustomerIdRef.current === normalizedCustomerId) return;
    preloadedCustomerIdRef.current = normalizedCustomerId;

    const preload = async () => {
      const result = await fetchCustomerById(normalizedCustomerId);
      if (!result.success || !result.customer) {
        setFormError(result.error ?? 'This customer is no longer available.');
        return;
      }
      setSelectedCustomer(result.customer);
      setPickupAddress(reuseAddress?.trim() || result.customer.address);
      setPickupSuburb(reuseSuburb?.trim() || '');
      setPickupState(reuseState?.trim() || '');
      setPickupPostcode(reusePostcode?.trim() || '');
    };
    void preload();
  }, [customerId, reuseAddress, reusePostcode, reuseState, reuseSuburb]);

  const handleCustomerSelected = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPickupAddress(customer.address);
    setFormError(null);
    setSelectorVisible(false);
  };

  const uploadPhotosForPickup = useCallback(async (
    pickupRequestId: string,
    photos: PendingSalesRepPickupPhoto[],
  ): Promise<boolean> => {
    if (photos.length === 0) return true;

    const results = await Promise.all(photos.map(async (photo) => {
      setPendingPhotos((current) => current.map((item) => (
        item.id === photo.id ? { ...item, status: 'uploading', error: undefined } : item
      )));
      const result = await uploadSalesRepPickupPhoto(pickupRequestId, photo);
      return { photo, result };
    }));

    setPendingPhotos((current) => current.flatMap((item) => {
      const outcome = results.find((result) => result.photo.id === item.id);
      if (!outcome) return [item];
      if (outcome.result.success) return [];
      return [{
        ...item,
        status: 'failed' as const,
        error: outcome.result.error,
        remotePhotoId: outcome.result.photoId ?? item.remotePhotoId,
        storagePath: outcome.result.storagePath ?? item.storagePath,
      }];
    }));

    return results.every(({ result }) => result.success);
  }, []);

  const selectPhoto = useCallback(async (source: 'camera' | 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showErrorMessage(
          source === 'camera'
            ? 'Camera access is needed to take a scrap photo.'
            : 'Photo library access is needed to choose a scrap photo.',
          'Permission needed',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        ...(source === 'camera' ? { cameraType: ImagePicker.CameraType.back } : {}),
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/png') {
        showErrorMessage('Choose a JPEG or PNG photo. iPhone photos should be shared in a compatible format.', 'Unsupported photo');
        return;
      }
      const photo: PendingSalesRepPickupPhoto = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize ?? undefined,
        status: 'ready',
      };
      const validationError = validatePendingSalesRepPickupPhoto(photo);
      if (validationError) {
        showErrorMessage(validationError, 'Unsupported photo');
        return;
      }
      setPendingPhotos((current) => [...current, photo]);
    } catch {
      showErrorMessage('Unable to open the camera or photo library. Please try again.', 'Photo unavailable');
    }
  }, []);

  const removePendingPhoto = useCallback(async (photo: PendingSalesRepPickupPhoto) => {
    if (photo.status === 'uploading') return;
    const discarded = await discardSalesRepPickupPhoto(photo);
    if (!discarded.success) {
      showErrorMessage(discarded.error, 'Photo not removed');
      return;
    }
    setPendingPhotos((current) => current.filter((item) => item.id !== photo.id));
    setPreviewPhoto((current) => current?.id === photo.id ? null : current);
  }, []);

  const handleSubmit = async () => {
    if (isSubmittingRef.current || submitting) return;

    if (submittedPickupId) {
      isSubmittingRef.current = true;
      setFormError(null);
      setSubmitting(true);
      try {
        const uploaded = await uploadPhotosForPickup(submittedPickupId, pendingPhotos);
        if (!uploaded) {
          showSubmissionFailure('Pickup request was submitted, but one or more scrap photos failed. Tap Retry Uploads to try again.');
          return;
        }
        showInfoMessage('Pickup request submitted successfully');
        router.push('/(sales-rep)/(home)');
      } catch {
        showSubmissionFailure('Pickup request was submitted, but uploads could not be retried. Check your connection and try again.');
      } finally {
        isSubmittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

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
      pickupSuburb,
      pickupState,
      pickupPostcode,
      requestedDate,
      requestedTime,
      materialType,
      materialDescription,
      estimatedWeight: weightResult.value,
      siteAccessInstructions,
      loadingRequirements,
      deliveryYardName,
      leadSource,
      internalNotes,
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
        if (pendingPhotos.length > 0 && result.request) {
          setSubmittedPickupId(result.request.id);
          const uploaded = await uploadPhotosForPickup(result.request.id, pendingPhotos);
          if (!uploaded) {
            showSubmissionFailure('Pickup request was submitted, but one or more scrap photos failed. Tap Retry Uploads to try again.');
            return;
          }
        }
        showInfoMessage('Pickup request submitted successfully');
        router.push('/(sales-rep)/(home)');
      } else {
        const msg = result.error ?? 'Failed to submit pickup request.';
        showSubmissionFailure(msg);
      }
    } catch {
      showSubmissionFailure('Unable to submit the pickup request. Check your connection and try again.');
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Still checking whether customers exist
  if (customerAvailability === 'loading') {
    return (
      <ScreenScaffold
        mode="scroll"
        header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}
      >
        <LoadingState message="Loading customer directory..." />
      </ScreenScaffold>
    );
  }

  if (customerAvailability === 'error') {
    return (
      <ScreenScaffold
        mode="scroll"
        header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}
      >
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
      <ScreenScaffold
        mode="scroll"
        header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}
      >
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Customer</Text>
        <FormCard delay={0 * STAGGER_MS}>
          <CustomerSelectorField
            selected={selectedCustomer}
            onPress={() => setSelectorVisible(true)}
            colors={colors}
          />
        </FormCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup Location</Text>
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

        <FormCard delay={2 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput
              label="Pickup Suburb *"
              value={pickupSuburb}
              onChangeText={setPickupSuburb}
              autoCapitalize="words"
              placeholder="e.g. South Wharf"
            />
            <FormInput
              label="State / Territory *"
              value={pickupState}
              editable={false}
              placeholder="Choose below"
            />
            <View style={styles.presetRow}>
              {AUSTRALIAN_STATE_OPTIONS.map((state) => (
                <Pressable key={state} onPress={() => setPickupState(state)} hitSlop={10}
                  style={[styles.presetChip, {
                    borderColor: pickupState === state ? colors.accent : colors.border,
                    backgroundColor: pickupState === state ? colors.accent : 'transparent',
                  }]}>
                  <Text style={[styles.presetText, { color: pickupState === state ? colors.onPrimary : colors.textMuted }]}>{state}</Text>
                </Pressable>
              ))}
            </View>
            <FormInput
              label="Postcode *"
              value={pickupPostcode}
              onChangeText={setPickupPostcode}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. 3006"
            />
          </View>
        </FormCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Material</Text>
        <FormCard delay={3 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput
              label="Material Category *"
              value={materialType}
              editable={false}
              placeholder="Choose below"
            />
            <View style={styles.presetRow}>
              {MATERIAL_OPTIONS.map((m) => (
                <Pressable key={m} onPress={() => setMaterialType(m)} hitSlop={10}
                  style={[styles.presetChip, {
                    borderColor: materialType === m ? colors.accent : colors.border,
                    backgroundColor: materialType === m ? colors.accent : 'transparent',
                  }]}>
                  <Text style={[styles.presetText, { color: materialType === m ? colors.onPrimary : colors.textMuted }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <FormInput label="Material Description (Optional)" value={materialDescription} onChangeText={setMaterialDescription} multiline numberOfLines={3} placeholder="Describe grade, condition, or items" />
            <FormInput label="Estimated Weight or Quantity (Optional, kg)" value={estimatedWeight} onChangeText={setEstimatedWeight} keyboardType="decimal-pad" showDoneAccessory placeholder="e.g. 500" />
          </View>
        </FormCard>

        <FormCard delay={4 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Scrap Photos (Optional)</Text>
            <Text style={[styles.helpText, { color: colors.textMuted }]}>Photos upload after the pickup request is created. Failed uploads stay here so you can retry.</Text>
            <View style={styles.photoActions}>
              <Button title="Take Photo" variant="secondary" onPress={() => void selectPhoto('camera')} disabled={submitting} />
              <Button title="Choose Photo" variant="secondary" onPress={() => void selectPhoto('library')} disabled={submitting} />
            </View>
            {pendingPhotos.map((photo, index) => (
              <View key={photo.id} style={[styles.photoRow, { borderColor: colors.border }]}>
                <View style={styles.photoRowContent}>
                  <Pressable
                    onPress={() => setPreviewPhoto(photo)}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview scrap photo ${index + 1}`}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                  </Pressable>
                  <View style={styles.photoDetails}>
                    <Text style={[styles.photoName, { color: colors.text }]}>Scrap photo {index + 1}</Text>
                    <Text style={[styles.photoStatus, { color: photo.status === 'failed' ? colors.danger : colors.textMuted }]}>{photo.status === 'failed' ? photo.error ?? 'Upload failed' : photo.status === 'uploading' ? 'Uploading…' : 'Ready to upload'}</Text>
                    <View style={styles.photoRowActions}>
                      <Pressable onPress={() => setPreviewPhoto(photo)} accessibilityRole="button"><Text style={[styles.photoActionText, { color: colors.primary }]}>Preview</Text></Pressable>
                      {photo.status !== 'uploading' ? <Pressable onPress={() => void removePendingPhoto(photo)} accessibilityRole="button"><Text style={[styles.photoActionText, { color: colors.danger }]}>Remove</Text></Pressable> : null}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </FormCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pickup Timing</Text>
        <FormCard delay={3 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            {Platform.OS === 'ios' ? (
              <IOSPickerField
                label="Requested Date *"
                value={formatPickerDate(requestedDate)}
                mode="date"
                onPress={() => openIOSPicker('date')}
              />
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

        <FormCard delay={4 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            {Platform.OS === 'ios' ? (
              <IOSPickerField
                label="Requested Time (Optional)"
                value={formatPickerTime(requestedTime)}
                mode="time"
                onPress={() => openIOSPicker('time')}
              />
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Site / Loading</Text>
        <FormCard delay={5 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput label="Site Access Instructions (Optional)" value={siteAccessInstructions} onChangeText={setSiteAccessInstructions} multiline numberOfLines={3} placeholder="Gate access, contact on arrival, access code" />
            <FormInput label="Loading Requirements (Optional)" value={loadingRequirements} onChangeText={setLoadingRequirements} multiline numberOfLines={3} placeholder="Forklift, loading dock, manual handling" />
            <FormInput label="Special Instructions (Optional)" value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Anything the Operations team should know" />
          </View>
        </FormCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery / Internal</Text>
        <FormCard delay={6 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput label="Delivery Yard (Optional)" value={deliveryYardName} onChangeText={setDeliveryYardName} placeholder="Yard name, if known" />
            <FormInput label="Lead Source (Optional)" value={leadSource} onChangeText={setLeadSource} placeholder="e.g. referral, web, repeat customer" />
            <FormInput label="Internal Notes (Optional)" value={internalNotes} onChangeText={setInternalNotes} multiline numberOfLines={3} placeholder="Internal Operations notes" />
          </View>
        </FormCard>

        {/* Submit */}
        <FadeSlide delay={7 * STAGGER_MS}>
          {formError ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.submitError, { backgroundColor: colors.surface, borderColor: colors.danger }]}
            >
              <Text style={[styles.submitErrorTitle, { color: colors.danger }]}>Please check the form</Text>
              <Text style={[styles.errorBanner, { color: colors.danger }]}>{formError}</Text>
            </View>
          ) : null}
          <Button
            title={submittedPickupId ? 'Retry Uploads' : 'Submit Pickup Request'}
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
      <IOSPickerSheet
        mode={activeIOSPicker}
        value={pickerDraft}
        minimumDate={minimumPickupDate}
        onValueChange={setPickerDraft}
        onCancel={() => setActiveIOSPicker(null)}
        onDone={applyIOSPicker}
      />
      <Modal visible={Boolean(previewPhoto)} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewPhoto(null)}>
          <Pressable style={[styles.previewCard, { backgroundColor: colors.surface }]} onPress={() => undefined}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>Scrap photo preview</Text>
              <Pressable onPress={() => setPreviewPhoto(null)} accessibilityRole="button" accessibilityLabel="Close photo preview"><Text style={[styles.photoActionText, { color: colors.primary }]}>Close</Text></Pressable>
            </View>
            {previewPhoto ? <Image source={{ uri: previewPhoto.uri }} resizeMode="contain" style={styles.previewImage} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  submitError: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    marginBottom: spacing.sm,
  },
  submitErrorTitle: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.md,
    marginTop: spacing.sm,
  },
  helpText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: 17,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoRow: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 2,
  },
  photoRowContent: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoThumbnail: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: '#D9D9D9',
  },
  photoDetails: {
    flex: 1,
    gap: 2,
  },
  photoRowActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  photoActionText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.xs,
  },
  photoName: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
  },
  photoStatus: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  previewCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.fontSize.md,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 480,
    borderRadius: radius.md,
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
  nativePickerTrigger: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nativePickerValue: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  pickerSheet: {
    flex: 1,
  },
  pickerSheetHeader: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerSheetButton: {
    minWidth: 64,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSheetButtonPressed: {
    opacity: 0.55,
  },
  pickerSheetAction: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
  },
  pickerSheetDone: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  pickerSheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  pickerSheetContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },

  submitBtn: {
    marginTop: spacing.sm,
  },
});
