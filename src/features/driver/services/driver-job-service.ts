import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

import {
  AvailableDriverJob,
  DriverCoordinate,
  DriverExecutionStatus,
  DriverJob,
  VehicleSummary,
} from '../types';

const MAX_PAGE_SIZE = 100;
export const DRIVER_JOB_PAGE_SIZE = 20;
export const DRIVER_EXECUTION_FIELD_LIMITS = {
  actualCollectedWeightKg: 1_000_000,
  driverNotes: 1000,
} as const;
const WEIGHT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export type DriverJobSort = 'scheduled_asc' | 'delivered_desc';

export interface DriverJobPageOptions {
  page: number;
  pageSize?: number;
  scheduledFrom?: string;
  scheduledTo?: string;
  executionStatuses?: readonly DriverExecutionStatus[];
  sort?: DriverJobSort;
  jobId?: string;
}

export interface DriverJobPageResult {
  success: boolean;
  jobs: DriverJob[];
  hasMore: boolean;
  error?: string;
}

export interface DriverJobSummaryResult {
  success: boolean;
  todayJobs: number;
  completedToday: number;
  error?: string;
}

export interface AvailableDriverJobPageResult {
  success: boolean;
  jobs: AvailableDriverJob[];
  hasMore: boolean;
  error?: string;
}

export type AcceptDriverJobFailure =
  | 'already-taken'
  | 'no-approved-vehicle'
  | 'unauthorized'
  | 'unavailable';

export interface AcceptDriverJobResult {
  success: boolean;
  jobId?: string;
  assignmentId?: string;
  alreadyAccepted?: boolean;
  failure?: AcceptDriverJobFailure;
  error?: string;
}

export type DriverJobTransitionFailure = 'assignment-unavailable' | 'invalid-transition' | 'unavailable';

export interface DriverJobTransitionResult {
  success: boolean;
  executionStatus?: DriverExecutionStatus;
  transitionApplied?: boolean;
  failure?: DriverJobTransitionFailure;
  error?: string;
}

export interface DriverMaterialCollectionInput {
  actualCollectedWeight: number;
  driverNotes: string | null;
}

export type DriverMaterialCollectionValidationResult =
  | { success: true; value: DriverMaterialCollectionInput }
  | { success: false; field: 'weight' | 'notes'; error: string };

interface RawDriverJob {
  id: string;
  execution_status: DriverExecutionStatus;
  scheduled_at: string | null;
  customer_name: string;
  contact_person: string | null;
  customer_phone: string;
  customer_email: string | null;
  pickup_address: string;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
  material_type: string;
  estimated_weight: number | string | null;
  pickup_notes: string | null;
  assignment_id: string;
  driver_id: string;
  assigned_at: string;
  vehicle_id: string;
  vehicle_label: string;
  vehicle_registration_number: string | null;
  actual_collected_weight: number | string | null;
  driver_notes: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  material_collected_at: string | null;
  delivered_to_yard_at: string | null;
}

interface RawAvailableDriverJob {
  id: string;
  scheduled_at: string;
  pickup_area: string | null;
  material_type: string;
  estimated_weight: number | string | null;
  available_at: string;
}

