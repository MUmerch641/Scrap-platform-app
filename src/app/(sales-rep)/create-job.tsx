import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { SearchField } from '@/components/ui/search-field';
import {
  Customer,
  fetchCustomers,
  fetchCustomersPage,
} from '@/services/customer-service';
import {
  showErrorMessage,
  showInfoMessage,
} from '@/services/native-feedback-service';
import { createPickupRequest } from '@/services/pickup-service';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────────────────────────
const MATERIAL_OPTIONS = ['Copper', 'Brass', 'Aluminum', 'Heavy Iron', 'Mixed Scrap'];
const SELECTOR_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

const STAGGER_MS  = 55;
const DURATION_MS = 320;
const EASE        = Easing.out(Easing.cubic);
// ─────────────────────────────────────────────────────────────────────────────

// ── Animation helpers ─────────────────────────────────────────────────────────
interface FadeSlideProps { children: React.ReactNode; delay: number; }
function FadeSlide({ children, delay }: FadeSlideProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(0);
  React.useEffect(() => {
    const cfg = { duration: DURATION_MS, easing: EASE };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(12, cfg));
  }, [delay, opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: 12 - translateY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

interface FormCardProps { children: React.ReactNode; delay: number; }
function FormCard({ children, delay }: FormCardProps) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.96);
  React.useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION_MS, easing: EASE }));
    scale.value   = withDelay(delay, withSpring(1, { mass: 0.5, stiffness: 230, damping: 20 }));
  }, [delay, opacity, scale]);
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

  const [search,      setSearch]      = useState('');
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);

  const pageRef           = useRef(0);
  const activeSearchRef   = useRef('');
  const debounceRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef      = useRef(false);
  // Track the last visibility value so we only trigger on rising edge (false→true)
  const prevVisibleRef    = useRef(false);

  // Load a page of customers into the selector
  const loadPage = useCallback(async (term: string, page: number, append: boolean) => {
    if (page === 0) setLoading(true);
    else setLoadingMore(true);

    const result = await fetchCustomersPage(term, page, SELECTOR_PAGE_SIZE);

    setLoading(false);
    setLoadingMore(false);

    if (!result.success) return;

    pageRef.current = page;
    setHasMore(result.hasMore);
    setCustomers(prev => append ? [...prev, ...result.customers] : result.customers);
  }, []);

  // Trigger reset+load only on the rising edge (modal just opened).
  // All setState calls here are inside an async callback, not synchronous in the effect body.
  React.useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    isMountedRef.current = visible;

    if (!justOpened) return;

    // Defer state resets so they are not synchronous in the effect body
    const reset = async () => {
      setSearch('');
      setCustomers([]);
      activeSearchRef.current = '';
      await loadPage('', 0, false);
    };
    void reset();
  }, [visible, loadPage]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      activeSearchRef.current = text;
      void loadPage(text, 0, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
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
      accessibilityLabel={`Select ${item.name}`}
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
      <ActivityIndicator size="small" color={colors.primary} />
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
            placeholder="Search by name, phone or email…"
          />
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.selectorLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={[styles.selectorEmpty, { color: colors.textMuted }]}>
                {search ? `No customers match "${search}"` : 'No customers found.'}
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
              Select a customer…
            </Text>
            <Text style={[styles.selectorTriggerChevron, { color: colors.textMuted }]}>›</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTomorrowString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CreatePickupScreen() {
  const router      = useRouter();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const colors      = getColors(isDark);

  // Customer selector state
  const [selectedCustomer,    setSelectedCustomer]    = useState<Customer | null>(null);
  const [selectorVisible,     setSelectorVisible]     = useState(false);
  const [hasAnyCustomers,     setHasAnyCustomers]     = useState<boolean | null>(null); // null = loading
  const hasAutoSelectedRef    = useRef(false);

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

  // On focus: check whether there are any customers at all (for empty state)
  // and auto-select the first one once on first load.
  const checkCustomers = useCallback(async () => {
    const result = await fetchCustomers();
    if (result.success) {
      setHasAnyCustomers(result.customers.length > 0);
      if (result.customers.length > 0 && !hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        const first = result.customers[0];
        setSelectedCustomer(first);
        setPickupAddress(first.address);
      }
    } else {
      setHasAnyCustomers(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void checkCustomers();
    }, [checkCustomers])
  );

  const handleCustomerSelected = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPickupAddress(customer.address);
    setSelectorVisible(false);
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || submitting) return;

    if (!selectedCustomer) {
      setFormError('Please select a customer.');
      return;
    }
    if (!pickupAddress.trim()) {
      setFormError('Pickup address is required.');
      return;
    }
    if (!requestedDate.trim()) {
      setFormError('Requested date is required.');
      return;
    }
    if (!materialType.trim()) {
      setFormError('Material type is required.');
      return;
    }

    isSubmittingRef.current = true;
    setFormError(null);
    setSubmitting(true);

    try {
      const weightNum = estimatedWeight.trim() ? parseFloat(estimatedWeight.trim()) : undefined;
      const result = await createPickupRequest({
        customerId:      selectedCustomer.id,
        pickupAddress:   pickupAddress.trim(),
        requestedDate:   requestedDate.trim(),
        requestedTime:   requestedTime.trim() || undefined,
        materialType:    materialType.trim(),
        estimatedWeight: weightNum && !isNaN(weightNum) ? weightNum : undefined,
        notes:           notes.trim() || undefined,
      });

      if (result.success) {
        showInfoMessage('Pickup request submitted successfully');
        router.push('/(sales-rep)');
      } else {
        const msg = result.error ?? 'Failed to submit pickup request.';
        setFormError(msg);
        showErrorMessage(msg, 'Submission Error');
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Still checking whether customers exist
  if (hasAnyCustomers === null) {
    return (
      <ScreenScaffold mode="scroll" header={<AppHeader title="Create Pickup" subtitle="New pickup request" />}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading customer directory…
          </Text>
        </View>
      </ScreenScaffold>
    );
  }

  if (!hasAnyCustomers) {
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
            <FormInput
              label="Requested Date * (YYYY-MM-DD)"
              value={requestedDate}
              onChangeText={setRequestedDate}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.presetRow}>
              <Pressable onPress={() => setRequestedDate(getTodayString())}
                style={[styles.presetChip, { borderColor: colors.border }]}>
                <Text style={[styles.presetText, { color: colors.primary }]}>Today</Text>
              </Pressable>
              <Pressable onPress={() => setRequestedDate(getTomorrowString())}
                style={[styles.presetChip, { borderColor: colors.border }]}>
                <Text style={[styles.presetText, { color: colors.primary }]}>Tomorrow</Text>
              </Pressable>
            </View>
          </View>
        </FormCard>

        {/* Requested Time */}
        <FormCard delay={3 * STAGGER_MS}>
          <View style={styles.fieldBlock}>
            <FormInput
              label="Requested Time (Optional)"
              value={requestedTime}
              onChangeText={setRequestedTime}
              placeholder="e.g. 09:00 or 14:00"
            />
            <View style={styles.presetRow}>
              {['09:00', '11:00', '14:00', '16:00'].map((t) => (
                <Pressable key={t} onPress={() => setRequestedTime(t)}
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
            placeholder="Access code, loading dock details, site instructions…"
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
    gap: 2,
  },
  selectorTriggerName: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  selectorTriggerPhone: {
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
  },
  selectorRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  selectorRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectorName: {
    flex: 1,
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  selectorPhone: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
  },
  selectorAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectorAddress: {
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

  submitBtn: {
    marginTop: spacing.sm,
  },
});
