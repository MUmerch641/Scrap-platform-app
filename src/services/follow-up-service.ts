import { supabase, supabaseConfigurationError } from '@/services/supabase-client';

export type FollowUpStatus = 'pending' | 'completed' | 'rescheduled';
export type FollowUpView = 'today' | 'upcoming' | 'overdue' | 'completed';
export type SalesRepFollowUp = {
  id: string; customerId: string; customerName: string; dueAt: string; purpose: string; note: string | null;
  status: FollowUpStatus; completedAt: string | null; completionOutcome: string | null; rescheduledAt: string | null; createdAt: string;
};

type RawFollowUp = {
  id: string; customer_id: string; customer_name: string; due_at: string; purpose: string; note: string | null;
  status: FollowUpStatus; completed_at: string | null; completion_outcome: string | null; rescheduled_at: string | null; created_at: string;
};

const PAGE_SIZE = 30;
const map = (row: RawFollowUp): SalesRepFollowUp => ({
  id: row.id, customerId: row.customer_id, customerName: row.customer_name, dueAt: row.due_at, purpose: row.purpose, note: row.note,
  status: row.status, completedAt: row.completed_at, completionOutcome: row.completion_outcome, rescheduledAt: row.rescheduled_at, createdAt: row.created_at,
});
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export async function fetchMyFollowUps(view: FollowUpView, page = 0) {
  if (supabaseConfigurationError) return { success: false as const, items: [] as SalesRepFollowUp[], hasMore: false, error: supabaseConfigurationError };
  try {
    const { data, error } = await supabase.rpc('get_my_sales_rep_follow_ups', { p_view: view, p_limit: PAGE_SIZE + 1, p_offset: page * PAGE_SIZE, p_timezone: timezone() });
    if (error) return { success: false as const, items: [] as SalesRepFollowUp[], hasMore: false, error: 'Unable to load follow-ups. Please try again.' };
    const rows = (data ?? []) as RawFollowUp[];
    return { success: true as const, items: rows.slice(0, PAGE_SIZE).map(map), hasMore: rows.length > PAGE_SIZE };
  } catch { return { success: false as const, items: [] as SalesRepFollowUp[], hasMore: false, error: 'Unable to connect to service. Check network.' }; }
}

export async function createFollowUp(customerId: string, dueAt: string, purpose: string, note: string) {
  if (supabaseConfigurationError) return { success: false as const, error: supabaseConfigurationError };
  try {
    const { error } = await supabase.rpc('create_sales_rep_follow_up', { p_customer_id: customerId, p_due_at: dueAt, p_purpose: purpose.trim(), p_note: note.trim() || null });
    return error ? { success: false as const, error: 'Unable to create follow-up. Check the due time and try again.' } : { success: true as const };
  } catch { return { success: false as const, error: 'Unable to connect to service. Check network.' }; }
}

export async function completeFollowUp(id: string, outcome: string) {
  const { error } = await supabase.rpc('complete_my_sales_rep_follow_up', { p_follow_up_id: id, p_completion_outcome: outcome.trim() || null });
  return error ? { success: false as const, error: 'Unable to complete follow-up. Please try again.' } : { success: true as const };
}

export async function rescheduleFollowUp(id: string, dueAt: string) {
  const { error } = await supabase.rpc('reschedule_my_sales_rep_follow_up', { p_follow_up_id: id, p_due_at: dueAt });
  return error ? { success: false as const, error: 'Unable to reschedule follow-up. Check the due time and try again.' } : { success: true as const };
}
