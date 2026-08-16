import { BrandSpinner, BUTTON_LOADER_SIZE } from '@/components/ui/loading-state';
import { FormInput } from '@/components/ui/form-input';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  createDriverSupportRequest,
  DriverSupportRequest,
  fetchDriverSupportRequest,
} from '../services/driver-support-service';

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_MAX_LENGTH = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalState =
  | 'loading'      // Fetching existing request on open
  | 'idle'         // Empty form — no existing request
  | 'submitting'   // RPC in flight
  | 'pending'      // Request exists, awaiting admin action
  | 'resolved'     // Admin resolved with note
  | 'rejected';    // Admin rejected with note

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUUID(): string {
  // RFC4122 v4 UUID — crypto.randomUUID() not available in all RN environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function stateFromRequest(request: DriverSupportRequest): ModalState {
  if (request.status === 'resolved') return 'resolved';
  if (request.status === 'rejected') return 'rejected';
  return 'pending';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DriverSupportModalProps {
  visible: boolean;
  jobId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function DriverSupportModal({
  visible,
  jobId,
  onClose,
  onSubmitted,
}: DriverSupportModalProps) {
  const scheme = useColorScheme();
  const colors = semanticColors[scheme === 'dark' ? 'dark' : 'light'];

  const [modalState, setModalState] = useState<ModalState>('loading');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [supportRequest, setSupportRequest] = useState<DriverSupportRequest | null>(null);

  // One UUID per logical submit attempt — reused on retry for idempotency
  const clientRequestIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  // ── Load existing request when modal opens ──────────────────────────────
  const loadExisting = useCallback(async () => {
    const id = ++loadRequestIdRef.current;
    setModalState('loading');
    setSupportRequest(null);
    setReason('');
    setReasonError(undefined);
    setSubmitError(null);

    const result = await fetchDriverSupportRequest(jobId);
    if (id !== loadRequestIdRef.current) return;

    if (!result.success) {
      // Treat fetch failure as idle — user can still try submitting
      console.warn('[support-modal] fetch failed, falling back to idle:', result.error);
      setModalState('idle');
      return;
    }

    if (result.request) {
      setSupportRequest(result.request);
      setModalState(stateFromRequest(result.request));
    } else {
      setModalState('idle');
    }
  }, [jobId]);

  useEffect(() => {
    if (!visible) return;
    const run = async () => { await loadExisting(); };
    void run();
  }, [visible, loadExisting]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmed = reason.trim();

    if (!trimmed) {
      setReasonError('Please describe why you need support.');
      return;
    }
    if (trimmed.length > REASON_MAX_LENGTH) {
      setReasonError(`Reason must be ${REASON_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setReasonError(undefined);
    setSubmitError(null);

    // Generate once per attempt — reused if user retries on network failure
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = generateUUID();
    }

    setModalState('submitting');

    const result = await createDriverSupportRequest(
      jobId,
      trimmed,
      clientRequestIdRef.current,
    );

    if (!result.success) {
      setSubmitError(result.error ?? 'Unable to submit. Try again.');
      setModalState('idle');
      return;
    }

    // Generate a fresh ID for any future new submit attempt
    clientRequestIdRef.current = null;

    if (result.request) {
      setSupportRequest(result.request);
      setModalState(stateFromRequest(result.request));
    } else {
      setModalState('pending');
    }

    onSubmitted?.();
  }, [jobId, reason, onSubmitted]);

  // ── Handle close ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (modalState === 'submitting') return; // Block dismiss while in-flight
    onClose();
  }, [modalState, onClose]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { backgroundColor: colors.modalSurface }]}>
          {/* Drag handle */}
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Ionicons name="headset-outline" size={20} color={colors.accent} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Request Support</Text>
            </View>
            {modalState !== 'submitting' ? (
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.closeButton, { backgroundColor: colors.surface }]}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* LOADING */}
            {modalState === 'loading' ? (
              <View style={styles.centeredContent}>
                <BrandSpinner size={BUTTON_LOADER_SIZE} accessibilityLabel="Loading support status" />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  Checking support status…
                </Text>
              </View>
            ) : null}

            {/* IDLE — Form */}
            {(modalState === 'idle' || modalState === 'submitting') ? (
              <View style={styles.formBlock}>
                <Text style={[styles.formDescription, { color: colors.textMuted }]}>
                  Briefly describe the issue. Operations will review and respond to you shortly.
                </Text>

                <FormInput
                  label="Reason"
                  value={reason}
                  onChangeText={(v) => {
                    setReason(v);
                    setReasonError(undefined);
                  }}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={REASON_MAX_LENGTH + 1}
                  placeholder={"e.g. Customer not at address, unable to reach them\u2026"}
                  error={reasonError}
                  style={styles.reasonInput}
                  editable={modalState !== 'submitting'}
                  showDoneAccessory
                />

                <Text style={[styles.characterCount, { color: colors.textMuted }]}>
                  {reason.trim().length}/{REASON_MAX_LENGTH}
                </Text>

                {submitError ? (
                  <Text style={[styles.submitError, { color: colors.danger }]}>
                    {submitError}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => void handleSubmit()}
                  disabled={modalState === 'submitting'}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor:
                        modalState === 'submitting'
                          ? colors.surface
                          : colors.primary,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  {modalState === 'submitting' ? (
                    <BrandSpinner size={BUTTON_LOADER_SIZE} accessibilityLabel="Submitting support request" />
                  ) : (
                    <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>
                      Submit Request
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* PENDING */}
            {modalState === 'pending' ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statusTop}>
                  <Ionicons name="time-outline" size={18} color={brandColors.lightCopper} />
                  <Text style={[styles.statusTitle, { color: colors.text }]}>Request Submitted</Text>
                </View>
                <Text style={[styles.statusMessage, { color: colors.textMuted }]}>
                  Pending Operations review. You will be notified once it is actioned.
                </Text>
                {supportRequest?.reason ? (
                  <View style={[styles.noteBlock, { borderColor: colors.border }]}>
                    <Text style={[styles.noteLabel, { color: colors.textMuted }]}>Your reason</Text>
                    <Text style={[styles.noteText, { color: colors.text }]}>{supportRequest.reason}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* RESOLVED */}
            {modalState === 'resolved' ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statusTop}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                  <Text style={[styles.statusTitle, { color: colors.success }]}>Support Resolved</Text>
                </View>
                <Text style={[styles.statusMessage, { color: colors.textMuted }]}>
                  Operations has reviewed and resolved your support request.
                </Text>
                {supportRequest?.adminNote ? (
                  <View style={[styles.noteBlock, { borderColor: colors.border }]}>
                    <Text style={[styles.noteLabel, { color: colors.textMuted }]}>Admin note</Text>
                    <Text style={[styles.noteText, { color: colors.text }]}>{supportRequest.adminNote}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* REJECTED */}
            {modalState === 'rejected' ? (
              <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.statusTop}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                  <Text style={[styles.statusTitle, { color: colors.danger }]}>Not Actioned</Text>
                </View>
                <Text style={[styles.statusMessage, { color: colors.textMuted }]}>
                  Operations reviewed your request and could not action it at this time.
                </Text>
                {supportRequest?.adminNote ? (
                  <View style={[styles.noteBlock, { borderColor: colors.border }]}>
                    <Text style={[styles.noteLabel, { color: colors.textMuted }]}>Admin note</Text>
                    <Text style={[styles.noteText, { color: colors.text }]}>{supportRequest.adminNote}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginBottom: spacing.md,
  },
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  centeredContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  formBlock: {
    gap: spacing.sm,
  },
  formDescription: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  reasonInput: {
    minHeight: 108,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  characterCount: {
    marginTop: -spacing.xs,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 11,
    textAlign: 'right',
  },
  submitError: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  submitButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  submitButtonText: {
    fontFamily: typography.fontFamily.bodySemibold,
    fontSize: typography.fontSize.sm,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusTitle: {
    fontFamily: typography.fontFamily.headingSemibold,
    fontSize: typography.fontSize.sm,
  },
  statusMessage: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  noteBlock: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 4,
  },
  noteLabel: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noteText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
});
