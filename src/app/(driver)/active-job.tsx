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
import { DriverJobProgress } from '@/features/driver/components/driver-job-progress';
import { DriverPickupMap } from '@/features/driver/components/driver-pickup-map';
import { DriverStatusPill } from '@/features/driver/components/driver-status-pill';
import { fetchDriverJobPhotos, uploadDriverJobPhoto, validatePendingDriverPhoto } from '@/features/driver/services/driver-job-photo-service';
import { getQaPickupCoordinate } from '@/features/driver/services/driver-location-service';
import {
  fetchDriverJobs,
  recordDriverMaterialCollection,
  transitionDriverJob,
  validateDriverMaterialCollectionInput,
} from '@/features/driver/services/driver-job-service';
import { notifyDriverJobsChanged, subscribeToDriverJobsChanged } from '@/features/driver/services/driver-job-refresh';
import { formatDriverSchedule, formatDriverVehicle, formatDriverWeight } from '@/features/driver/driver-job-formatters';
import { showErrorMessage, showNativeConfirmation, showSuccessMessage } from '@/services/native-feedback-service';
import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

const ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'material_collected'] as const;
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
    confirmationMessage: () => 'Confirm the material has been delivered to the yard. Your delivery will become read-only while Operations or Yard confirms the final weight.',
  },
};

