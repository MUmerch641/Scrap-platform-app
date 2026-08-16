import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormInput } from '@/components/ui/form-input';
import { LoadingState } from '@/components/ui/loading-state';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { completeFollowUp, createFollowUp, fetchMyFollowUps, FollowUpView, rescheduleFollowUp, SalesRepFollowUp } from '@/services/follow-up-service';
import { showErrorMessage, showSuccessMessage } from '@/services/native-feedback-service';
import { semanticColors, spacing, typography } from '@/shared/theme';

const views: FollowUpView[] = ['today', 'upcoming', 'overdue'];
type ModalMode = 'create' | 'complete' | 'reschedule' | null;
const label = (value: string) => value.split('_').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
const localDateTime = (value: string) => { const date = new Date(value); return { date: date.toISOString().slice(0, 10), time: date.toTimeString().slice(0, 5) }; };
const iso = (date: string, time: string) => new Date(`${date}T${time || '09:00'}:00`).toISOString();

export default function FollowUpsScreen() {
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [view, setView] = useState<FollowUpView>('today');
  const [items, setItems] = useState<SalesRepFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(params.customerId ? 'create' : null);
  const [selected, setSelected] = useState<SalesRepFollowUp | null>(null);
  const now = localDateTime(new Date().toISOString());
  const [dueDate, setDueDate] = useState(now.date);
  const [dueTime, setDueTime] = useState('09:00');
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchMyFollowUps(view);
    if (result.success) { setItems(result.items); setError(null); } else setError(result.error);
    setLoading(false);
  }, [view]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openCreate = () => {
    if (!params.customerId) { showErrorMessage('Open a customer record first to create a follow-up.', 'Select customer'); return; }
    setModal('create');
  };
  const closeModal = () => { if (!saving) setModal(null); };
  const save = async () => {
    setSaving(true);
    let result: { success: boolean; error?: string };
    if (modal === 'create' && params.customerId) result = await createFollowUp(params.customerId, iso(dueDate, dueTime), purpose, note);
    else if (modal === 'complete' && selected) result = await completeFollowUp(selected.id, outcome);
    else if (modal === 'reschedule' && selected) result = await rescheduleFollowUp(selected.id, iso(dueDate, dueTime));
    else { setSaving(false); return; }
    setSaving(false);
    if (!result.success) { showErrorMessage(result.error ?? 'Unable to save follow-up.', 'Follow-up'); return; }
    setModal(null); setSelected(null); setPurpose(''); setNote(''); setOutcome('');
    showSuccessMessage('Follow-up saved'); void load();
  };
  const openReschedule = (item: SalesRepFollowUp) => {
    const next = localDateTime(item.dueAt);
    setSelected(item); setDueDate(next.date); setDueTime(next.time); setModal('reschedule');
  };

  if (loading) return <ScreenScaffold header={<AppHeader title="Follow-Ups" subtitle="Customer follow-up" />}><LoadingState message="Loading follow-ups..." /></ScreenScaffold>;
  return <ScreenScaffold mode="scroll" header={<AppHeader title="Follow-Ups" subtitle="Customer follow-up" />}><View style={styles.container}>
    <View style={styles.tabs}>{views.map((item) => <Pressable key={item} onPress={() => setView(item)} accessibilityRole="tab" accessibilityState={{ selected: view === item }} style={[styles.tab, { borderColor: colors.border, backgroundColor: view === item ? colors.primary : colors.surface }]}><Text style={[styles.tabText, { color: view === item ? colors.onPrimary : colors.text }]}>{label(item)}</Text></Pressable>)}</View>
    {params.customerName ? <View style={[styles.customerContext, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.contextCopy}><Text style={[styles.contextLabel, { color: colors.textMuted }]}>Customer</Text><Text style={[styles.contextText, { color: colors.text }]} numberOfLines={1}>{params.customerName}</Text></View><Button title="Add Follow-Up" onPress={openCreate} /></View> : null}
    {error ? <EmptyState title="Unable to load follow-ups" message={error} action={<Button title="Try Again" onPress={() => void load()} />} /> : items.length === 0 ? <EmptyState title={`No ${label(view).toLowerCase()} follow-ups`} message="Follow-ups created from a customer record will appear here." action={params.customerId ? <Button title="Add Follow-Up" onPress={openCreate} /> : undefined} /> : items.map((item) => <FollowUpRow key={item.id} item={item} colors={colors} onComplete={() => { setSelected(item); setOutcome(''); setModal('complete'); }} onReschedule={() => openReschedule(item)} />)}
    <FollowUpEditor mode={modal} colors={colors} customerName={params.customerName} dueDate={dueDate} dueTime={dueTime} purpose={purpose} note={note} outcome={outcome} saving={saving} onClose={closeModal} onDueDateChange={setDueDate} onDueTimeChange={setDueTime} onPurposeChange={setPurpose} onNoteChange={setNote} onOutcomeChange={setOutcome} onSave={() => void save()} />
  </View></ScreenScaffold>;
}

