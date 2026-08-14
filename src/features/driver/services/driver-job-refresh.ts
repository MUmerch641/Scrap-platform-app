type DriverJobRefreshListener = () => void | Promise<void>;

const listeners = new Set<DriverJobRefreshListener>();
let refreshInProgress = false;
let refreshQueued = false;

/**
 * Coalesces refreshes across Driver read screens. An event received while the
 * current secure read is running results in one follow-up pass, not a storm.
 */
export function notifyDriverJobsChanged(): void {
  if (refreshInProgress) {
    refreshQueued = true;
    return;
  }

  refreshInProgress = true;
  void (async () => {
    do {
      refreshQueued = false;
      await Promise.allSettled([...listeners].map((listener) => listener()));
    } while (refreshQueued);

    refreshInProgress = false;
  })();
}

export function subscribeToDriverJobsChanged(listener: DriverJobRefreshListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