export default function DriverActiveJobScreen() {
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const { pickupJobId: routePickupJobId, jobId: legacyRouteJobId } = useLocalSearchParams<{
    pickupJobId?: string | string[];
    jobId?: string | string[];
  }>();
  // The accept RPC returns pickup_job_id. Keep the old jobId parameter as a
  // compatibility fallback for existing Home/Jobs links.
  const firstRouteValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const jobId = firstRouteValue(routePickupJobId) ?? firstRouteValue(legacyRouteJobId);
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
    if (__DEV__) console.log('[driver-active-job] loading detail', {
      p_job_id: jobId ?? null,
      source: routePickupJobId ? 'pickupJobId' : legacyRouteJobId ? 'jobId' : 'none',
    });
    const id = ++requestId.current;
    setScreenState('ready');
    setTransitionError(null);
    const result = await fetchDriverJobs({ page: 0, pageSize: 99, jobId, executionStatuses: jobId ? undefined : ACTIVE_STATUSES });
    if (id !== requestId.current) return;
    if (__DEV__) console.log('[driver-active-job] detail result', { p_job_id: jobId ?? null, success: result.success, jobCount: result.jobs.length, error: result.error, job: result.jobs[0] ?? null });
    if (!result.success) { if (!hasLoadedJobRef.current) setScreenState('error'); setLoading(false); return; }
    const assignedJobs = result.jobs.filter((candidate) => candidate.executionStatus === 'assigned');
    if (!jobId && (assignedJobs.length > 1 || (assignedJobs.length === 0 && result.jobs.length > 1))) {
      setJob(null);
      hasLoadedJobRef.current = false;
      setScreenState('conflict');
      setLoading(false);
      return;
    }
    const nextJob = jobId ? result.jobs[0] ?? null : assignedJobs[0] ?? result.jobs[0] ?? null;
    setJob(nextJob);
    if (nextJob) void refreshPhotos(nextJob.id);
    else setPhotos([]);
    hasLoadedJobRef.current = result.jobs.length > 0;
    setScreenState(result.jobs.length ? 'ready' : 'unavailable');
    setLoading(false);
  }, [isOffline, jobId, legacyRouteJobId, refreshPhotos, routePickupJobId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(
    () => subscribeToDriverJobsChanged(() => load()),
    [load],
  );

  const uploadSelectedPhoto = useCallback(async (photo: PendingDriverJobPhoto) => {
    if (!job) {
      if (__DEV__) console.warn('[driver-active-job] photo upload skipped: no current job', { photoId: photo.id });
      return;
    }
    if (uploadingPhotoIdsRef.current.has(photo.id)) {
      if (__DEV__) console.warn('[driver-active-job] photo upload skipped: already uploading', { photoId: photo.id, jobId: job.id });
      return;
    }
    if (__DEV__) console.log('[driver-active-job] starting photo upload', { jobId: job.id, photoId: photo.id, photoType: photo.photoType, mimeType: photo.mimeType, fileSize: photo.fileSize ?? null });
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

  const removePendingPhoto = useCallback((photo: PendingDriverJobPhoto) => {
    if (uploadingPhotoIdsRef.current.has(photo.id)) return;
    setPendingPhotos((current) => current.filter((item) => item.id !== photo.id));
    setPhotoPreview((current) => current?.uri === photo.uri ? null : current);
  }, []);

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
    await uploadSelectedPhoto(pending);
  }, [uploadSelectedPhoto]);

  const callCustomer = async () => {
    if (!job) return;
    const phone = job.customerPhone.replace(/[^\d+]/g, '');
    if (!phone) { showErrorMessage('This customer does not have a usable phone number.', 'Call unavailable'); return; }
    try {
      const url = `tel:${phone}`;
      await Linking.openURL(url);
    } catch {
      showErrorMessage('Unable to open the phone app. Please try again on a supported device.', 'Call unavailable');
    }
  };

  const messageCustomer = async () => {
    if (!job) return;
    const phone = job.customerPhone.replace(/[^\d+]/g, '');
    if (!phone) { showErrorMessage('This customer does not have a usable phone number.', 'Message unavailable'); return; }
    try {
      const url = `sms:${phone}`;
      await Linking.openURL(url);
    } catch { showErrorMessage('Unable to open an SMS composer. Please try again on a supported device.', 'Message unavailable'); }
  };

  const emailCustomer = async () => {
    if (!job?.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.customerEmail.trim())) {
      showErrorMessage('This customer does not have a usable email address.', 'Email unavailable');
      return;
    }
    try {
      const url = `mailto:${job.customerEmail.trim()}`;
      await Linking.openURL(url);
    } catch { showErrorMessage('Unable to open an email app. Please try again on a supported device.', 'Email unavailable'); }
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
  return (
    <ScreenScaffold mode="form" header={<AppHeader title="Active Job" subtitle={job.customerName} />} contentContainerStyle={styles.content} androidKeyboardAvoidance>
      <View style={styles.overviewHero}>
        <View style={styles.overviewTop}>
          <Text style={styles.customerName} numberOfLines={2}>{job.customerName}</Text>
          <DriverStatusPill status={job.executionStatus} inverse />
        </View>
        <View style={styles.heroDetail}><Ionicons name="time-outline" size={17} color={brandColors.lightCopper} /><Text style={styles.heroDetailText}>{schedule.time} · {schedule.date}</Text></View>
        <View style={styles.heroDetail}><Ionicons name="location-outline" size={17} color={brandColors.lightCopper} /><Text style={styles.heroDetailText} numberOfLines={2}>{job.pickupAddress}</Text></View>
      </View>

      <DriverJobProgress status={job.executionStatus} />

      {nextAction ? (
        <View style={styles.nextStepBanner}>
          <Text style={[styles.nextStepLabel, { color: colors.textMuted }]}>Next step</Text>
          <View style={styles.nextStepCopy}><Text style={[styles.nextStepTitle, { color: colors.text }]}>{nextAction.title}</Text><Text style={[styles.nextStepText, { color: colors.textMuted }]}>{nextStepDescription(job.executionStatus)}</Text></View>
        </View>
      ) : null}

      <DriverPickupMap key={job.id} pickupJobId={job.id} pickupAddress={job.pickupAddress} pickupCoordinate={pickupCoordinate} isQaCoordinate={Boolean(qaPickupCoordinate)} />

      <OperationalSection title="Job information" subtitle="Customer, material and assignment" icon="clipboard-outline" colors={colors}>
        <View style={styles.infoGrid}>
          <InfoItem icon="call-outline" label="Customer phone" value={job.customerPhone} colors={colors} />
          <InfoItem icon="cube-outline" label="Material" value={job.materialType} colors={colors} />
          <InfoItem icon="scale-outline" label="Estimated weight" value={formatDriverWeight(job.estimatedWeight)} colors={colors} />
          <InfoItem icon="car-outline" label="Assigned vehicle" value={formatDriverVehicle(job.assignment.vehicle)} colors={colors} />
        </View>
        {job.deliveredToYardAt ? <InfoItem icon="checkmark-done-outline" label="Delivered to yard" value={`${formatDriverSchedule(job.deliveredToYardAt).date} at ${formatDriverSchedule(job.deliveredToYardAt).time}`} colors={colors} /> : null}
      </OperationalSection>

      <OperationalSection title="Customer contact" subtitle="Contact the customer about this pickup" icon="person-outline" colors={colors}>
        <View style={styles.infoGrid}>
          <InfoItem icon="business-outline" label="Customer / business" value={job.customerName} colors={colors} />
          {job.contactPerson ? <InfoItem icon="person-outline" label="Contact person" value={job.contactPerson} colors={colors} /> : null}
          <InfoItem icon="call-outline" label="Phone" value={job.customerPhone || 'Not available'} colors={colors} />
          {job.customerEmail ? <InfoItem icon="mail-outline" label="Email" value={job.customerEmail} colors={colors} /> : null}
        </View>
        <View style={styles.communicationActions}>
          <CommunicationAction icon="call-outline" label="Call" onPress={() => void callCustomer()} disabled={!job.customerPhone.replace(/[^\d+]/g, '')} colors={colors} />
          <CommunicationAction icon="chatbubble-outline" label="Message" onPress={() => void messageCustomer()} disabled={!job.customerPhone.replace(/[^\d+]/g, '')} colors={colors} />
          {job.customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.customerEmail.trim()) ? <CommunicationAction icon="mail-outline" label="Email" onPress={() => void emailCustomer()} colors={colors} /> : null}
        </View>
      </OperationalSection>

      {job.pickupNotes ? (
        <View style={[styles.instructionsCard, { backgroundColor: colors.surface, borderColor: brandColors.lightCopper }]}>
          <View style={styles.instructionsHeading}><Ionicons name="information-circle" size={21} color={colors.accent} /><Text style={[styles.instructionsTitle, { color: colors.text }]}>Pickup instructions</Text></View>
          <Text style={[styles.instructions, { color: colors.text }]}>{job.pickupNotes}</Text>
        </View>
      ) : null}

      {['arrived', 'material_collected', 'delivered_to_yard'].includes(job.executionStatus) ? (
        <View style={styles.stageBlock}>
          <StageHeading title="Photo evidence" subtitle="Capture a clear record of the pickup" colors={colors} />
          <DriverJobPhotoSection title="Collection Photos" photoType="collection" photos={photos} pending={pendingPhotos} canAdd={job.executionStatus !== 'delivered_to_yard'} readOnly={job.executionStatus === 'delivered_to_yard'} onTakePhoto={() => void selectPhoto('collection', 'camera')} onChoosePhoto={() => void selectPhoto('collection', 'library')} onRetry={(photo) => void uploadSelectedPhoto(photo)} onRemove={removePendingPhoto} onPreview={(uri, label) => setPhotoPreview({ uri, label })} />
          {['material_collected', 'delivered_to_yard'].includes(job.executionStatus) ? <DriverJobPhotoSection title="Delivery Photos" photoType="delivery" photos={photos} pending={pendingPhotos} canAdd={job.executionStatus === 'material_collected'} readOnly={job.executionStatus === 'delivered_to_yard'} onTakePhoto={() => void selectPhoto('delivery', 'camera')} onChoosePhoto={() => void selectPhoto('delivery', 'library')} onRetry={(photo) => void uploadSelectedPhoto(photo)} onRemove={removePendingPhoto} onPreview={(uri, label) => setPhotoPreview({ uri, label })} /> : null}
        </View>
      ) : null}

      {job.executionStatus === 'arrived' ? (
        <View style={styles.stageBlock}>
          <StageHeading title="Material collection" subtitle="Record the verified load before continuing" colors={colors} />
          <OperationalSection title="Collection details" subtitle={`Estimated ${formatDriverWeight(job.estimatedWeight)}`} icon="scale-outline" colors={colors}>
            <FormInput label="Actual collected weight (kg)" value={actualWeightInput} onChangeText={(value) => { setActualWeightInput(value); setActualWeightError(undefined); }} keyboardType="decimal-pad" returnKeyType="done" showDoneAccessory placeholder="Enter verified weight" error={actualWeightError} />
            <FormInput label="Driver notes (optional)" value={driverNotesInput} onChangeText={(value) => { setDriverNotesInput(value); setDriverNotesError(undefined); }} multiline numberOfLines={4} textAlignVertical="top" maxLength={1000} showDoneAccessory placeholder="Condition, access details, or collection notes" error={driverNotesError} style={styles.notesInput} />
            <Text style={[styles.characterCount, { color: colors.textMuted }]}>{driverNotesInput.length}/1000</Text>
          </OperationalSection>
        </View>
      ) : null}

      {job.executionStatus === 'material_collected' || job.executionStatus === 'delivered_to_yard' ? (
        <OperationalSection title="Collected material" subtitle="Recorded by Driver at pickup" icon="checkmark-circle-outline" colors={colors}>
          <InfoItem icon="scale-outline" label="Driver collected weight" value={formatDriverWeight(job.actualCollectedWeight)} colors={colors} />
          <InfoItem icon="document-text-outline" label="Driver notes" value={job.driverNotes ?? 'No driver notes'} colors={colors} />
        </OperationalSection>
      ) : null}

      {job.executionStatus === 'delivered_to_yard' ? (
        <View style={[styles.yardConfirmationState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.yardConfirmationIcon, { backgroundColor: colors.background }]}><Ionicons name="scale-outline" size={26} color={colors.accent} /></View>
          <View style={styles.yardConfirmationCopy}>
            <Text style={[styles.yardConfirmationTitle, { color: colors.text }]}>Awaiting Yard Weight Confirmation</Text>
            <Text style={[styles.yardConfirmationMessage, { color: colors.textMuted }]}>Your delivery is recorded. Operations or Yard will confirm the final yard weight. This job is read-only for you.</Text>
            <Text style={[styles.yardWeightLine, { color: colors.text }]}>Driver collected weight: {formatDriverWeight(job.actualCollectedWeight)}</Text>
            {job.finalYardWeight != null ? <Text style={[styles.yardWeightLine, { color: colors.success }]}>Final yard weight: {formatDriverWeight(job.finalYardWeight)}</Text> : null}
          </View>
        </View>
      ) : null}

      {nextAction ? (
        <View style={[styles.actionSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionCopy}><Text style={[styles.actionTitle, { color: colors.text }]}>Next action</Text><Text style={[styles.actionDescription, { color: colors.textMuted }]}>{nextStepDescription(job.executionStatus)}</Text></View>
          <Button title={nextAction.title} onPress={confirmTransition} loading={transitioning} disabled={isOffline} style={styles.primaryAction} />
          {isOffline ? <Text style={[styles.actionHint, { color: colors.warning }]}>Reconnect before changing job status.</Text> : null}
          {transitionError ? <Text style={[styles.actionError, { color: colors.danger }]}>{transitionError}</Text> : null}
        </View>
      ) : (
        <View style={[styles.completedState, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.completedIcon, { backgroundColor: colors.background }]}><Ionicons name="hourglass-outline" size={26} color={colors.accent} /></View><View style={styles.completedCopy}><Text style={[styles.completedTitle, { color: colors.text }]}>Delivery submitted</Text><Text style={[styles.completedMessage, { color: colors.textMuted }]}>Awaiting Operations or Yard confirmation of the final weight. No further Driver action is required.</Text></View></View>
      )}

      <Modal visible={Boolean(photoPreview)} transparent animationType="fade" onRequestClose={() => setPhotoPreview(null)}><Pressable style={styles.previewBackdrop} onPress={() => setPhotoPreview(null)}><Pressable style={[styles.previewCard, { backgroundColor: colors.surface }]} onPress={() => undefined}><View style={styles.previewHeading}><Text style={[styles.previewTitle, { color: colors.text }]}>{photoPreview?.label}</Text><Pressable onPress={() => setPhotoPreview(null)} accessibilityRole="button" accessibilityLabel="Close photo preview" style={[styles.previewClose, { backgroundColor: colors.background }]}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View>{photoPreview ? <Image source={{ uri: photoPreview.uri }} style={styles.previewImage} contentFit="contain" /> : null}</Pressable></Pressable></Modal>
    </ScreenScaffold>
  );
}

