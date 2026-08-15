import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

const PHOTO_BUCKET = 'sales-rep-pickup-photos';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type PendingSalesRepPickupPhoto = {
  id: string;
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileSize?: number;
  status: 'ready' | 'uploading' | 'failed';
  error?: string;
  remotePhotoId?: string;
  storagePath?: string;
};

type PhotoMetadataRow = { id: string; storage_path: string };

function uploadErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message.toLowerCase() : '';
  if (value.includes('network') || value.includes('fetch')) {
    return 'No connection. The photo is ready to retry.';
  }
  if (value.includes('jpeg') || value.includes('png') || value.includes('10 mb')) {
    return 'Choose a JPEG or PNG photo smaller than 10 MB.';
  }
  return 'Unable to upload this photo. Please try again.';
}

export function validatePendingSalesRepPickupPhoto(
  photo: Pick<PendingSalesRepPickupPhoto, 'mimeType' | 'fileSize'>,
): string | null {
  if (photo.mimeType !== 'image/jpeg' && photo.mimeType !== 'image/png') {
    return 'Choose a JPEG or PNG photo.';
  }
  if (photo.fileSize != null && (photo.fileSize <= 0 || photo.fileSize > MAX_FILE_SIZE_BYTES)) {
    return 'Choose a photo smaller than 10 MB.';
  }
  return null;
}

/**
 * Uploads a pre-pickup scrap photo through the Sales Rep-only metadata flow.
 * The metadata row is retained on a transient upload error so the same object
 * path can be retried without creating duplicate records.
 */
export async function uploadSalesRepPickupPhoto(
  pickupRequestId: string,
  photo: PendingSalesRepPickupPhoto,
): Promise<
  | { success: true; photoId: string; storagePath: string }
  | { success: false; error: string; photoId?: string; storagePath?: string }
> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  const validationError = validatePendingSalesRepPickupPhoto(photo);
  if (validationError) return { success: false, error: validationError };

  try {
    const response = await fetch(photo.uri);
    const body = await response.blob();
    const fileSize = photo.fileSize ?? body.size;
    const resolvedValidationError = validatePendingSalesRepPickupPhoto({
      mimeType: photo.mimeType,
      fileSize,
    });
    if (resolvedValidationError) return { success: false, error: resolvedValidationError };

    let photoId = photo.remotePhotoId;
    let storagePath = photo.storagePath;

    if (!photoId || !storagePath) {
      const { data, error } = await supabase.rpc('create_sales_rep_pickup_photo_metadata', {
        p_pickup_request_id: pickupRequestId,
        p_mime_type: photo.mimeType,
        p_file_size: fileSize,
      });
      if (error) return { success: false, error: uploadErrorMessage(error) };

      const metadata = Array.isArray(data) ? data[0] : data;
      if (!metadata || typeof metadata.id !== 'string' || typeof metadata.storage_path !== 'string') {
        return { success: false, error: 'Unable to prepare this photo. Please try again.' };
      }
      photoId = (metadata as PhotoMetadataRow).id;
      storagePath = (metadata as PhotoMetadataRow).storage_path;
    }

    const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).upload(
      storagePath,
      body,
      { contentType: photo.mimeType, upsert: true },
    );
    if (storageError) {
      return { success: false, error: uploadErrorMessage(storageError), photoId, storagePath };
    }

    const { error: completionError } = await supabase.rpc('complete_sales_rep_pickup_photo_metadata', {
      p_photo_id: photoId,
    });
    if (completionError) {
      return { success: false, error: uploadErrorMessage(completionError), photoId, storagePath };
    }

    return { success: true, photoId, storagePath };
  } catch (error) {
    return {
      success: false,
      error: uploadErrorMessage(error),
      photoId: photo.remotePhotoId,
      storagePath: photo.storagePath,
    };
  }
}

/** Removes a pending metadata record when a Sales Rep cancels a failed upload. */
export async function discardSalesRepPickupPhoto(
  photo: Pick<PendingSalesRepPickupPhoto, 'remotePhotoId'>,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!photo.remotePhotoId) return { success: true };
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };
  try {
    const { error } = await supabase.rpc('discard_sales_rep_pickup_photo_metadata', {
      p_photo_id: photo.remotePhotoId,
    });
    if (error) return { success: false, error: 'Unable to remove this pending photo. Please try again.' };
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to connect to service. Please try again.' };
  }
}
