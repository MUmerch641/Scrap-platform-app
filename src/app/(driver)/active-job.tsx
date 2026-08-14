import { AppHeader } from '@/components/ui/app-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormInput } from '@/components/ui/form-input';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineState } from '@/components/ui/offline-state';
import { useAppDialog } from '@/context/AppDialogContext';
import { ScreenScaffold } from '@/components/ui/screen-scaffold';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { DriverJob, DriverJobPhoto, DriverJobPhotoType, PendingDriverJobPhoto } from '@/features/driver/types';
import { DriverJobPhotoSection } from '@/features/driver/components/driver-job-photo-section';
import { DriverPickupMap } from '@/features/driver/components/driver-pickup-map';
import { fetchDriverJobPhotos, uploadDriverJobPhoto, validatePendingDriverPhoto } from '@/features/driver/services/driver-job-photo-service';
import { getQaPickupCoordinate } from '@/features/driver/services/driver-location-service';
import {
  fetchDriverJobs,
  recordDriverMaterialCollection,
  transitionDriverJob,
  validateDriverMaterialCollectionInput,
} from '@/features/driver/services/driver-job-service';
import { notifyDriverJobsChanged, subscribeToDriverJobsChanged } from '@/features/driver/services/driver-job-refresh';
import { formatDriverSchedule, formatDriverStatus, formatDriverVehicle, formatDriverWeight } from '@/features/driver/driver-job-formatters';
import { showErrorMessage, showNativeConfirmation, showSuccessMessage } from '@/services/native-feedback-service';
import { semanticColors, spacing, typography } from '@/shared/theme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

