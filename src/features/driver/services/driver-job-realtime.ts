import { supabase } from '@/services/supabase-client';

import { notifyDriverJobsChanged } from './driver-job-refresh';

const REALTIME_REFRESH_DEBOUNCE_MS = 350;

export interface DriverJobRealtimeSubscription {
  scheduleRefresh: () => void;
  unsubscribe: () => void;
}

/**
 * Database events are refresh signals only. Visible Driver data is always read
 * again through the authenticated Driver RPCs owned by the screen services.
 */
export function subscribeToDriverJobRealtime(): DriverJobRealtimeSubscription {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribed = false;
  let connectedOnce = false;

  const scheduleRefresh = () => {
    if (unsubscribed) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      notifyDriverJobsChanged();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  };

  const channel = supabase
    .channel('driver-job-refresh-v1')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_jobs' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_job_assignments' }, scheduleRefresh)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (connectedOnce) scheduleRefresh();
        connectedOnce = true;
      }
    });

  return {
    scheduleRefresh,
    unsubscribe: () => {
      unsubscribed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    },
  };
}
