import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

import { DriverJobPhoto, DriverJobPhotoType, PendingDriverJobPhoto } from '../types';

const PHOTO_URL_EXPIRY_SECONDS = 300;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PHOTO_BUCKET = 'driver-job-evidence';
const DRIVER_PHOTO_UPLOAD_FUNCTION = 'driver-job-photo-upload';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { success: false, error: 'Photo upload is not configured.', assignmentUnavailable: false };
  }
  try {
    const imageResponse = await fetch(photo.uri);
    if (!imageResponse.ok) throw new Error(`Unable to read the selected photo (${imageResponse.status}).`);
    const imageBytes = await imageResponse.arrayBuffer();
    const actualFileSize = imageBytes.byteLength;
    const fileSizeError = validatePendingDriverPhoto({ mimeType: photo.mimeType, fileSize: actualFileSize });
    if (fileSizeError) return { success: false, error: fileSizeError, assignmentUnavailable: false };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false, error: 'Your session has expired. Please sign in again.', assignmentUnavailable: false };

    const functionUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${DRIVER_PHOTO_UPLOAD_FUNCTION}`;
    if (__DEV__) console.log('[driver-job-photo] requesting Edge Function', {
      functionName: DRIVER_PHOTO_UPLOAD_FUNCTION,
      functionUrl,
      pickupJobId: jobId,
      photoType: photo.photoType,
      mimeType: photo.mimeType,
      fileSize: actualFileSize,
      uri: photo.uri,
    });
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': photo.mimeType,
        'x-pickup-job-id': jobId,
        'x-photo-type': photo.photoType,
      },
      body: imageBytes,
    });
    const responseText = await response.text();
    let responseBody: unknown = responseText || undefined;
    try { responseBody = responseText ? JSON.parse(responseText) : undefined; } catch { /* retain text response */ }
    if (response.ok) {
      if (__DEV__) console.log('[driver-job-photo] Edge Function response', { status: response.status, body: responseBody });
      return { success: true };
    }
    const functionError = {
      functionName: DRIVER_PHOTO_UPLOAD_FUNCTION,
      functionUrl,
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
      message: typeof responseBody === 'object' && responseBody && 'error' in responseBody && typeof responseBody.error === 'string'
        ? responseBody.error
        : responseText || `HTTP ${response.status}`,
    };
    if (__DEV__) console.error('[driver-job-photo] Edge Function error', functionError);
    const safeError = mapUploadError(functionError.message);
    return { success: false, error: safeError, assignmentUnavailable: safeError.includes('no longer assigned') };
  } catch (error) {
    if (__DEV__) console.error('[driver-job-photo] Edge Function request threw before a response', {
      functionName: DRIVER_PHOTO_UPLOAD_FUNCTION,
      functionUrl: SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${DRIVER_PHOTO_UPLOAD_FUNCTION}` : null,
      error: serializeError(error),
    });
    return { success: false, error: 'No connection. Your photo is ready to retry.', assignmentUnavailable: false };
  }
}

function serializeError(error: unknown): { name?: string; message?: string; stack?: string } {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}
