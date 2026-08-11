import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

import {
  DriverExecutionStatus,
  DriverJob,
  VehicleSummary,
} from '../types';

const MAX_PAGE_SIZE = 100;
export const DRIVER_JOB_PAGE_SIZE = 20;

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

interface RawDriverJob {
  id: string;
  execution_status: DriverExecutionStatus;
  scheduled_at: string | null;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
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
  en_route_at: string | null;
  arrived_at: string | null;
  material_collected_at: string | null;
  delivered_to_yard_at: string | null;
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
    customerPhone: row.customer_phone,
    pickupAddress: row.pickup_address,
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
    enRouteAt: row.en_route_at,
    arrivedAt: row.arrived_at,
    materialCollectedAt: row.material_collected_at,
    deliveredToYardAt: row.delivered_to_yard_at,
  };
}

function mapError(operation: string, error: { code?: string } | null): string {
  if (__DEV__) console.warn(`[driver-job-service] ${operation} failed`, { code: error?.code });
  return 'Unable to load jobs. Check your connection and try again.';
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
    const { data, error } = await supabase.rpc('get_driver_jobs', {
      p_limit: pageSize + 1,
      p_offset: page * pageSize,
      p_job_id: options.jobId ?? null,
      p_scheduled_from: options.scheduledFrom ?? null,
      p_scheduled_to: options.scheduledTo ?? null,
      p_execution_statuses: options.executionStatuses?.length ? options.executionStatuses : null,
      p_sort: options.sort ?? 'scheduled_asc',
      p_timezone: getDeviceTimeZone(),
    });
    if (error) return { success: false, jobs: [], hasMore: false, error: mapError('load jobs', error) };
    const rows = (data ?? []) as RawDriverJob[];
    return { success: true, jobs: rows.slice(0, pageSize).map(mapJob), hasMore: rows.length > pageSize };
  } catch {
    return { success: false, jobs: [], hasMore: false, error: 'Unable to connect to service. Check your connection and try again.' };
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
