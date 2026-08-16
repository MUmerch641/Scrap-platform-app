import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriverSupportStatus = 'pending' | 'resolved' | 'rejected';

export interface DriverSupportRequest {
  id: string;
  jobId: string;
  driverId: string;
  reason: string;
  status: DriverSupportStatus;
  adminNote: string | null;
  clientRequestId: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateDriverSupportRequestResult {
  success: boolean;
  request?: DriverSupportRequest;
  alreadyExists?: boolean;
  error?: string;
}

export interface FetchDriverSupportRequestResult {
  success: boolean;
  request?: DriverSupportRequest | null;
  error?: string;
}

// ─── Raw DB shape ─────────────────────────────────────────────────────────────

interface RawDriverSupportRequest {
  id: string;
  pickup_job_id: string;
  driver_id: string;
  reason: string;
  status: DriverSupportStatus;
  admin_note: string | null;
  client_request_id: string;
  created_at: string;
  resolved_at: string | null;
}

function mapSupportRequest(row: RawDriverSupportRequest): DriverSupportRequest {
  return {
    id: row.id,
    jobId: row.pickup_job_id,
    driverId: row.driver_id,
    reason: row.reason,
    status: row.status,
    adminNote: row.admin_note,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

// ─── RPC: create_driver_support_request ──────────────────────────────────────

/**
 * Calls the `create_driver_support_request` RPC.
 *
 * Uses `client_request_id` for idempotency — the same UUID must be sent for
 * any retry of the same logical submit attempt.
 */
export async function createDriverSupportRequest(
  jobId: string,
  reason: string,
  clientRequestId: string,
): Promise<CreateDriverSupportRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase.rpc('create_driver_support_request', {
      p_pickup_job_id: jobId,
      p_reason: reason.trim(),
      p_client_request_id: clientRequestId,
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? '';

      if (message.includes('already exists') || message.includes('duplicate')) {
        // Idempotent — row was already created with this client_request_id.
        // Fetch the existing row so the UI can show the pending state.
        const existing = await fetchDriverSupportRequest(jobId);
        return {
          success: true,
          alreadyExists: true,
          request: existing.request ?? undefined,
        };
      }

      if (message.includes('not assigned') || message.includes('no longer assigned')) {
        return { success: false, error: 'This job is no longer assigned to you.' };
      }

      if (
        message.includes('delivered') ||
        message.includes('terminal') ||
        message.includes('cannot request support')
      ) {
        return { success: false, error: 'Support requests are not available for completed jobs.' };
      }

      console.warn('[driver-support-service] create_driver_support_request failed', error);
      return {
        success: false,
        error: 'Unable to submit your support request. Check your connection and try again.',
      };
    }

    const rows = (Array.isArray(data) ? data : data ? [data] : []) as RawDriverSupportRequest[];
    const row = rows[0] ?? null;

    if (!row) {
      return {
        success: false,
        error: 'Support request may not have been recorded. Please try again.',
      };
    }

    return { success: true, request: mapSupportRequest(row) };
  } catch {
    return {
      success: false,
      error: 'Unable to connect. Check your connection and try again.',
    };
  }
}

// ─── Query: driver_support_requests ──────────────────────────────────────────

/**
 * Fetches the most recent support request for the current authenticated driver
 * and the given `jobId`.
 *
 * Returns `null` when no request exists yet — not an error.
 */
export async function fetchDriverSupportRequest(
  jobId: string,
): Promise<FetchDriverSupportRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase
      .from('driver_support_requests')
      .select(
        'id, pickup_job_id, driver_id, reason, status, admin_note, client_request_id, created_at, resolved_at',
      )
      .eq('pickup_job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[driver-support-service] fetchDriverSupportRequest failed', error);
      return { success: false, error: 'Unable to load support request status.' };
    }

    return {
      success: true,
      request: data ? mapSupportRequest(data as RawDriverSupportRequest) : null,
    };
  } catch {
    return {
      success: false,
      error: 'Unable to connect. Check your connection and try again.',
    };
  }
}
