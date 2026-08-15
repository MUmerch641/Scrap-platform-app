import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export const CUSTOMER_FIELD_LIMITS = {
  name: 120,
  contactPerson: 120,
  phone: 32,
  email: 254,
  address: 300,
  billingAddress: 300,
  abn: 32,
  notes: 1000,
} as const;

export const CUSTOMER_TYPE_OPTIONS = ['business', 'residential', 'other'] as const;
export const PREFERRED_CONTACT_METHOD_OPTIONS = ['phone', 'sms', 'email'] as const;
export const CUSTOMER_STATUS_OPTIONS = [
  'new_lead',
  'contacted',
  'interested',
  'active_customer',
  'follow_up_required',
  'inactive',
  'not_interested',
  'do_not_contact',
] as const;

export type CustomerType = (typeof CUSTOMER_TYPE_OPTIONS)[number];
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHOD_OPTIONS)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUS_OPTIONS)[number];

const MAX_CUSTOMER_PAGE_SIZE = 100;
const MEANINGFUL_TEXT_PATTERN = /[\p{L}\p{N}]/u;
const PHONE_PATTERN = /^\+?[0-9()\-\s]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logCustomerDatabaseError(operation: string, error: { code?: string } | null): void {
  if (__DEV__) {
    console.warn(`[customer-service] ${operation} failed`, {
      code: error?.code ?? 'unknown',
    });
  }
}

export interface Customer {
  id: string;
  createdBy: string;
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string;
  customerType: CustomerType;
  billingAddress: string | null;
  abn: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  customerStatus: CustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  contactPerson?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  customerType?: CustomerType;
  billingAddress?: string | null;
  abn?: string | null;
  preferredContactMethod?: PreferredContactMethod | null;
  customerStatus?: CustomerStatus;
  notes?: string | null;
}

interface NormalizedCustomerInput {
  name: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  address: string;
  customerType: CustomerType;
  billingAddress: string | null;
  abn: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  customerStatus: CustomerStatus;
  notes: string | null;
}

interface CustomerWritePayload {
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  address: string;
  customer_type: CustomerType;
  billing_address: string | null;
  abn: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  customer_status: CustomerStatus;
  notes: string | null;
}

export type CustomerValidationResult =
  | { success: true; value: NormalizedCustomerInput }
  | { success: false; error: string };

export interface FetchCustomersPageResult {
  success: boolean;
  customers: Customer[];
  hasMore: boolean;
  totalCount?: number;
  error?: string;
}

export interface FindLikelyCustomerResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

export interface FetchCustomerResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

export interface FindCustomerByClientRequestIdResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

export interface CreateCustomerResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

export interface UpdateCustomerResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