function mapPickupCoordinate(row: RawDriverJob): DriverCoordinate | null {
  if (row.pickup_latitude == null || row.pickup_longitude == null) return null;
  const latitude = Number(row.pickup_latitude);
  const longitude = Number(row.pickup_longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;
  return { latitude, longitude };
}

function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function mapJob(row: RawDriverJob): DriverJob {
  const vehicle: VehicleSummary = {
    id: row.vehicle_id,
    label: row.vehicle_label,
    registrationNumber: row.vehicle_registration_number,
  };

  return {
    id: row.id,
    executionStatus: row.execution_status,
    scheduledAt: row.scheduled_at,
    customerName: row.customer_name,
    contactPerson: row.contact_person,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    pickupAddress: row.pickup_address,
    pickupCoordinate: mapPickupCoordinate(row),
    materialType: row.material_type,
    estimatedWeight: row.estimated_weight == null ? null : Number(row.estimated_weight),
    pickupNotes: row.pickup_notes,
    assignment: {
      id: row.assignment_id,
      driverId: row.driver_id,
      vehicle,
      assignedAt: row.assigned_at,
    },
    actualCollectedWeight:
      row.actual_collected_weight == null ? null : Number(row.actual_collected_weight),
    driverNotes: row.driver_notes,
    enRouteAt: row.en_route_at,
    arrivedAt: row.arrived_at,
    materialCollectedAt: row.material_collected_at,
    deliveredToYardAt: row.delivered_to_yard_at,
  };
}

function mapAvailableJob(row: RawAvailableDriverJob): AvailableDriverJob {
  return {
    id: row.id,
    scheduledAt: row.scheduled_at,
    pickupArea: row.pickup_area,
    materialType: row.material_type,
    estimatedWeight: row.estimated_weight == null ? null : Number(row.estimated_weight),
    availableAt: row.available_at,
  };
}

function mapError(operation: string, error: { code?: string; message?: string; details?: string; hint?: string } | null): string {
  if (__DEV__) console.warn(`[driver-job-service] ${operation} failed`, error);
  return 'Unable to load jobs. Check your connection and try again.';
}

export function validateDriverMaterialCollectionInput(
  actualCollectedWeightInput: string,
  driverNotesInput: string,
): DriverMaterialCollectionValidationResult {
  const weight = actualCollectedWeightInput.trim();
  if (!weight) {
    return { success: false, field: 'weight', error: 'Actual collected weight is required.' };
  }
  if (!WEIGHT_PATTERN.test(weight)) {
    return { success: false, field: 'weight', error: 'Enter a valid weight in kg.' };
  }

  const actualCollectedWeight = Number(weight);
  if (!Number.isFinite(actualCollectedWeight)) {
    return { success: false, field: 'weight', error: 'Actual collected weight must be a finite number.' };
  }
  if (actualCollectedWeight < 0) {
    return { success: false, field: 'weight', error: 'Actual collected weight cannot be negative.' };
  }
  if (actualCollectedWeight > DRIVER_EXECUTION_FIELD_LIMITS.actualCollectedWeightKg) {
    return {
      success: false,
      field: 'weight',
      error: `Actual collected weight must be ${DRIVER_EXECUTION_FIELD_LIMITS.actualCollectedWeightKg.toLocaleString()} kg or less.`,
    };
  }

  const driverNotes = driverNotesInput.trim() || null;
  if (driverNotes && driverNotes.length > DRIVER_EXECUTION_FIELD_LIMITS.driverNotes) {
    return {
      success: false,
      field: 'notes',
      error: `Driver notes must be ${DRIVER_EXECUTION_FIELD_LIMITS.driverNotes} characters or fewer.`,
    };
  }

  return { success: true, value: { actualCollectedWeight, driverNotes } };
}

function mapTransitionError(error: { code?: string; message?: string } | null): DriverJobTransitionResult {
  const message = error?.message?.toLowerCase() ?? '';
  if (message.includes('no longer assigned') || message.includes('access is no longer available')) {
    return {
      success: false,
      failure: 'assignment-unavailable',
      error: 'This job is no longer assigned to you. It has been refreshed.',
    };
  }
  if (message.includes('cannot move') || message.includes('cannot record')) {
    return {
      success: false,
      failure: 'invalid-transition',
      error: 'This job status changed before your update. It has been refreshed.',
    };
  }
  if (message.includes('job is unavailable')) {
    return {
      success: false,
      failure: 'unavailable',
      error: 'This job is no longer available.',
    };
  }
  if (message.includes('already been recorded')) {
    return {
      success: false,
      failure: 'invalid-transition',
      error: 'Collection data was already recorded differently. The job has been refreshed.',
    };
  }
  if (__DEV__) console.warn('[driver-job-service] transition job failed', { code: error?.code });
  return {
    success: false,
    error: 'Unable to update this job. Check your connection and try again.',
  };
}

export function formatDriverLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchDriverJobs(options: DriverJobPageOptions): Promise<DriverJobPageResult> {
  if (supabaseConfigurationError) {
    return { success: false, jobs: [], hasMore: false, error: supabaseConfigurationError };
  }

  const page = Math.max(0, Math.trunc(options.page));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(options.pageSize ?? DRIVER_JOB_PAGE_SIZE)));

  try {
    const rpcArgs = {
      p_limit: pageSize + 1,
      p_offset: page * pageSize,
      p_job_id: options.jobId ?? null,
      p_scheduled_from: options.scheduledFrom ?? null,
      p_scheduled_to: options.scheduledTo ?? null,
      p_execution_statuses: options.executionStatuses?.length ? options.executionStatuses : null,
      p_sort: options.sort ?? 'scheduled_asc',
      p_timezone: getDeviceTimeZone(),
    };
    if (__DEV__) console.log('[driver-job-service] get_driver_jobs request', rpcArgs);
    const { data, error } = await supabase.rpc('get_driver_jobs', rpcArgs);
    if (__DEV__) {
      console.log('[driver-job-service] get_driver_jobs response data', data);
      console.error('[driver-job-service] get_driver_jobs error', error ? {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      } : null);
    }
    if (error) return { success: false, jobs: [], hasMore: false, error: mapError('load jobs', error) };
    // A table-returning RPC normally returns an array, but normalize a single
    // row as well so a valid detail response is not discarded by `.slice()`.
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as RawDriverJob[];
    return { success: true, jobs: rows.slice(0, pageSize).map(mapJob), hasMore: rows.length > pageSize };
  } catch {
    return { success: false, jobs: [], hasMore: false, error: 'Unable to connect to service. Check your connection and try again.' };
  }
}

