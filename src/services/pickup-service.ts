import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export type PickupRequestStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'completed'
  | 'rejected';

export interface PickupRequest {
  id: string;
  createdBy: string;
  customerId: string;
  customerName?: string;
  pickupAddress: string;
  requestedDate: string;
  requestedTime: string | null;
  materialType: string;
  estimatedWeight: number | null;
  notes: string | null;
  status: PickupRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePickupRequestInput {
  customerId: string;
  pickupAddress: string;
  requestedDate: string;
  requestedTime?: string;
  materialType: string;
  estimatedWeight?: number;
  notes?: string;
}

export interface PickupMetrics {
  pending: number;
  approved: number;
  scheduled: number;
  completed: number;
}

export interface FetchPickupRequestsResult {
  success: boolean;
  requests: PickupRequest[];
  metrics: PickupMetrics;
  error?: string;
}

export interface CreatePickupRequestResult {
  success: boolean;
  request?: PickupRequest;
  error?: string;
}

interface RawPickupRequestRow {
  id: string;
  created_by: string;
  customer_id: string;
  pickup_address: string;
  requested_date: string;
  requested_time: string | null;
  material_type: string;
  estimated_weight: number | null;
  notes: string | null;
  status: PickupRequestStatus;
  created_at: string;
  updated_at: string;
  customers?: { name: string } | { name: string }[] | null;
}

const DEFAULT_METRICS: PickupMetrics = {
  pending: 0,
  approved: 0,
  scheduled: 0,
  completed: 0,
};

function mapRowToPickupRequest(row: RawPickupRequestRow): PickupRequest {
  const customerName = Array.isArray(row.customers)
    ? row.customers[0]?.name
    : row.customers?.name;

  return {
    id: row.id,
    createdBy: row.created_by,
    customerId: row.customer_id,
    customerName,
    pickupAddress: row.pickup_address,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    materialType: row.material_type,
    estimatedWeight: row.estimated_weight != null ? Number(row.estimated_weight) : null,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPickupRequests(): Promise<FetchPickupRequestsResult> {
  if (supabaseConfigurationError) {
    return { success: false, requests: [], metrics: DEFAULT_METRICS, error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase
      .from('pickup_requests')
      .select('id, created_by, customer_id, pickup_address, requested_date, requested_time, material_type, estimated_weight, notes, status, created_at, updated_at, customers(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, requests: [], metrics: DEFAULT_METRICS, error: error.message || 'Failed to load pickup requests.' };
    }

    const requests = (data || []).map((row: RawPickupRequestRow) => mapRowToPickupRequest(row));

    const metrics: PickupMetrics = {
      pending: requests.filter((r) => r.status === 'pending_review').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      scheduled: requests.filter((r) => r.status === 'scheduled').length,
      completed: requests.filter((r) => r.status === 'completed').length,
    };

    return { success: true, requests, metrics };
  } catch {
    return { success: false, requests: [], metrics: DEFAULT_METRICS, error: 'Unable to connect to service. Check network.' };
  }
}

export async function createPickupRequest(input: CreatePickupRequestInput): Promise<CreatePickupRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const customerId = input.customerId.trim();
  const pickupAddress = input.pickupAddress.trim();
  const requestedDate = input.requestedDate.trim();
  const materialType = input.materialType.trim();
  const requestedTime = input.requestedTime?.trim() || null;
  const estimatedWeight = input.estimatedWeight != null && !isNaN(input.estimatedWeight) ? input.estimatedWeight : null;
  const notes = input.notes?.trim() || null;

  if (!customerId) return { success: false, error: 'Customer selection is required.' };
  if (!pickupAddress) return { success: false, error: 'Pickup address is required.' };
  if (!requestedDate) return { success: false, error: 'Requested date is required.' };
  if (!materialType) return { success: false, error: 'Material type is required.' };

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { data, error } = await supabase
      .from('pickup_requests')
      .insert({
        created_by: userData.user.id,
        customer_id: customerId,
        pickup_address: pickupAddress,
        requested_date: requestedDate,
        requested_time: requestedTime,
        material_type: materialType,
        estimated_weight: estimatedWeight,
        notes,
      })
      .select('id, created_by, customer_id, pickup_address, requested_date, requested_time, material_type, estimated_weight, notes, status, created_at, updated_at, customers(name)')
      .single();

    if (error) {
      return { success: false, error: error.message || 'Failed to submit pickup request.' };
    }

    return { success: true, request: mapRowToPickupRequest(data as RawPickupRequestRow) };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}