function nextStepDescription(status: DriverJob['executionStatus']): string { if (status === 'assigned') return 'Review the pickup and begin driving when ready.'; if (status === 'en_route') return 'Mark your arrival once you are safely at the pickup.'; if (status === 'arrived') return 'Add evidence and record the collected material.'; return 'Complete delivery after reaching the yard.'; }
function OperationalSection({ title, subtitle, icon, colors, children }: { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name']; colors: (typeof semanticColors)[keyof typeof semanticColors]; children: React.ReactNode }) { return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.sectionHeading}><Ionicons name={icon} size={20} color={colors.accent} /><View style={styles.sectionHeadingCopy}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text></View></View>{children}</View>; }
function InfoItem({ icon, label, value, colors }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.infoItem}><Ionicons name={icon} size={17} color={colors.accent} /><View style={styles.infoCopy}><Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text></View></View>; }
function CommunicationAction({ icon, label, onPress, disabled = false, colors }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <Pressable accessibilityRole="button" accessibilityLabel={`${label} customer`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.communicationAction, { borderColor: colors.border, backgroundColor: colors.background, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 }]}><Ionicons name={icon} size={21} color={colors.accent} /><Text style={[styles.communicationLabel, { color: colors.text }]}>{label}</Text></Pressable>; }
function StageHeading({ title, subtitle, colors }: { title: string; subtitle: string; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <View style={styles.stageHeading}><Text style={[styles.stageTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.stageSubtitle, { color: colors.textMuted }]}>{subtitle}</Text></View>; }
const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.md },
  overviewHero: { padding: spacing.md, gap: spacing.sm, backgroundColor: brandColors.navy, borderRadius: radius.lg },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  customerName: { flex: 1, color: brandColors.white, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg, lineHeight: typography.lineHeight.lg },
  heroDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  heroDetailText: { flex: 1, color: 'rgba(251,252,248,0.84)', fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  nextStepBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs },
  nextStepLabel: { width: 66, fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  nextStepCopy: { flex: 1, gap: 2 },
  nextStepTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  nextStepText: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.xs },
  section: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeadingCopy: { flex: 1, gap: 2 },
  sectionTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  sectionSubtitle: { fontFamily: typography.fontFamily.body, fontSize: 11 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  infoItem: { width: '46%', minWidth: 126, flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoCopy: { flex: 1, gap: 2 },
  infoLabel: { fontFamily: typography.fontFamily.bodyMedium, fontSize: 11 },
  infoValue: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  secondaryButton: { minHeight: 46, borderRadius: radius.lg },
  communicationActions: { flexDirection: 'row', gap: spacing.sm },
  communicationAction: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderRadius: radius.lg },
  communicationLabel: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm },
  instructionsCard: { borderLeftWidth: 4, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  instructionsHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  instructionsTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  instructions: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  stageBlock: { gap: spacing.md, paddingTop: spacing.sm },
  stageHeading: { gap: 1 },
  stageTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  stageSubtitle: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs },
  notesInput: { minHeight: 112, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  characterCount: { marginTop: -spacing.md, fontFamily: typography.fontFamily.bodyMedium, fontSize: 11, textAlign: 'right' },
  actionSection: { marginTop: spacing.sm, gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  actionDescription: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs, lineHeight: typography.lineHeight.xs },
  primaryAction: { minHeight: 54, borderRadius: radius.lg },
  actionHint: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs, textAlign: 'center' },
  actionError: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm, textAlign: 'center' },
  completedState: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg },
  completedIcon: { width: 50, height: 50, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  completedCopy: { flex: 1, gap: spacing.xs },
  completedTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  completedMessage: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  yardConfirmationState: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg },
  yardConfirmationIcon: { width: 50, height: 50, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  yardConfirmationCopy: { flex: 1, gap: spacing.xs },
  yardConfirmationTitle: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  yardConfirmationMessage: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.sm },
  yardWeightLine: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm, marginTop: 2 },
  previewBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(0, 0, 0, 0.76)' },
  previewCard: { maxHeight: '92%', borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  previewTitle: { flex: 1, fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.lg },
  previewClose: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', aspectRatio: 0.82 },
});
