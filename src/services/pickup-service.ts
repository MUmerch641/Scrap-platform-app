import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export const MATERIAL_OPTIONS = [
  'Copper',
  'Insulated copper wire/cable',
  'Aluminium',
  'Steel',
  'Stainless steel',
  'Brass',
  'Mixed metal',
  'Machinery',
  'Old equipment',
  'Metal shelving',
  'Metal offcuts',
  'Other recyclable metal',
] as const;

export const AUSTRALIAN_STATE_OPTIONS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

export const PICKUP_FIELD_LIMITS = {
  address: 300,
  suburb: 120,
  state: 64,
  postcode: 20,
  materialDescription: 1000,
  siteAccessInstructions: 1000,
  loadingRequirements: 1000,
  deliveryYardName: 200,
  leadSource: 120,
  internalNotes: 1000,
  notes: 1000,
  estimatedWeightKg: 1_000_000,
} as const;

export type PickupRequestStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'completed'
  | 'rejected';

export type PickupStatusFilter = 'all' | PickupRequestStatus;

export interface PickupRequest {
  id: string;
  createdBy: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  pickupAddress: string;
  pickupSuburb: string | null;
  pickupState: string | null;
  pickupPostcode: string | null;
  requestedDate: string;
  requestedTime: string | null;
  materialType: string;
  materialDescription: string | null;
  estimatedWeight: number | null;
  siteAccessInstructions: string | null;
  loadingRequirements: string | null;
  deliveryYardName: string | null;
  leadSource: string | null;
  internalNotes: string | null;
  notes: string | null;
  status: PickupRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePickupRequestInput {
  customerId: string;
  pickupAddress: string;
  pickupSuburb: string;
  pickupState: string;
  pickupPostcode: string;
  requestedDate: string;
  requestedTime?: string | null;
  materialType: string;
  materialDescription?: string | null;
  estimatedWeight?: number | null;
  siteAccessInstructions?: string | null;
  loadingRequirements?: string | null;
  deliveryYardName?: string | null;
  leadSource?: string | null;
  internalNotes?: string | null;
  notes?: string | null;
}

interface NormalizedPickupRequestInput {
  customerId: string;
  pickupAddress: string;
  pickupSuburb: string;
  pickupState: string;
  pickupPostcode: string;
  requestedDate: string;
  requestedTime: string | null;
  materialType: string;
  materialDescription: string | null;
  estimatedWeight: number | null;
  siteAccessInstructions: string | null;
  loadingRequirements: string | null;
  deliveryYardName: string | null;
  leadSource: string | null;
  internalNotes: string | null;
  notes: string | null;
}

export type PickupValidationResult =
  | { success: true; value: NormalizedPickupRequestInput }
  | { success: false; error: string };

export type EstimatedWeightParseResult =
  | { success: true; value: number | null }
  | { success: false; error: string };

export interface PickupMetrics {
  pending: number;
  approved: number;
  scheduled: number;
  completed: number;
}

export interface FetchPickupDashboardResult {
  requestsSuccess: boolean;
  metricsSuccess: boolean;
  requests: PickupRequest[];
  metrics: PickupMetrics;
  requestsError?: string;
  metricsError?: string;
}

export interface CreatePickupRequestResult {
  success: boolean;
  request?: PickupRequest;
  error?: string;
}

export interface FetchPickupRequestsPageOptions {
  search?: string;
  status?: PickupStatusFilter;
  page: number;
  pageSize?: number;
  includeTotalCount?: boolean;
}

export interface FetchPickupRequestsPageResult {
  success: boolean;
  requests: PickupRequest[];
  hasMore: boolean;
  totalCount?: number;
  error?: string;
}

export interface FetchPickupRequestResult {
  success: boolean;
  request?: PickupRequest;
  error?: string;
}

interface RawPickupRequestRow {
  id: string;
  created_by: string;
  customer_id: string;
  pickup_address: string;
  pickup_suburb: string | null;
  pickup_state: string | null;
  pickup_postcode: string | null;
  requested_date: string;
  requested_time: string | null;
  material_type: string;
  material_description: string | null;
  estimated_weight: number | null;
  site_access_instructions: string | null;
  loading_requirements: string | null;
  delivery_yard_name: string | null;
  lead_source: string | null;
  internal_notes: string | null;
  notes: string | null;
  status: PickupRequestStatus;
  created_at: string;
  updated_at: string;
  customers?:
    | { name: string; phone: string }
    | { name: string; phone: string }[]
    | null;
}

interface RawPickupDirectoryRow {
  id: string;
  created_by: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_suburb: string | null;
  pickup_state: string | null;
  pickup_postcode: string | null;
  requested_date: string;
  requested_time: string | null;
  material_type: string;
  material_description: string | null;
  estimated_weight: number | null;
  site_access_instructions: string | null;
  loading_requirements: string | null;
  delivery_yard_name: string | null;
  lead_source: string | null;
  internal_notes: string | null;
  notes: string | null;
  status: PickupRequestStatus;
  created_at: string;
  updated_at: string;
}

const DEFAULT_METRICS: PickupMetrics = {
  pending: 0,
  approved: 0,
  scheduled: 0,
  completed: 0,
};

const PICKUP_COLUMNS =
  'id, created_by, customer_id, pickup_address, pickup_suburb, pickup_state, pickup_postcode, requested_date, requested_time, material_type, material_description, estimated_weight, notes, site_access_instructions, loading_requirements, delivery_yard_name, lead_source, internal_notes, status, created_at, updated_at, customers(name, phone)';
const PICKUP_DIRECTORY_COLUMNS =
  'id, created_by, customer_id, customer_name, customer_phone, pickup_address, pickup_suburb, pickup_state, pickup_postcode, requested_date, requested_time, material_type, material_description, estimated_weight, notes, site_access_instructions, loading_requirements, delivery_yard_name, lead_source, internal_notes, status, created_at, updated_at';
const MAX_PICKUP_PAGE_SIZE = 100;
const MAX_PICKUP_SEARCH_LENGTH = 100;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WEIGHT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logPickupDatabaseError(operation: string, error: { code?: string } | null): void {
  if (__DEV__) {
    console.warn(`[pickup-service] ${operation} failed`, {
      code: error?.code ?? 'unknown',
    });
  }
}

function requestPickupGeocoding(pickupRequestId: string): void {
  void supabase.functions
    .invoke('geocode-pickup-request', { body: { pickupRequestId } })
    .then(({ error }) => {
      if (error) logPickupDatabaseError('queue pickup geocoding', null);
    })
    .catch(() => {
      // Geocoding is intentionally non-blocking; the pickup remains valid without coordinates.
    });
}

function mapRowToPickupRequest(row: RawPickupRequestRow): PickupRequest {
  const customer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers;

  return {
    id: row.id,
    createdBy: row.created_by,
    customerId: row.customer_id,
    customerName: customer?.name,
    customerPhone: customer?.phone,
    pickupAddress: row.pickup_address,
    pickupSuburb: row.pickup_suburb,
    pickupState: row.pickup_state,
    pickupPostcode: row.pickup_postcode,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    materialType: row.material_type,
    materialDescription: row.material_description,
    estimatedWeight: row.estimated_weight != null ? Number(row.estimated_weight) : null,
    siteAccessInstructions: row.site_access_instructions,
    loadingRequirements: row.loading_requirements,
    deliveryYardName: row.delivery_yard_name,
    leadSource: row.lead_source,
    internalNotes: row.internal_notes,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDirectoryRowToPickupRequest(row: RawPickupDirectoryRow): PickupRequest {
  return {
    id: row.id,
    createdBy: row.created_by,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    pickupAddress: row.pickup_address,
    pickupSuburb: row.pickup_suburb,
    pickupState: row.pickup_state,
    pickupPostcode: row.pickup_postcode,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    materialType: row.material_type,
    materialDescription: row.material_description,
    estimatedWeight: row.estimated_weight != null ? Number(row.estimated_weight) : null,
    siteAccessInstructions: row.site_access_instructions,
    loadingRequirements: row.loading_requirements,
    deliveryYardName: row.delivery_yard_name,
    leadSource: row.lead_source,
    internalNotes: row.internal_notes,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Removes PostgREST wildcard/control characters before building a partial match. */
export function normalizePickupSearch(value: string): string {
  return value
    .trim()
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_PICKUP_SEARCH_LENGTH);
}

export function formatLocalCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidLocalCalendarDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDate = new Date(year, month - 1, day, 12);

  return (
    localDate.getFullYear() === year &&
    localDate.getMonth() === month - 1 &&
    localDate.getDate() === day
  );
}

export function parseEstimatedWeightInput(
  input: string,
): EstimatedWeightParseResult {
  const value = input.trim();
  if (!value) return { success: true, value: null };

  if (!WEIGHT_PATTERN.test(value)) {
    return { success: false, error: 'Estimated weight must be a valid number in kg.' };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { success: false, error: 'Estimated weight must be a finite number.' };
  }
  if (parsed < 0) {
    return { success: false, error: 'Estimated weight cannot be negative.' };
  }
  if (parsed > PICKUP_FIELD_LIMITS.estimatedWeightKg) {
    return {
      success: false,
      error: `Estimated weight must be ${PICKUP_FIELD_LIMITS.estimatedWeightKg.toLocaleString()} kg or less.`,
    };
  }

  return { success: true, value: parsed };
}

export function validatePickupRequestInput(
  input: CreatePickupRequestInput,
): PickupValidationResult {
  const customerId = input.customerId.trim();
  const pickupAddress = input.pickupAddress.trim();
  const pickupSuburb = input.pickupSuburb.trim().replace(/\s+/g, ' ');
  const pickupState = input.pickupState.trim().toUpperCase();
  const pickupPostcode = input.pickupPostcode.trim().replace(/\s+/g, ' ');
  const requestedDate = input.requestedDate.trim();
  const requestedTime = input.requestedTime?.trim() || null;
  const materialType = input.materialType.trim();
  const materialDescription = input.materialDescription?.trim() || null;
  const estimatedWeight = input.estimatedWeight ?? null;
  const siteAccessInstructions = input.siteAccessInstructions?.trim() || null;
  const loadingRequirements = input.loadingRequirements?.trim() || null;
  const deliveryYardName = input.deliveryYardName?.trim() || null;
  const leadSource = input.leadSource?.trim() || null;
  const internalNotes = input.internalNotes?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!customerId) return { success: false, error: 'Customer selection is required.' };
  if (!pickupAddress) return { success: false, error: 'Pickup address is required.' };
  if (pickupAddress.length > PICKUP_FIELD_LIMITS.address) {
    return {
      success: false,
      error: `Pickup address must be ${PICKUP_FIELD_LIMITS.address} characters or fewer.`,
    };
  }
  if (!pickupSuburb) return { success: false, error: 'Pickup suburb is required.' };
  if (pickupSuburb.length > PICKUP_FIELD_LIMITS.suburb) {
    return { success: false, error: `Pickup suburb must be ${PICKUP_FIELD_LIMITS.suburb} characters or fewer.` };
  }
  if (!pickupState) return { success: false, error: 'Pickup state is required.' };
  if (!AUSTRALIAN_STATE_OPTIONS.includes(pickupState as (typeof AUSTRALIAN_STATE_OPTIONS)[number])) {
    return { success: false, error: 'Select a valid Australian state or territory.' };
  }
  if (!pickupPostcode) return { success: false, error: 'Pickup postcode is required.' };
  if (!/^\d{4}$/.test(pickupPostcode)) {
    return { success: false, error: 'Pickup postcode must contain 4 digits.' };
  }

  if (!requestedDate) return { success: false, error: 'Requested date is required.' };
  if (!isValidLocalCalendarDate(requestedDate)) {
    return { success: false, error: 'Requested date must be a valid date in YYYY-MM-DD format.' };
  }
  if (requestedDate < formatLocalCalendarDate(new Date())) {
    return { success: false, error: 'Requested date cannot be in the past.' };
  }

  if (requestedTime && !TIME_PATTERN.test(requestedTime)) {
    return { success: false, error: 'Requested time must use 24-hour HH:mm format.' };
  }

  if (!materialType) return { success: false, error: 'Material type is required.' };
  if (!MATERIAL_OPTIONS.includes(materialType as (typeof MATERIAL_OPTIONS)[number])) {
    return { success: false, error: 'Select a material type from the available options.' };
  }
  const optionalFieldChecks: [string | null, number, string][] = [
    [materialDescription, PICKUP_FIELD_LIMITS.materialDescription, 'Material description'],
    [siteAccessInstructions, PICKUP_FIELD_LIMITS.siteAccessInstructions, 'Site access instructions'],
    [loadingRequirements, PICKUP_FIELD_LIMITS.loadingRequirements, 'Loading requirements'],
    [deliveryYardName, PICKUP_FIELD_LIMITS.deliveryYardName, 'Delivery yard'],
    [leadSource, PICKUP_FIELD_LIMITS.leadSource, 'Lead source'],
    [internalNotes, PICKUP_FIELD_LIMITS.internalNotes, 'Internal notes'],
    [notes, PICKUP_FIELD_LIMITS.notes, 'Special instructions'],
  ];
  for (const [value, limit, label] of optionalFieldChecks) {
    if (value && value.length > limit) return { success: false, error: `${label} must be ${limit} characters or fewer.` };
  }

  if (estimatedWeight !== null) {
    if (!Number.isFinite(estimatedWeight)) {
      return { success: false, error: 'Estimated weight must be a finite number.' };
    }
    if (estimatedWeight < 0) {
      return { success: false, error: 'Estimated weight cannot be negative.' };
    }
    if (estimatedWeight > PICKUP_FIELD_LIMITS.estimatedWeightKg) {
      return {
        success: false,
        error: `Estimated weight must be ${PICKUP_FIELD_LIMITS.estimatedWeightKg.toLocaleString()} kg or less.`,
      };
    }
  }

  return {
    success: true,
    value: {
      customerId,
      pickupAddress,
      pickupSuburb,
      pickupState,
      pickupPostcode,
      requestedDate,
      requestedTime,
      materialType,
      materialDescription,
      estimatedWeight,
      siteAccessInstructions,
      loadingRequirements,
      deliveryYardName,
      leadSource,
      internalNotes,
      notes,
    },
  };
}

/** Fetches only five recent rows and server-side status counts for the dashboard. */
export async function fetchPickupDashboard(): Promise<FetchPickupDashboardResult> {
  if (supabaseConfigurationError) {
    return {
      requestsSuccess: false,
      metricsSuccess: false,
      requests: [],
      metrics: DEFAULT_METRICS,
      requestsError: supabaseConfigurationError,
      metricsError: supabaseConfigurationError,
    };
  }

  try {
    const [recentResult, pendingResult, approvedResult, scheduledResult, completedResult] =
      await Promise.all([
        supabase
          .from('pickup_requests')
          .select(PICKUP_COLUMNS)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(5),
        supabase
          .from('pickup_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_review'),
        supabase
          .from('pickup_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
        supabase
          .from('pickup_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'scheduled'),
        supabase
          .from('pickup_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ]);

    const metricsError =
      pendingResult.error ||
      approvedResult.error ||
      scheduledResult.error ||
      completedResult.error;

    if (recentResult.error) logPickupDatabaseError('load recent pickups', recentResult.error);
    if (metricsError) logPickupDatabaseError('load pickup counts', metricsError);

    return {
      requestsSuccess: !recentResult.error,
      metricsSuccess: !metricsError,
      requests: recentResult.error
        ? []
        : ((recentResult.data || []) as RawPickupRequestRow[]).map(mapRowToPickupRequest),
      metrics: metricsError
        ? DEFAULT_METRICS
        : {
            pending: pendingResult.count ?? 0,
            approved: approvedResult.count ?? 0,
            scheduled: scheduledResult.count ?? 0,
            completed: completedResult.count ?? 0,
          },
      requestsError: recentResult.error
        ? 'Unable to load recent pickups. Check your connection and try again.'
        : undefined,
      metricsError: metricsError
        ? 'Unable to load pickup counts. Check your connection and try again.'
        : undefined,
    };
  } catch {
    return {
      requestsSuccess: false,
      metricsSuccess: false,
      requests: [],
      metrics: DEFAULT_METRICS,
      requestsError: 'Unable to load recent pickups. Check your connection and try again.',
      metricsError: 'Unable to load pickup counts. Check your connection and try again.',
    };
  }
}

/** Fetches one bounded, deterministically ordered page from the RLS-invoker directory view. */
export async function fetchPickupRequestsPage(
  options: FetchPickupRequestsPageOptions,
): Promise<FetchPickupRequestsPageResult> {
  if (supabaseConfigurationError) {
    return {
      success: false,
      requests: [],
      hasMore: false,
      error: supabaseConfigurationError,
    };
  }

  const normalizedSearch = normalizePickupSearch(options.search ?? '');
  const status = options.status ?? 'all';
  const safePage = Number.isFinite(options.page)
    ? Math.max(0, Math.trunc(options.page))
    : 0;
  const safePageSize = Number.isFinite(options.pageSize)
    ? Math.min(
        MAX_PICKUP_PAGE_SIZE,
        Math.max(1, Math.trunc(options.pageSize ?? 20)),
      )
    : 20;
  const from = safePage * safePageSize;
  const to = from + safePageSize;

  try {
    let listQuery = supabase
      .from('sales_rep_pickup_directory')
      .select(PICKUP_DIRECTORY_COLUMNS);

    if (status !== 'all') listQuery = listQuery.eq('status', status);
    if (normalizedSearch) {
      listQuery = listQuery.ilike('search_document', `%${normalizedSearch}%`);
    }

    const listPromise = listQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    let countPromise = null;
    if (options.includeTotalCount) {
      let countQuery = supabase
        .from('sales_rep_pickup_directory')
        .select('id', { count: 'exact', head: true });

      if (status !== 'all') countQuery = countQuery.eq('status', status);
      if (normalizedSearch) {
        countQuery = countQuery.ilike('search_document', `%${normalizedSearch}%`);
      }
      countPromise = countQuery;
    }

    const [listResult, countResult] = await Promise.all([
      listPromise,
      countPromise ?? Promise.resolve(null),
    ]);

    if (listResult.error) {
      logPickupDatabaseError('load pickup requests', listResult.error);
      return {
        success: false,
        requests: [],
        hasMore: false,
        error: 'Unable to load pickup requests. Please try again.',
      };
    }

    const rows = (listResult.data || []) as RawPickupDirectoryRow[];
    if (countResult?.error) {
      logPickupDatabaseError('count pickup requests', countResult.error);
    }
    return {
      success: true,
      requests: rows.slice(0, safePageSize).map(mapDirectoryRowToPickupRequest),
      hasMore: rows.length > safePageSize,
      totalCount:
        countResult && !countResult.error
          ? (countResult.count ?? 0)
          : undefined,
    };
  } catch {
    return {
      success: false,
      requests: [],
      hasMore: false,
      error: 'Unable to connect to service. Check network and try again.',
    };
  }
}

/** Fetches one pickup through the existing RLS policy; an inaccessible ID appears not found. */
export async function fetchPickupRequestById(
  pickupId: string,
): Promise<FetchPickupRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const normalizedId = pickupId.trim();
  if (!UUID_PATTERN.test(normalizedId)) return { success: true };

  try {
    const { data, error } = await supabase
      .from('pickup_requests')
      .select(PICKUP_COLUMNS)
      .eq('id', normalizedId)
      .maybeSingle();

    if (error) {
      logPickupDatabaseError('load pickup details', error);
      return {
        success: false,
        error: 'Unable to load pickup details. Please try again.',
      };
    }

    return {
      success: true,
      request: data
        ? mapRowToPickupRequest(data as RawPickupRequestRow)
        : undefined,
    };
  } catch {
    return {
      success: false,
      error: 'Unable to connect to service. Check network and try again.',
    };
  }
}

export async function createPickupRequest(
  input: CreatePickupRequestInput,
  clientRequestId: string,
): Promise<CreatePickupRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const validation = validatePickupRequestInput(input);
  if (!validation.success) return validation;
  if (!UUID_PATTERN.test(clientRequestId)) {
    return { success: false, error: 'Unable to submit pickup request. Please try again.' };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { value } = validation;
    const { data, error } = await supabase
      .from('pickup_requests')
      .insert({
        created_by: userData.user.id,
        client_request_id: clientRequestId,
        customer_id: value.customerId,
        pickup_address: value.pickupAddress,
        pickup_suburb: value.pickupSuburb,
        pickup_state: value.pickupState,
        pickup_postcode: value.pickupPostcode,
        requested_date: value.requestedDate,
        requested_time: value.requestedTime,
        material_type: value.materialType,
        material_description: value.materialDescription,
        estimated_weight: value.estimatedWeight,
        site_access_instructions: value.siteAccessInstructions,
        loading_requirements: value.loadingRequirements,
        delivery_yard_name: value.deliveryYardName,
        lead_source: value.leadSource,
        internal_notes: value.internalNotes,
        notes: value.notes,
        status: 'pending_review',
      })
      .select(PICKUP_COLUMNS)
      .single();

    if (error) {
      logPickupDatabaseError('submit pickup request', error);
      const confirmation = await findPickupByClientRequestId(clientRequestId);
      if (confirmation.success && confirmation.request) {
        requestPickupGeocoding(confirmation.request.id);
        return confirmation;
      }
      return { success: false, error: 'Unable to submit pickup request. Please try again.' };
    }

    const request = mapRowToPickupRequest(data as RawPickupRequestRow);
    requestPickupGeocoding(request.id);
    return { success: true, request };
  } catch {
    const confirmation = await findPickupByClientRequestId(clientRequestId);
    if (confirmation.success && confirmation.request) {
      requestPickupGeocoding(confirmation.request.id);
      return confirmation;
    }
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}

/** Confirms an earlier ambiguous insert using the caller's normal SELECT RLS. */
export async function findPickupByClientRequestId(
  clientRequestId: string,
): Promise<CreatePickupRequestResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }
  if (!UUID_PATTERN.test(clientRequestId)) {
    return { success: false, error: 'Unable to confirm pickup submission.' };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }
    const { data, error } = await supabase
      .from('pickup_requests')
      .select(PICKUP_COLUMNS)
      .eq('created_by', userData.user.id)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();

    if (error) {
      logPickupDatabaseError('confirm pickup submission', error);
      return { success: false, error: 'Unable to confirm pickup submission.' };
    }
    return {
      success: true,
      request: data ? mapRowToPickupRequest(data as RawPickupRequestRow) : undefined,
    };
  } catch {
    return { success: false, error: 'Unable to confirm pickup submission.' };
  }
}