function FollowUpRow({ item, colors, onComplete, onReschedule }: { item: SalesRepFollowUp; colors: (typeof semanticColors)[keyof typeof semanticColors]; onComplete: () => void; onReschedule: () => void }) {
  return <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.rowHeading}><Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>{item.customerName}</Text><Text style={[styles.status, { color: item.status === 'rescheduled' ? colors.warning : colors.primary }]}>{label(item.status)}</Text></View><Text style={[styles.copy, { color: colors.text }]}>{item.purpose}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(item.dueAt).toLocaleString()}</Text>{item.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{item.note}</Text> : null}<View style={styles.actions}><Button title="Complete" variant="secondary" style={styles.actionButton} onPress={onComplete} /><Button title="Reschedule" variant="outline" style={styles.actionButton} onPress={onReschedule} /></View></View>;
}

function FollowUpEditor({ mode, colors, customerName, dueDate, dueTime, purpose, note, outcome, saving, onClose, onDueDateChange, onDueTimeChange, onPurposeChange, onNoteChange, onOutcomeChange, onSave }: { mode: ModalMode; colors: (typeof semanticColors)[keyof typeof semanticColors]; customerName?: string | string[]; dueDate: string; dueTime: string; purpose: string; note: string; outcome: string; saving: boolean; onClose: () => void; onDueDateChange: (value: string) => void; onDueTimeChange: (value: string) => void; onPurposeChange: (value: string) => void; onNoteChange: (value: string) => void; onOutcomeChange: (value: string) => void; onSave: () => void }) {
  if (!mode) return null;
  const title = mode === 'create' ? 'New Follow-Up' : mode === 'complete' ? 'Complete Follow-Up' : 'Reschedule Follow-Up';
  const action = mode === 'create' ? 'Create Follow-Up' : mode === 'complete' ? 'Complete Follow-Up' : 'Save New Time';
  return <Modal visible animationType="fade" transparent onRequestClose={onClose}><View style={styles.modalOverlay}><KeyboardAvoidingView behavior="padding" style={styles.modalKAV}><View style={[styles.modalCard, { backgroundColor: colors.modalSurface, borderColor: colors.border }]}><View style={[styles.modalHeader, { borderBottomColor: colors.border }]}><View style={styles.modalHeaderCopy}><Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>{mode === 'create' && customerName ? <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>{customerName}</Text> : null}</View><Pressable onPress={onClose} disabled={saving} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close follow-up form" style={styles.closeButton}><Text style={[styles.closeText, { color: colors.textMuted }]}>{'\u00D7'}</Text></Pressable></View><ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'} showsVerticalScrollIndicator contentContainerStyle={styles.formScrollContent}>{mode === 'create' ? <><FormInput label="Purpose *" value={purpose} onChangeText={onPurposeChange} placeholder="e.g. Confirm pickup timing" autoCapitalize="sentences" /><FormInput label="Note (Optional)" value={note} onChangeText={onNoteChange} multiline numberOfLines={3} placeholder="Useful context for this follow-up" /></> : null}{mode === 'complete' ? <FormInput label="Completion Outcome (Optional)" value={outcome} onChangeText={onOutcomeChange} multiline numberOfLines={3} placeholder="What happened or what was agreed" /> : <><FormInput label="Due Date *" value={dueDate} onChangeText={onDueDateChange} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" showDoneAccessory /><FormInput label="Due Time *" value={dueTime} onChangeText={onDueTimeChange} placeholder="HH:MM" keyboardType="numbers-and-punctuation" showDoneAccessory /></>}</ScrollView><View style={[styles.stickyFooter, { borderTopColor: colors.border }]}><Button title="Cancel" variant="outline" style={styles.footerButton} disabled={saving} onPress={onClose} /><Button title={action} style={styles.footerButton} loading={saving} disabled={saving || (mode === 'create' && !purpose.trim())} onPress={onSave} /></View></View></KeyboardAvoidingView></View></Modal>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: { flex: 1, minHeight: 40, paddingHorizontal: spacing.xs, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs, lineHeight: 18 },
  customerContext: { borderWidth: 1, borderRadius: 12, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextCopy: { flex: 1, minWidth: 0, gap: 1 },
  contextLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs, textTransform: 'uppercase' },
  contextText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  row: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs },
  rowHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  customer: { flex: 1, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  status: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  copy: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm },
  meta: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: 17 },
  note: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: spacing.md },
  modalKAV: { flex: 1, width: '100%', justifyContent: 'center' },
  modalCard: { maxHeight: '85%', flexShrink: 1, borderRadius: 12, borderWidth: 1, flexDirection: 'column', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  modalHeaderCopy: { flex: 1, gap: 2 },
  modalTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  closeButton: { minHeight: 32, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: typography.fontFamily.heading, fontSize: typography.fontSize.lg },
  formScroll: { flexShrink: 1 },
  formScrollContent: { padding: spacing.sm, paddingBottom: spacing.md },
  stickyFooter: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  footerButton: { flex: 1 },
});