const ACTIVE_STATUSES = ['en_route', 'arrived', 'material_collected'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScreenState = 'ready' | 'unavailable' | 'conflict' | 'error';

const NEXT_ACTIONS: Partial<Record<DriverJob['executionStatus'], {
  title: string;
  targetStatus: DriverJob['executionStatus'];
  confirmationTitle: string;
  confirmationMessage: (customerName: string) => string;
}>> = {
  assigned: {
    title: 'Start Trip',
    targetStatus: 'en_route',
    confirmationTitle: 'Start trip?',
    confirmationMessage: (customerName) => `Mark yourself en route to ${customerName}?`,
  },
  en_route: {
    title: "I've Arrived",
    targetStatus: 'arrived',
    confirmationTitle: 'Confirm arrival?',
    confirmationMessage: (customerName) => `Mark your arrival at ${customerName}'s pickup?`,
  },
  arrived: {
    title: 'Confirm Material Collected',
    targetStatus: 'material_collected',
    confirmationTitle: 'Confirm material collected?',
    confirmationMessage: () => 'Confirm the material has been collected. This records the next stage of this job.',
  },
  material_collected: {
    title: 'Delivered to Yard',
    targetStatus: 'delivered_to_yard',
    confirmationTitle: 'Confirm delivery to yard?',
    confirmationMessage: () => 'Confirm the material has been delivered to the yard. This completes Driver execution for this job.',
  },
};

export default function DriverActiveJobScreen() {
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { jobId: routeJobId } = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof routeJobId === 'string' ? routeJobId : undefined;
  const { isOffline } = useNetworkStatus();
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [job, setJob] = useState<DriverJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [actualWeightInput, setActualWeightInput] = useState('');
  const [driverNotesInput, setDriverNotesInput] = useState('');
  const [actualWeightError, setActualWeightError] = useState<string | undefined>();
  const [driverNotesError, setDriverNotesError] = useState<string | undefined>();
  const [photos, setPhotos] = useState<DriverJobPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingDriverJobPhoto[]>([]);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; label: string } | null>(null);
  const requestId = useRef(0);
  const hasLoadedJobRef = useRef(false);
  const transitioningRef = useRef(false);
  const uploadingPhotoIdsRef = useRef(new Set<string>());

  const refreshPhotos = useCallback(async (nextJobId: string) => {
    if (isOffline) return;
    const result = await fetchDriverJobPhotos(nextJobId);
    if (result.success) setPhotos(result.photos);
  }, [isOffline]);

  const load = useCallback(async () => {
    if (isOffline) { setLoading(false); return; }
    if (jobId && !UUID_PATTERN.test(jobId)) { setJob(null); setScreenState('unavailable'); setLoading(false); return; }
    const id = ++requestId.current;
    setScreenState('ready');
    setTransitionError(null);
    const result = await fetchDriverJobs({ page: 0, pageSize: 2, jobId, executionStatuses: jobId ? undefined : ACTIVE_STATUSES });
    if (id !== requestId.current) return;
    if (!result.success) { if (!hasLoadedJobRef.current) setScreenState('error'); setLoading(false); return; }
    if (result.jobs.length > 1 && !jobId) { setJob(null); hasLoadedJobRef.current = false; setScreenState('conflict'); setLoading(false); return; }
    const nextJob = result.jobs[0] ?? null;
    setJob(nextJob);
    if (nextJob) void refreshPhotos(nextJob.id);
    else setPhotos([]);
    hasLoadedJobRef.current = result.jobs.length > 0;
    setScreenState(result.jobs.length ? 'ready' : 'unavailable');
    setLoading(false);
  }, [isOffline, jobId, refreshPhotos]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(
    () => subscribeToDriverJobsChanged(() => load()),
    [load],
  );

  const uploadSelectedPhoto = useCallback(async (photo: PendingDriverJobPhoto) => {
    if (!job || uploadingPhotoIdsRef.current.has(photo.id)) return;
    uploadingPhotoIdsRef.current.add(photo.id);
    setPendingPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, status: 'uploading', error: undefined } : item));
    const result = await uploadDriverJobPhoto(job.id, photo);
    uploadingPhotoIdsRef.current.delete(photo.id);
    if (result.success) {
      setPendingPhotos((current) => current.filter((item) => item.id !== photo.id));
      await refreshPhotos(job.id);
      notifyDriverJobsChanged();
      return;
    }
    setPendingPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, status: 'failed', error: result.error } : item));
    if (result.assignmentUnavailable) await load();
  }, [job, load, refreshPhotos]);

  const selectPhoto = useCallback(async (photoType: DriverJobPhotoType, source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showErrorMessage(source === 'camera' ? 'Camera access is needed to take an evidence photo.' : 'Photo library access is needed to choose an evidence photo.', 'Permission needed');
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
    const pending: PendingDriverJobPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      photoType,
      uri: asset.uri,
      mimeType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
      fileSize: asset.fileSize ?? undefined,
      status: 'preparing',
    };
    if (asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/png') {
      showErrorMessage('Choose a JPEG or PNG photo. iPhone photos should be shared in a compatible format.', 'Unsupported photo');
      return;
    }
    const validationError = validatePendingDriverPhoto(pending);
    if (validationError) { showErrorMessage(validationError, 'Unsupported photo'); return; }
    setPendingPhotos((current) => [...current, pending]);
    void uploadSelectedPhoto(pending);
  }, [uploadSelectedPhoto]);

  const callCustomer = async () => {
    if (!job) return;
    const phone = job.customerPhone.replace(/[^\d+]/g, '');
    if (!phone) return;
    try {
      const url = `tel:${phone}`;
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      // The visible phone number remains available if this device cannot open the dialer.
    }
  };

  const submitTransition = useCallback(async (targetStatus: DriverJob['executionStatus']) => {
    if (!job || transitioningRef.current || isOffline) return;

    transitioningRef.current = true;
    setTransitioning(true);
    setTransitionError(null);
    const result = await transitionDriverJob(job.id, targetStatus);
    transitioningRef.current = false;
    setTransitioning(false);

    if (!result.success) {
      setTransitionError(result.error ?? 'Unable to update this job.');
      if (result.failure === 'assignment-unavailable' || result.failure === 'unavailable') {
        setJob(null);
        hasLoadedJobRef.current = false;
        setScreenState('unavailable');
      } else {
        await load();
      }
      showErrorMessage(result.error ?? 'Unable to update this job.', 'Job update');
      return;
    }

    await load();
    notifyDriverJobsChanged();
    showSuccessMessage(result.transitionApplied ? 'Job status updated' : 'Job status already updated');
  }, [isOffline, job, load]);

  const submitMaterialCollection = useCallback(async () => {
    if (!job || transitioningRef.current || isOffline) return;

    const validation = validateDriverMaterialCollectionInput(actualWeightInput, driverNotesInput);
    if (!validation.success) {
      if (validation.field === 'weight') setActualWeightError(validation.error);
      else setDriverNotesError(validation.error);
      return;
    }

    transitioningRef.current = true;
    setTransitioning(true);
    setTransitionError(null);
    const result = await recordDriverMaterialCollection(job.id, validation.value);
    transitioningRef.current = false;
    setTransitioning(false);

    if (!result.success) {
      const message = result.error ?? 'Unable to record material collection.';
      if (result.failure === 'assignment-unavailable' || result.failure === 'unavailable') {
        setJob(null);
        hasLoadedJobRef.current = false;
        setScreenState('unavailable');
      } else {
        await load();
        setTransitionError(message);
      }
      showErrorMessage(message, 'Material collection');
      return;
    }

    await load();
    notifyDriverJobsChanged();
    showSuccessMessage(result.transitionApplied ? 'Material collection recorded' : 'Material collection already recorded');
  }, [actualWeightInput, driverNotesInput, isOffline, job, load]);

  const confirmTransition = useCallback(() => {
    if (!job || transitioningRef.current) return;
    const action = NEXT_ACTIONS[job.executionStatus];
    if (!action) return;
    if (job.executionStatus === 'arrived') {
      const validation = validateDriverMaterialCollectionInput(actualWeightInput, driverNotesInput);
      setActualWeightError(validation.success || validation.field !== 'weight' ? undefined : validation.error);
      setDriverNotesError(validation.success || validation.field !== 'notes' ? undefined : validation.error);
      if (!validation.success) return;
    }
    const confirm = () => job.executionStatus === 'arrived'
      ? submitMaterialCollection()
      : submitTransition(action.targetStatus);

    if (Platform.OS === 'ios') {
      showNativeConfirmation(
        action.confirmationTitle,
        action.confirmationMessage(job.customerName),
        () => void confirm(),
        action.title,
      );
      return;
    }

    showDialog({
      title: action.confirmationTitle,
      message: action.confirmationMessage(job.customerName),
      confirmLabel: action.title,
      cancelLabel: 'Cancel',
      icon: 'alert-circle-outline',
      dismissible: true,
      onConfirm: confirm,
    });
  }, [actualWeightInput, driverNotesInput, job, showDialog, submitMaterialCollection, submitTransition]);

  const header = <AppHeader title="Active Job" subtitle="Driver workspace" />;
  if (loading && !job) return <ScreenScaffold header={header}><LoadingState message="Loading job details..." /></ScreenScaffold>;
  if (isOffline && !job) return <ScreenScaffold header={header}><OfflineState message="Connect to the internet to load this job." onRetry={() => void load()} /></ScreenScaffold>;
  if (screenState === 'error' && !job) return <ScreenScaffold header={header}><ErrorState title="Unable to load job" message="Check your connection and try again." onRetry={() => void load()} /></ScreenScaffold>;
  if (!job) return <ScreenScaffold header={header}><EmptyState title={screenState === 'conflict' ? 'Multiple active jobs' : jobId ? 'Job unavailable' : 'No active job'} message={screenState === 'conflict' ? 'Your assignments need Operations review before you continue.' : jobId ? 'This job is no longer available to your account.' : 'Your assigned jobs will appear here once work begins.'} action={<Button title="View Jobs" variant="outline" onPress={() => router.push('/(driver)/jobs')} />} variant="dashboard" /></ScreenScaffold>;

  const schedule = formatDriverSchedule(job.scheduledAt);
  const nextAction = NEXT_ACTIONS[job.executionStatus];
  const qaPickupCoordinate = job.pickupCoordinate ? null : getQaPickupCoordinate();
  const pickupCoordinate = job.pickupCoordinate ?? qaPickupCoordinate;
  return <ScreenScaffold mode="form" header={<AppHeader title="Job Details" subtitle={formatDriverStatus(job.executionStatus)} />} contentContainerStyle={styles.content} androidKeyboardAvoidance>
    <Section title="Customer" colors={colors}><Text style={[styles.customerName, { color: colors.text }]}>{job.customerName}</Text><Detail label="Phone" value={job.customerPhone} colors={colors} />{job.customerPhone.replace(/[^\d+]/g, '') ? <Button title="Call Customer" variant="outline" onPress={() => void callCustomer()} /> : null}</Section>
    <Section title="Pickup" colors={colors}><Detail label="Historical pickup address" value={job.pickupAddress} colors={colors} /><Detail label="Scheduled date" value={schedule.date} colors={colors} /><Detail label="Scheduled time" value={schedule.time} colors={colors} /><Detail label="Material" value={job.materialType} colors={colors} /><Detail label="Estimated weight" value={formatDriverWeight(job.estimatedWeight)} colors={colors} /></Section>
    <DriverPickupMap key={job.id} pickupJobId={job.id} pickupAddress={job.pickupAddress} pickupCoordinate={pickupCoordinate} isQaCoordinate={Boolean(qaPickupCoordinate)} />
    <Section title="Assignment" colors={colors}><Detail label="Vehicle" value={formatDriverVehicle(job.assignment.vehicle)} colors={colors} /><Detail label="Current status" value={formatDriverStatus(job.executionStatus)} colors={colors} />{job.deliveredToYardAt ? <Detail label="Delivered to yard" value={`${formatDriverSchedule(job.deliveredToYardAt).date} at ${formatDriverSchedule(job.deliveredToYardAt).time}`} colors={colors} /> : null}</Section>
    {job.pickupNotes ? <Section title="Pickup Instructions" colors={colors}><Text style={[styles.instructions, { color: colors.text }]}>{job.pickupNotes}</Text></Section> : null}
    {job.executionStatus === 'arrived' ? <Section title="Collection Details" colors={colors}><Detail label="Estimated Weight" value={formatDriverWeight(job.estimatedWeight)} colors={colors} /><FormInput label="Actual Collected Weight (kg)" value={actualWeightInput} onChangeText={(value) => { setActualWeightInput(value); setActualWeightError(undefined); }} keyboardType="decimal-pad" returnKeyType="done" placeholder="Enter actual weight" error={actualWeightError} /><FormInput label="Driver Notes (Optional)" value={driverNotesInput} onChangeText={(value) => { setDriverNotesInput(value); setDriverNotesError(undefined); }} multiline numberOfLines={4} textAlignVertical="top" maxLength={1000} placeholder="Add collection details" error={driverNotesError} style={styles.notesInput} /><Text style={[styles.characterCount, { color: colors.textMuted }]}>{driverNotesInput.length}/1000</Text></Section> : null}
    {job.executionStatus === 'material_collected' || job.executionStatus === 'delivered_to_yard' ? <Section title="Collection Details" colors={colors}><Detail label="Actual Collected Weight" value={formatDriverWeight(job.actualCollectedWeight)} colors={colors} /><Detail label="Driver Notes" value={job.driverNotes ?? 'No driver notes'} colors={colors} /></Section> : null}
    {['arrived', 'material_collected', 'delivered_to_yard'].includes(job.executionStatus) ? <DriverJobPhotoSection title="Collection Photos" photoType="collection" photos={photos} pending={pendingPhotos} canAdd={job.executionStatus !== 'delivered_to_yard'} onTakePhoto={() => void selectPhoto('collection', 'camera')} onChoosePhoto={() => void selectPhoto('collection', 'library')} onRetry={(photo) => void uploadSelectedPhoto(photo)} onPreview={(uri, label) => setPhotoPreview({ uri, label })} /> : null}
    {['material_collected', 'delivered_to_yard'].includes(job.executionStatus) ? <DriverJobPhotoSection title="Delivery Photos" photoType="delivery" photos={photos} pending={pendingPhotos} canAdd={job.executionStatus === 'material_collected'} onTakePhoto={() => void selectPhoto('delivery', 'camera')} onChoosePhoto={() => void selectPhoto('delivery', 'library')} onRetry={(photo) => void uploadSelectedPhoto(photo)} onPreview={(uri, label) => setPhotoPreview({ uri, label })} /> : null}
    {nextAction ? <View style={styles.actionSection}><Button title={nextAction.title} onPress={confirmTransition} loading={transitioning} disabled={isOffline} />{transitionError ? <Text style={[styles.actionError, { color: colors.danger }]}>{transitionError}</Text> : null}</View> : <View style={[styles.completedState, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.completedTitle, { color: colors.text }]}>Driver execution complete</Text><Text style={[styles.completedMessage, { color: colors.textMuted }]}>This job was delivered to the yard and no further Driver action is needed.</Text></View>}
    <Modal visible={Boolean(photoPreview)} transparent animationType="fade" onRequestClose={() => setPhotoPreview(null)}><Pressable style={styles.previewBackdrop} onPress={() => setPhotoPreview(null)}><Pressable style={[styles.previewCard, { backgroundColor: colors.surface }]} onPress={() => undefined}><Text style={[styles.previewTitle, { color: colors.text }]}>{photoPreview?.label}</Text>{photoPreview ? <Image source={{ uri: photoPreview.uri }} style={styles.previewImage} contentFit="contain" /> : null}<Button title="Close" variant="outline" onPress={() => setPhotoPreview(null)} /></Pressable></Pressable></Modal>
  </ScreenScaffold>;
}

function Section({ title, colors, children }: { title: string; colors: (typeof semanticColors)[keyof typeof semanticColors]; children: React.ReactNode }) { return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{children}</View>; }
function Detail({ label, value, colors }: { label: string; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.detail}><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.value, { color: colors.text }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ content: { gap: spacing.md }, section: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.md }, sectionTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, customerName: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.xl }, detail: { gap: spacing.xs }, label: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs }, value: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: typography.lineHeight.md }, instructions: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: typography.lineHeight.md }, notesInput: { minHeight: 96, paddingTop: spacing.sm, paddingBottom: spacing.sm }, characterCount: { marginTop: -spacing.sm, fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, textAlign: 'right' }, actionSection: { gap: spacing.sm }, actionError: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm, textAlign: 'center' }, completedState: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs }, completedTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, completedMessage: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm }, previewBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(0, 0, 0, 0.6)' }, previewCard: { maxHeight: '86%', borderRadius: 12, padding: spacing.md, gap: spacing.md }, previewTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, previewImage: { width: '100%', aspectRatio: 1 } });