export async function fetchAvailableDriverJobs(
  page = 0,
  pageSize = DRIVER_JOB_PAGE_SIZE,
): Promise<AvailableDriverJobPageResult> {
  if (supabaseConfigurationError) {
    return { success: false, jobs: [], hasMore: false, error: supabaseConfigurationError };
  }

  const safePage = Math.max(0, Math.trunc(page));
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));

  try {
    const { data, error } = await supabase.rpc('get_available_driver_jobs', {
      p_limit: safePageSize + 1,
      p_offset: safePage * safePageSize,
    });
    if (error) {
      return { success: false, jobs: [], hasMore: false, error: mapError('load available jobs', error) };
    }
    const rows = (data ?? []) as RawAvailableDriverJob[];
    return {
      success: true,
      jobs: rows.slice(0, safePageSize).map(mapAvailableJob),
      hasMore: rows.length > safePageSize,
    };
  } catch {
    return { success: false, jobs: [], hasMore: false, error: 'Unable to connect to service. Check your connection and try again.' };
  }
}

export async function acceptDriverJob(jobId: string): Promise<AcceptDriverJobResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };

  try {
    const { data, error } = await supabase.rpc('accept_driver_job', { p_job_id: jobId });
    if (error) {
      const message = error.message?.toLowerCase() ?? '';
      if (message.includes('no valid pre-approved vehicle')) {
        return {
          success: false,
          failure: 'no-approved-vehicle',
          error: 'No active pre-approved vehicle is linked to your Driver account. Contact Operations.',
        };
      }
      if (message.includes('no longer available')) {
        return {
          success: false,
          failure: 'already-taken',
          error: 'This job has already been accepted by another driver.',
        };
      }
      if (error.code === '42501' || message.includes('not authorized')) {
        return { success: false, failure: 'unauthorized', error: 'Driver access is no longer available.' };
      }
      if (__DEV__) console.warn('[driver-job-service] accept job failed', { code: error.code });
      return { success: false, failure: 'unavailable', error: 'Unable to accept this job. Refresh and try again.' };
    }

    const accepted = (data?.[0] ?? null) as {
      pickup_job_id?: string;
      pickup_job_assignment_id?: string;
      already_accepted?: boolean;
    } | null;
    if (!accepted?.pickup_job_id || !accepted.pickup_job_assignment_id) {
      return { success: false, failure: 'unavailable', error: 'Unable to confirm job acceptance. Refresh and try again.' };
    }

    return {
      success: true,
      jobId: accepted.pickup_job_id,
      assignmentId: accepted.pickup_job_assignment_id,
      alreadyAccepted: accepted.already_accepted ?? false,
    };
  } catch {
    return { success: false, error: 'Unable to accept this job. Check your connection and try again.' };
  }
}

export async function fetchDriverJobSummary(localDate: string): Promise<DriverJobSummaryResult> {
  if (supabaseConfigurationError) return { success: false, todayJobs: 0, completedToday: 0, error: supabaseConfigurationError };
  try {
    const { data, error } = await supabase.rpc('get_driver_job_summary', {
      p_local_date: localDate,
      p_timezone: getDeviceTimeZone(),
    });
    if (error) return { success: false, todayJobs: 0, completedToday: 0, error: mapError('load job summary', error) };
    const summary = (data?.[0] ?? { today_jobs: 0, completed_today: 0 }) as { today_jobs: number; completed_today: number };
    return { success: true, todayJobs: summary.today_jobs, completedToday: summary.completed_today };
  } catch {
    return { success: false, todayJobs: 0, completedToday: 0, error: 'Unable to connect to service. Check your connection and try again.' };
  }
}

export async function transitionDriverJob(
  jobId: string,
  targetStatus: DriverExecutionStatus,
): Promise<DriverJobTransitionResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase.rpc('transition_driver_job', {
      p_job_id: jobId,
      p_target_status: targetStatus,
    });
    if (error) return mapTransitionError(error);

    const result = (data?.[0] ?? null) as {
      execution_status?: DriverExecutionStatus;
      transition_applied?: boolean;
    } | null;
    if (!result?.execution_status) {
      return { success: false, error: 'Unable to confirm the job update. Please refresh and try again.' };
    }

    return {
      success: true,
      executionStatus: result.execution_status,
      transitionApplied: result.transition_applied ?? false,
    };
  } catch {
    return {
      success: false,
      error: 'Unable to update this job. Check your connection and try again.',
    };
  }
}

export async function recordDriverMaterialCollection(
  jobId: string,
  input: DriverMaterialCollectionInput,
): Promise<DriverJobTransitionResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase.rpc('record_driver_material_collection', {
      p_job_id: jobId,
      p_actual_collected_weight: input.actualCollectedWeight,
      p_driver_notes: input.driverNotes,
    });
    if (error) return mapTransitionError(error);

    const result = (data?.[0] ?? null) as {
      execution_status?: DriverExecutionStatus;
      transition_applied?: boolean;
    } | null;
    if (!result?.execution_status) {
      return { success: false, error: 'Unable to confirm material collection. Please refresh and try again.' };
    }

    return {
      success: true,
      executionStatus: result.execution_status,
      transitionApplied: result.transition_applied ?? false,
    };
  } catch {
    return { success: false, error: 'Unable to record material collection. Check your connection and try again.' };
  }
}
