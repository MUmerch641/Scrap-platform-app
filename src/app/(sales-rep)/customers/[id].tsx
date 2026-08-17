import { Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { fetchCustomerById, Customer } from '@/services/customer-service';
import { CustomerPickupHistoryItem, fetchCustomerPickupHistory, fetchSalesRepPickupPhotos, SalesRepPickupPhoto } from '@/services/customer-history-service';
import { showErrorMessage } from '@/services/native-feedback-service';
import { formatPickupCalendarDate, formatPickupCreatedAt, formatPickupWeight } from '@/shared/pickup-formatters';
import { radius, semanticColors, spacing, typography } from '@/shared/theme';

const HISTORY_PAGE_SIZE = 15;

function formatStatus(value: string): string {
  return value.split('_').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function formatLocation(item: Pick<CustomerPickupHistoryItem, 'pickupAddress' | 'pickupSuburb' | 'pickupState' | 'pickupPostcode'>): string {
  return [item.pickupAddress, item.pickupSuburb, item.pickupState, item.pickupPostcode].filter(Boolean).join(', ');
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerPickupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photosByPickup, setPhotosByPickup] = useState<Record<string, SalesRepPickupPhoto[]>>({});
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);

  const load = useCallback(async (page = 0, append = false) => {
    if (!id?.trim()) { setError('Customer not found.'); setLoading(false); return; }
    if (append) setLoadingMore(true); else setLoading(true);
    const [customerResult, historyResult] = await Promise.all([
      fetchCustomerById(id),
      fetchCustomerPickupHistory(id, page, HISTORY_PAGE_SIZE),
    ]);
    if (!customerResult.success || !customerResult.customer) {
      setError(customerResult.error ?? 'Customer not found.');
      setCustomer(null);
      setHistory([]);
      setHasMore(false);
    } else if (!historyResult.success) {
      setCustomer(customerResult.customer);
      setError(historyResult.error);
    } else {
      setCustomer(customerResult.customer);
      setHistory((current) => append ? [...current, ...historyResult.items] : historyResult.items);
      setHasMore(historyResult.hasMore);
      setError(null);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const locations = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((item) => {
      const key = [item.pickupAddress, item.pickupSuburb, item.pickupState, item.pickupPostcode]
        .map((value) => value?.trim().toLowerCase() ?? '').join('|');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [history]);

  const openNative = async (url: string, unavailable: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showErrorMessage(unavailable, 'Unavailable');
    }
  };

  const openPhotos = async (pickupRequestId: string) => {
    if (photosByPickup[pickupRequestId] || loadingPhotoId) return;
    setLoadingPhotoId(pickupRequestId);
    const result = await fetchSalesRepPickupPhotos(pickupRequestId);
    setLoadingPhotoId(null);
    if (!result.success) { showErrorMessage(result.error, 'Photos unavailable'); return; }
    setPhotosByPickup((current) => ({ ...current, [pickupRequestId]: result.photos }));
  };

  const startPickup = (location?: CustomerPickupHistoryItem) => {
    if (!customer) return;
    router.push({
      pathname: '/(sales-rep)/create-job',
      params: {
        customerId: customer.id,
        ...(location ? {
          pickupAddress: location.pickupAddress,
          pickupSuburb: location.pickupSuburb ?? '',
          pickupState: location.pickupState ?? '',
          pickupPostcode: location.pickupPostcode ?? '',
        } : {}),
      },
    });
  };

  if (loading) return <ScreenScaffold mode="scroll" iosNativeHeader header={<AppHeader title="Customer" onBack={() => router.back()} />}><LoadingState message="Loading customer..." /></ScreenScaffold>;
  if (!customer) return <ScreenScaffold mode="scroll" iosNativeHeader header={<AppHeader title="Customer" onBack={() => router.back()} />}><EmptyState title="Customer unavailable" message={error ?? 'This customer is no longer available.'} action={<Button title="Back to Customers" onPress={() => router.back()} />} /></ScreenScaffold>;

  const phone = customer.phone.replace(/[^\d+]/g, '');
  return (
    <ScreenScaffold mode="scroll" iosNativeHeader header={<AppHeader title={customer.name} subtitle="Customer record" onBack={() => router.back()} />}>
      <View style={styles.container}>
        <View style={styles.actions}>
          <Button title="Create New Pickup" onPress={() => startPickup()} style={styles.primaryAction} />
          <Button title="Add Follow-Up" variant="secondary" onPress={() => router.push({ pathname: '/(sales-rep)/follow-ups', params: { customerId: customer.id, customerName: customer.name } } as unknown as Href)} style={styles.primaryAction} />
          <Button title="Edit Customer" variant="outline" onPress={() => router.push({ pathname: '/(sales-rep)/customers/form', params: { editCustomerId: customer.id } } as unknown as Href)} style={styles.primaryAction} />
        </View>

        <Section title="Overview" colors={colors}>
          <Detail label="Customer Type" value={formatStatus(customer.customerType)} colors={colors} />
          <Detail label="Customer Status" value={formatStatus(customer.customerStatus)} colors={colors} />
          {customer.notes ? <Detail label="Notes" value={customer.notes} colors={colors} /> : null}
        </Section>

        <Section title="Contact" colors={colors}>
          {customer.contactPerson ? <Detail label="Contact Person" value={customer.contactPerson} colors={colors} /> : null}
          <Detail label="Phone" value={customer.phone} colors={colors} />
          {customer.email ? <Detail label="Email" value={customer.email} colors={colors} /> : null}
          {customer.preferredContactMethod ? <Detail label="Preferred Contact" value={customer.preferredContactMethod.toUpperCase()} colors={colors} /> : null}
          <View style={styles.actions}>
            <Button title="Call" variant="secondary" onPress={() => void openNative(`tel:${phone}`, 'This device cannot place calls.')} style={styles.actionButton} />
            <Button title="Message" variant="secondary" onPress={() => void openNative(`sms:${phone}`, 'This device cannot send messages.')} style={styles.actionButton} />
            {customer.email ? <Button title="Email" variant="secondary" onPress={() => void openNative(`mailto:${customer.email?.trim() ?? ''}`, 'This device cannot send email.')} style={styles.actionButton} /> : null}
          </View>
        </Section>

        <Section title="Addresses" colors={colors}>
          <Detail label="Main Address" value={customer.address} colors={colors} />
          {customer.billingAddress ? <Detail label="Billing Address" value={customer.billingAddress} colors={colors} /> : null}
          {customer.abn ? <Detail label="ABN" value={customer.abn} colors={colors} /> : null}
        </Section>

        <Section title="Previous Pickup Locations" colors={colors}>
          {locations.length === 0 ? <Text style={[styles.muted, { color: colors.textMuted }]}>No previous pickup locations yet.</Text> : locations.map((item) => (
            <View key={item.pickupRequestId} style={[styles.historyRow, { borderColor: colors.border }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>{formatLocation(item)}</Text>
              <Pressable onPress={() => startPickup(item)} accessibilityRole="button"><Text style={[styles.reuseText, { color: colors.primary }]}>Use This Location</Text></Pressable>
            </View>
          ))}
        </Section>

        <Section title="Previous Pickups & Material History" colors={colors}>
          {history.length === 0 ? <Text style={[styles.muted, { color: colors.textMuted }]}>No previous pickups yet.</Text> : history.map((item) => (
            <View key={item.pickupRequestId} style={[styles.historyRow, { borderColor: colors.border }]}>
              <Text style={[styles.historyTitle, { color: colors.text }]}>{item.materialType}</Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{formatPickupCalendarDate(item.requestedDate)} · {formatStatus(item.pickupStatus)}</Text>
              {item.materialDescription ? <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{item.materialDescription}</Text> : null}
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Estimated: {formatPickupWeight(item.estimatedWeight) ?? '—'} · Actual: {formatPickupWeight(item.actualCollectedWeight) ?? '—'}</Text>
              <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{formatLocation(item)} · Created {formatPickupCreatedAt(item.createdAt)}</Text>
              {item.executionStatus ? <Text style={[styles.historyMeta, { color: colors.textMuted }]}>Execution: {formatStatus(item.executionStatus)}{item.scheduledAt ? ` · Scheduled ${formatPickupCalendarDate(item.scheduledAt.slice(0, 10))}` : ''}</Text> : null}
              <Pressable onPress={() => void openPhotos(item.pickupRequestId)} accessibilityRole="button"><Text style={[styles.reuseText, { color: colors.primary }]}>{loadingPhotoId === item.pickupRequestId ? 'Loading Photos…' : 'View Scrap Photos'}</Text></Pressable>
              {(photosByPickup[item.pickupRequestId] ?? []).map((photo) => photo.signedUrl ? <Image key={photo.id} source={{ uri: photo.signedUrl }} style={styles.photo} /> : null)}
            </View>
          ))}
          {hasMore ? <Button title="Load More" variant="outline" loading={loadingMore} onPress={() => void load(Math.ceil(history.length / HISTORY_PAGE_SIZE), true)} /> : null}
        </Section>
        {error ? <Text style={[styles.muted, { color: colors.danger }]}>{error}</Text> : null}
      </View>
    </ScreenScaffold>
  );
}

function Section({ title, colors, children }: { title: string; colors: (typeof semanticColors)[keyof typeof semanticColors]; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text><Card>{children}</Card></View>;
}

function Detail({ label, value, colors }: { label: string; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) {
  return <View style={styles.detail}><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.value, { color: colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md }, section: { gap: spacing.xs }, sectionTitle: { fontFamily: typography.fontFamily.heading, fontSize: typography.fontSize.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, primaryAction: { flexGrow: 1 }, actionButton: { flexGrow: 1 }, detail: { gap: 2 }, label: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs, textTransform: 'uppercase' }, value: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: 20 }, muted: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm }, historyRow: { gap: spacing.xs, borderTopWidth: 1, paddingTop: spacing.sm }, historyTitle: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm }, historyMeta: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: 17 }, reuseText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm }, photo: { width: 96, height: 96, borderRadius: radius.md, marginTop: spacing.xs, backgroundColor: '#ddd' },
});
