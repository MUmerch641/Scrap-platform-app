import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

import { DriverJobPhoto, DriverJobPhotoType, PendingDriverJobPhoto } from '../types';

const PHOTO_URL_EXPIRY_SECONDS = 300;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PHOTO_BUCKET = 'driver-job-evidence';

type RawPhoto = { id: string; photo_type: DriverJobPhotoType; storage_path: string; mime_type: 'image/jpeg' | 'image/png'; file_size: number; created_at: string };

function mapUploadError(message?: string): string {
  const value = message?.toLowerCase() ?? '';
  if (value.includes('not available') || value.includes('assignment')) return 'This job is no longer assigned to you.';
  if (value.includes('jpeg') || value.includes('png')) return 'Choose a JPEG or PNG photo.';
  if (value.includes('10 mb') || value.includes('too large')) return 'Choose a photo smaller than 10 MB.';
  if (value.includes('network') || value.includes('fetch')) return 'No connection. Your photo is ready to retry.';
  return 'Unable to upload this photo. Please try again.';
}

export async function fetchDriverJobPhotos(jobId: string): Promise<{ success: true; photos: DriverJobPhoto[] } | { success: false; error: string }> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };
  try {
    const { data, error } = await supabase.rpc('get_driver_job_photos', { p_pickup_job_id: jobId });
    if (error) return { success: false, error: 'Unable to load job photos.' };
    const rows = (data ?? []) as RawPhoto[];
    const paths = rows.map((photo) => photo.storage_path);
    const { data: signed, error: signedError } = paths.length
      ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_EXPIRY_SECONDS)
      : { data: [], error: null };
    if (signedError) return { success: false, error: 'Unable to load job photos.' };
    const urlByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
    return { success: true, photos: rows.map((photo) => ({ id: photo.id, photoType: photo.photo_type, storagePath: photo.storage_path, mimeType: photo.mime_type, fileSize: photo.file_size, createdAt: photo.created_at, signedUrl: urlByPath.get(photo.storage_path) ?? null })) };
  } catch {
    return { success: false, error: 'Unable to load job photos.' };
  }
}

export function validatePendingDriverPhoto(photo: Pick<PendingDriverJobPhoto, 'mimeType' | 'fileSize'>): string | null {
  if (photo.mimeType !== 'image/jpeg' && photo.mimeType !== 'image/png') return 'Choose a JPEG or PNG photo.';
  if (photo.fileSize != null && (photo.fileSize <= 0 || photo.fileSize > MAX_FILE_SIZE_BYTES)) return 'Choose a photo smaller than 10 MB.';
  return null;
}

export async function uploadDriverJobPhoto(jobId: string, photo: PendingDriverJobPhoto): Promise<{ success: true } | { success: false; error: string; assignmentUnavailable: boolean }> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError, assignmentUnavailable: false };
  const validationError = validatePendingDriverPhoto(photo);
  if (validationError) return { success: false, error: validationError, assignmentUnavailable: false };
  const formData = new FormData();
  formData.append('pickupJobId', jobId);
  formData.append('photoType', photo.photoType);
  formData.append('file', { uri: photo.uri, name: `evidence.${photo.mimeType === 'image/png' ? 'png' : 'jpg'}`, type: photo.mimeType } as never);
  try {
    const { error } = await supabase.functions.invoke('driver-job-photo-upload', { body: formData });
    if (!error) return { success: true };
    const message = await readFunctionError(error);
    const safeError = mapUploadError(message);
    return { success: false, error: safeError, assignmentUnavailable: safeError.includes('no longer assigned') };
  } catch {
    return { success: false, error: 'No connection. Your photo is ready to retry.', assignmentUnavailable: false };
  }
}

async function readFunctionError(error: unknown): Promise<string | undefined> {
  const response = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
  if (!response?.json) return undefined;
  try { return (await response.json()).error; } catch { return undefined; }
}