interface RawCustomerRow {
  id: string;
  created_by: string;
  name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  address: string;
  customer_type: CustomerType;
  billing_address: string | null;
  abn: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  customer_status: CustomerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_COLUMNS =
  'id, created_by, name, contact_person, phone, email, address, customer_type, billing_address, abn, preferred_contact_method, customer_status, notes, created_at, updated_at';

function mapRowToCustomer(row: RawCustomerRow): Customer {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    customerType: row.customer_type,
    billingAddress: row.billing_address,
    abn: row.abn,
    preferredContactMethod: row.preferred_contact_method,
    customerStatus: row.customer_status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCustomerWritePayload(input: NormalizedCustomerInput): CustomerWritePayload {
  return {
    name: input.name,
    contact_person: input.contactPerson,
    phone: input.phone,
    email: input.email,
    address: input.address,
    customer_type: input.customerType,
    billing_address: input.billingAddress,
    abn: input.abn,
    preferred_contact_method: input.preferredContactMethod,
    customer_status: input.customerStatus,
    notes: input.notes,
  };
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCustomerPhone(value: string): string {
  return normalizeWhitespace(value);
}

export function validateCustomerInput(
  input: CreateCustomerInput,
): CustomerValidationResult {
  const name = normalizeWhitespace(input.name);
  const contactPerson = normalizeWhitespace(input.contactPerson ?? '') || null;
  const phone = normalizeCustomerPhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const address = normalizeWhitespace(input.address);
  const billingAddress = normalizeWhitespace(input.billingAddress ?? '') || null;
  const abn = normalizeWhitespace(input.abn ?? '') || null;
  const customerType = input.customerType ?? 'business';
  const preferredContactMethod = input.preferredContactMethod ?? null;
  const customerStatus = input.customerStatus ?? 'new_lead';
  const notes = input.notes?.trim() || null;

  if (!name) return { success: false, error: 'Customer name is required.' };
  if (!MEANINGFUL_TEXT_PATTERN.test(name)) {
    return { success: false, error: 'Customer name must contain a letter or number.' };
  }
  if (name.length > CUSTOMER_FIELD_LIMITS.name) {
    return {
      success: false,
      error: `Customer name must be ${CUSTOMER_FIELD_LIMITS.name} characters or fewer.`,
    };
  }
  if (contactPerson && contactPerson.length > CUSTOMER_FIELD_LIMITS.contactPerson) {
    return { success: false, error: `Contact person must be ${CUSTOMER_FIELD_LIMITS.contactPerson} characters or fewer.` };
  }

  if (!phone) return { success: false, error: 'Customer phone is required.' };
  if (phone.length > CUSTOMER_FIELD_LIMITS.phone) {
    return {
      success: false,
      error: `Phone number must be ${CUSTOMER_FIELD_LIMITS.phone} characters or fewer.`,
    };
  }
  if (!PHONE_PATTERN.test(phone)) {
    return {
      success: false,
      error: 'Enter a valid phone number using digits, spaces, brackets, hyphens, or a leading +.',
    };
  }
  const phoneDigitCount = phone.replace(/\D/g, '').length;
  if (phoneDigitCount < 8 || phoneDigitCount > 15) {
    return { success: false, error: 'Enter a phone number containing 8 to 15 digits.' };
  }

  if (email) {
    if (email.length > CUSTOMER_FIELD_LIMITS.email) {
      return {
        success: false,
        error: `Email address must be ${CUSTOMER_FIELD_LIMITS.email} characters or fewer.`,
      };
    }
    if (!EMAIL_PATTERN.test(email)) {
      return { success: false, error: 'Enter a valid email address.' };
    }
  }

  if (!address) return { success: false, error: 'Customer address is required.' };
  if (!MEANINGFUL_TEXT_PATTERN.test(address)) {
    return { success: false, error: 'Customer address must contain a letter or number.' };
  }
  if (address.length > CUSTOMER_FIELD_LIMITS.address) {
    return {
      success: false,
      error: `Customer address must be ${CUSTOMER_FIELD_LIMITS.address} characters or fewer.`,
    };
  }

  if (billingAddress && billingAddress.length > CUSTOMER_FIELD_LIMITS.billingAddress) {
    return { success: false, error: `Billing address must be ${CUSTOMER_FIELD_LIMITS.billingAddress} characters or fewer.` };
  }
  if (abn) {
    if (abn.length > CUSTOMER_FIELD_LIMITS.abn) {
      return { success: false, error: `ABN must be ${CUSTOMER_FIELD_LIMITS.abn} characters or fewer.` };
    }
    if (!/^\d{11}$/.test(abn.replace(/\s/g, ''))) {
      return { success: false, error: 'ABN must contain 11 digits when supplied.' };
    }
  }
  if (!CUSTOMER_TYPE_OPTIONS.includes(customerType)) {
    return { success: false, error: 'Select a valid customer type.' };
  }
  if (preferredContactMethod && !PREFERRED_CONTACT_METHOD_OPTIONS.includes(preferredContactMethod)) {
    return { success: false, error: 'Select a valid preferred contact method.' };
  }
  if (!CUSTOMER_STATUS_OPTIONS.includes(customerStatus)) {
    return { success: false, error: 'Select a valid customer status.' };
  }

  if (notes && notes.length > CUSTOMER_FIELD_LIMITS.notes) {
    return {
      success: false,
      error: `Customer notes must be ${CUSTOMER_FIELD_LIMITS.notes} characters or fewer.`,
    };
  }

  return {
    success: true,
    value: { name, contactPerson, phone, email, address, customerType, billingAddress, abn, preferredContactMethod, customerStatus, notes },
  };
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Fetch one bounded page with optional server-side name, contact, phone, and email search. */
export async function fetchCustomersPage(
  search: string,
  page: number,
  pageSize = 30,
  includeTotalCount = false,
): Promise<FetchCustomersPageResult> {
  if (supabaseConfigurationError) {
    return { success: false, customers: [], hasMore: false, error: supabaseConfigurationError };
  }

  const normalizedSearch = search.trim();
  const safePage = Number.isFinite(page) ? Math.max(0, Math.trunc(page)) : 0;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(MAX_CUSTOMER_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)))
    : 30;
  const from = safePage * safePageSize;
  const to = from + safePageSize;

  try {
    const customerQuery = supabase.from('customers');
    let query = includeTotalCount
      ? customerQuery.select(CUSTOMER_COLUMNS, { count: 'exact' })
      : customerQuery.select(CUSTOMER_COLUMNS);

    query = query
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (normalizedSearch) {
      const pattern = quotePostgrestValue(`%${normalizedSearch}%`);
      query = query.or(
        `name.ilike.${pattern},contact_person.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      logCustomerDatabaseError('load customers', error);
      return {
        success: false,
        customers: [],
        hasMore: false,
        error: 'Unable to load customers. Please try again.',
      };
    }

    const rows = (data || []) as RawCustomerRow[];
    return {
      success: true,
      customers: rows.slice(0, safePageSize).map(mapRowToCustomer),
      hasMore: rows.length > safePageSize,
      totalCount: includeTotalCount ? (count ?? 0) : undefined,
    };
  } catch {
    return {
      success: false,
      customers: [],
      hasMore: false,
      error: 'Unable to connect to service. Check network.',
    };
  }
}

/** Fetches one customer through existing owner-scoped RLS. */
export async function fetchCustomerById(customerId: string): Promise<FetchCustomerResult> {
  if (supabaseConfigurationError) return { success: false, error: supabaseConfigurationError };
  if (!UUID_PATTERN.test(customerId.trim())) return { success: true };

  try {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('id', customerId.trim())
      .maybeSingle();
    if (error) {
      logCustomerDatabaseError('load customer', error);
      return { success: false, error: 'Unable to load customer. Please try again.' };
    }
    return { success: true, customer: data ? mapRowToCustomer(data as RawCustomerRow) : undefined };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}

/**
 * Finds one accessible possible match for a non-blocking duplicate suggestion.
 * Phone and email use exact normalized values; a business name match is only a
 * prompt to inspect the record, never a uniqueness rule.
 */
export async function findLikelyExistingCustomer(
  input: Pick<CreateCustomerInput, 'name' | 'phone' | 'email'>,
  excludeCustomerId?: string,
): Promise<FindLikelyCustomerResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const normalizedPhone = normalizeCustomerPhone(input.phone);
  const normalizedEmail = input.email?.trim().toLowerCase() ?? '';
  const normalizedName = normalizeWhitespace(input.name);
  const filters = [
    normalizedPhone ? `phone.eq.${quotePostgrestValue(normalizedPhone)}` : null,
    normalizedEmail ? `email.eq.${quotePostgrestValue(normalizedEmail)}` : null,
    normalizedName ? `name.ilike.${quotePostgrestValue(normalizedName)}` : null,
  ].filter((value): value is string => Boolean(value));
  if (!filters.length) return { success: true };

  try {
    let query = supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .or(filters.join(','))
      .order('created_at', { ascending: true })
      .limit(1);

    if (excludeCustomerId?.trim()) {
      query = query.neq('id', excludeCustomerId.trim());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logCustomerDatabaseError('check customer details', error);
      return { success: false, error: 'Unable to check customer details. Please try again.' };
    }

    return {
      success: true,
      customer: data ? mapRowToCustomer(data as RawCustomerRow) : undefined,
    };
  } catch {
    return { success: false, error: 'Unable to check existing customers.' };
  }
}

/** Confirms an earlier ambiguous create using the caller's normal SELECT RLS. */
export async function findCustomerByClientRequestId(
  clientRequestId: string,
): Promise<FindCustomerByClientRequestIdResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }
  if (!UUID_PATTERN.test(clientRequestId)) {
    return { success: false, error: 'Unable to confirm customer submission.' };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('created_by', userData.user.id)
      .eq('client_request_id', clientRequestId)
      .maybeSingle();

    if (error) {
      logCustomerDatabaseError('confirm customer submission', error);
      return { success: false, error: 'Unable to confirm customer submission.' };
    }
    return {
      success: true,
      customer: data ? mapRowToCustomer(data as RawCustomerRow) : undefined,
    };
  } catch {
    return { success: false, error: 'Unable to confirm customer submission.' };
  }
}

export async function createCustomer(
  input: CreateCustomerInput,
  clientRequestId: string,
): Promise<CreateCustomerResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const validation = validateCustomerInput(input);
  if (!validation.success) return validation;
  if (!UUID_PATTERN.test(clientRequestId)) {
    return { success: false, error: 'Unable to save customer. Please try again.' };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        created_by: userData.user.id,
        client_request_id: clientRequestId,
        ...toCustomerWritePayload(validation.value),
      })
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error) {
      logCustomerDatabaseError('save customer', error);
      const confirmation = await findCustomerByClientRequestId(clientRequestId);
      if (confirmation.success && confirmation.customer) {
        return { success: true, customer: confirmation.customer };
      }
      return { success: false, error: 'Unable to save customer. Please try again.' };
    }

    return { success: true, customer: mapRowToCustomer(data as RawCustomerRow) };
  } catch {
    const confirmation = await findCustomerByClientRequestId(clientRequestId);
    if (confirmation.success && confirmation.customer) {
      return { success: true, customer: confirmation.customer };
    }
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}

export async function updateCustomer(
  customerId: string,
  input: CreateCustomerInput,
): Promise<UpdateCustomerResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    return { success: false, error: 'Customer is required.' };
  }

  const validation = validateCustomerInput(input);
  if (!validation.success) return validation;

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { data, error } = await supabase
      .from('customers')
      .update(toCustomerWritePayload(validation.value))
      .eq('id', normalizedCustomerId)
      .eq('created_by', userData.user.id)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error) {
      logCustomerDatabaseError('update customer', error);
      return { success: false, error: 'Unable to update customer. Please try again.' };
    }

    return { success: true, customer: mapRowToCustomer(data as RawCustomerRow) };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}
