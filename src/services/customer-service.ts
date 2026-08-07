import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export interface Customer {
  id: string;
  createdBy: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
}

export interface FetchCustomersResult {
  success: boolean;
  customers: Customer[];
  error?: string;
}

export interface FetchCustomersPageResult {
  success: boolean;
  customers: Customer[];
  /** True when there are more pages after this one */
  hasMore: boolean;
  error?: string;
}

export interface CreateCustomerResult {
  success: boolean;
  customer?: Customer;
  error?: string;
}

interface RawCustomerRow {
  id: string;
  created_by: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToCustomer(row: RawCustomerRow): Customer {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchCustomers(): Promise<FetchCustomersResult> {
  if (supabaseConfigurationError) {
    return { success: false, customers: [], error: supabaseConfigurationError };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, created_by, name, phone, email, address, notes, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, customers: [], error: error.message || 'Failed to load customers.' };
    }

    const customers = (data || []).map((row: RawCustomerRow) => mapRowToCustomer(row));
    return { success: true, customers };
  } catch {
    return { success: false, customers: [], error: 'Unable to connect to service. Check network.' };
  }
}

/** Fetch a single page of customers with optional server-side search.
 *  Searches name, phone, and email using a case-insensitive prefix/substring match.
 *  page is 0-indexed. pageSize defaults to 30.
 */
export async function fetchCustomersPage(
  search: string,
  page: number,
  pageSize = 30,
): Promise<FetchCustomersPageResult> {
  if (supabaseConfigurationError) {
    return { success: false, customers: [], hasMore: false, error: supabaseConfigurationError };
  }

  const from = page * pageSize;
  const to   = from + pageSize - 1;
  const q    = search.trim();

  try {
    let query = supabase
      .from('customers')
      .select('id, created_by, name, phone, email, address, notes, created_at, updated_at')
      .order('name', { ascending: true })
      .range(from, to + 1); // fetch one extra to detect hasMore

    if (q) {
      // OR filter across name, phone, email
      query = query.or(
        `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, customers: [], hasMore: false, error: error.message || 'Failed to load customers.' };
    }

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    // Drop the extra sentinel row
    const customers = rows.slice(0, pageSize).map((row: RawCustomerRow) => mapRowToCustomer(row));
    return { success: true, customers, hasMore };
  } catch {
    return { success: false, customers: [], hasMore: false, error: 'Unable to connect to service. Check network.' };
  }
}

export async function createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
  if (supabaseConfigurationError) {
    return { success: false, error: supabaseConfigurationError };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const email = input.email?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!name) return { success: false, error: 'Customer name is required.' };
  if (!phone) return { success: false, error: 'Customer phone is required.' };
  if (!address) return { success: false, error: 'Customer address is required.' };

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        created_by: userData.user.id,
        name,
        phone,
        email,
        address,
        notes,
      })
      .select('id, created_by, name, phone, email, address, notes, created_at, updated_at')
      .single();

    if (error) {
      return { success: false, error: error.message || 'Failed to create customer.' };
    }

    return { success: true, customer: mapRowToCustomer(data as RawCustomerRow) };
  } catch {
    return { success: false, error: 'Unable to connect to service. Check network.' };
  }
}
