import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

const PHOTO_BUCKET = 'sales-rep-pickup-photos';
const MAX_PAGE_SIZE = 50;
const PHOTO_URL_EXPIRY_SECONDS = 300;

export type CustomerPickupHistoryItem = {
  pickupRequestId: string;
  requestedDate: string;
  requestedTime: string | null;
  pickupStatus: string;
  executionStatus: string | null;
  scheduledAt: string | null;
  pickupAddress: string;
  pickupSuburb: string | null;
  pickupState: string | null;
  pickupPostcode: string | null;
  materialType: string;
  materialDescription: string | null;
  estimatedWeight: number | null;
  actualCollectedWeight: number | null;
  createdAt: string;
};

export type SalesRepPickupPhoto = {
  id: string;
  storagePath: string;
  signedUrl: string | null;
  createdAt: string;
};

type RawHistoryItem = {
  pickup_request_id: string;
  requested_date: string;
  requested_time: string | null;
  pickup_status: string;
  execution_status: string | null;
  scheduled_at: string | null;
  pickup_address: string;
  pickup_suburb: string | null;
  pickup_state: string | null;
  pickup_postcode: string | null;
  material_type: string;
  material_description: string | null;
  estimated_weight: number | string | null;
  actual_collected_weight: number | string | null;
  created_at: string;
};

type RawPhoto = { id: string; storage_path: string; created_at: string };

function mapHistoryItem(row: RawHistoryItem): CustomerPickupHistoryItem {
  return {
    pickupRequestId: row.pickup_request_id,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    pickupStatus: row.pickup_status,
    executionStatus: row.execution_status,
    scheduledAt: row.scheduled_at,
    pickupAddress: row.pickup_address,
    pickupSuburb: row.pickup_suburb,
    pickupState: row.pickup_state,
    pickupPostcode: row.pickup_postcode,
    materialType: row.material_type,
    materialDescription: row.material_description,
    estimatedWeight: row.estimated_weight == null ? null : Number(row.estimated_weight),
    actualCollectedWeight: row.actual_collected_weight == null ? null : Number(row.actual_collected_weight),
    createdAt: row.created_at,
  };
}

export async function fetchCustomerPickupHistory(
  customerId: string,
  page: number,
  pageSize = 20,
): Promise<{ success: true; items: CustomerPickupHistoryItem[]; hasMore: boolean } | { success: false; error: string }> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));
  const offset = Math.max(0, Math.trunc(page)) * limit;
  try {
    const { data, error } = await supabase.rpc('get_sales_rep_customer_history', {
      p_customer_id: customerId,
      p_limit: limit + 1,
      p_offset: offset,
    });
    if (error) return { success: false, error: 'Unable to load pickup history. Please try again.' };
    const rows = (data ?? []) as RawHistoryItem[];
    return { success: true, items: rows.slice(0, limit).map(mapHistoryItem), hasMore: rows.length > limit };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}

export async function fetchSalesRepPickupPhotos(
  pickupRequestId: string,
): Promise<{ success: true; photos: SalesRepPickupPhoto[] } | { success: false; error: string }> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };
  try {
    const { data, error } = await supabase.rpc('get_sales_rep_pickup_photos', { p_pickup_request_id: pickupRequestId });
    if (error) return { success: false, error: 'Unable to load pickup photos.' };
    const rows = (data ?? []) as RawPhoto[];
    const paths = rows.map((photo) => photo.storage_path);
    const { data: signedUrls, error: signedError } = paths.length
      ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_EXPIRY_SECONDS)
      : { data: [], error: null };
    if (signedError) return { success: false, error: 'Unable to load pickup photos.' };
    const urlByPath = new Map((signedUrls ?? []).map((item) => [item.path, item.signedUrl]));
    return {
      success: true,
      photos: rows.map((photo) => ({
        id: photo.id,
        storagePath: photo.storage_path,
        signedUrl: urlByPath.get(photo.storage_path) ?? null,
        createdAt: photo.created_at,
      })),
    };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}
