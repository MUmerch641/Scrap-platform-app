import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { supabase, supabaseConfigurationError } from '@/services/supabase-client';
import { DriverExecutionStatus } from '../types';
import {
  areDriverLocationServicesEnabled,
  getDriverLocationPermission,
  promptEnableDriverLocationServices,
  requestDriverLocationPermission,
  watchVisibleDriverLocation,
} from './driver-location-service';

export type DriverLiveTrackingStatus =
  | 'idle'
  | 'tracking'
  | 'services-disabled'
  | 'permission-denied'
  | 'error';

export interface DriverLocationSnapshotParams {
  p_pickup_job_id: string;
  p_latitude: number;
  p_longitude: number;
  p_accuracy_m: number | null;
  p_heading_deg: number | null;
  p_speed_mps: number | null;
  p_recorded_at: string;
}

export interface DriverLocationBroadcastPayload {
  pickupJobId: string;
  pickup_job_id: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  accuracy_m: number | null;
  headingDeg: number | null;
  heading_deg: number | null;
  speedMps: number | null;
  speed_mps: number | null;
  recordedAt: string;
  recorded_at: string;
}

const TRACKABLE_STATUSES = new Set<DriverExecutionStatus>([
  'assigned',
  'en_route',
  'arrived',
  'material_collected',
]);

const BROADCAST_THROTTLE_MS = 10_000;
const SNAPSHOT_THROTTLE_MS = 60_000;

export function isTrackableDriverJobStatus(
  status: string | null | undefined,
): boolean {
  return Boolean(
    status &&
    TRACKABLE_STATUSES.has(status as DriverExecutionStatus),
  );
}

export async function upsertDriverLatestLocation(
  params: DriverLocationSnapshotParams,
): Promise<{ success: boolean; error?: string }> {
  if (supabaseConfigurationError) {
    return {
      success: false,
      error: supabaseConfigurationError,
    };
  }

  try {
    const { error } = await supabase.rpc(
      'upsert_my_driver_latest_location',
      params,
    );

    if (error) {
      console.warn('[driver-live-location] upsert snapshot failed', {
        message: error.message,
        code: error.code,
      });

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    console.warn(
      '[driver-live-location] upsert snapshot exception',
      err,
    );

    return {
      success: false,
      error: 'Network failure',
    };
  }
}

export async function clearDriverLatestLocation(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (supabaseConfigurationError) {
    return {
      success: false,
      error: supabaseConfigurationError,
    };
  }

  try {
    const { error } = await supabase.rpc(
      'clear_my_driver_latest_location',
    );

    if (error) {
      console.warn('[driver-live-location] clear location failed', {
        message: error.message,
        code: error.code,
      });

      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    console.warn(
      '[driver-live-location] clear location exception',
      err,
    );

    return {
      success: false,
      error: 'Network failure',
    };
  }
}

// -----------------------------------------------------------------------------
// Singleton Tracking Manager
// -----------------------------------------------------------------------------

type TrackingStatusListener = (
  status: DriverLiveTrackingStatus,
) => void;

class DriverLiveLocationManager {
  private activeJobId: string | null = null;
  private activeJobStatus: DriverExecutionStatus | null = null;

  private trackingStatus: DriverLiveTrackingStatus = 'idle';

  private statusListeners =
    new Set<TrackingStatusListener>();

  private isTrackingActive = false;
  private isChannelSubscribed = false;

  private locationWatcher:
    | Location.LocationSubscription
    | null = null;

  private activeChannel:
    | ReturnType<typeof supabase.channel>
    | null = null;

  private latestLocation:
    | Location.LocationObject
    | null = null;

  private lastBroadcastTime = 0;
  private lastSnapshotTime = 0;

  private broadcastTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  private snapshotTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  private snapshotInFlight = false;

  private appStateSubscription:
    | { remove: () => void }
    | null = null;

  private startSessionId = 0;

  private lifecyclePromise: Promise<void> =
    Promise.resolve();

  private enqueueLifecycle(
    taskName: string,
    task: () => Promise<void>,
  ) {
    this.lifecyclePromise =
      this.lifecyclePromise.then(async () => {
        console.log(
          `[DLL] lifecycle start: ${taskName} | session=${this.startSessionId}`,
        );

        try {
          await task();

          console.log(
            `[DLL] lifecycle done: ${taskName} | session=${this.startSessionId}`,
          );
        } catch (err) {
          console.warn(
            `[DLL] lifecycle error in ${taskName}`,
            err,
          );
        }
      });

    return this.lifecyclePromise;
  }

  private ensureAppStateListener() {
    if (this.appStateSubscription) {
      return;
    }

    console.log(
      '[DLL] registering AppState listener for driver session',
    );

    this.appStateSubscription =
      AppState.addEventListener(
        'change',
        (nextState: AppStateStatus) => {
          console.log(
            `[DLL] AppState → ${nextState} | job=${this.activeJobId ?? 'none'} | status=${this.activeJobStatus ?? 'none'} | session=${this.startSessionId}`,
          );

          if (nextState === 'active') {
            if (
              this.activeJobId &&
              this.activeJobStatus &&
              isTrackableDriverJobStatus(
                this.activeJobStatus,
              )
            ) {
              console.log(
                `[DLL] AppState active: queuing startTracking for job=${this.activeJobId}`,
              );

              void this.startTracking(
                this.activeJobId,
                this.activeJobStatus,
              );
            } else {
              console.log(
                `[DLL] AppState active: no eligible job to resume | job=${this.activeJobId ?? 'none'} | status=${this.activeJobStatus ?? 'none'}`,
              );
            }

            return;
          }

          if (
            nextState === 'background' ||
            nextState === 'inactive'
          ) {
            this.pauseTrackingOnBackground();
          }
        },
      );
  }

  private removeAppStateListener() {
    if (!this.appStateSubscription) {
      return;
    }

    console.log(
      '[DLL] removing AppState listener: driver session ended',
    );

    this.appStateSubscription.remove();
    this.appStateSubscription = null;
  }

  public getStatus(): DriverLiveTrackingStatus {
    return this.trackingStatus;
  }

  public subscribeStatus(
    listener: TrackingStatusListener,
  ): () => void {
    this.statusListeners.add(listener);

    listener(this.trackingStatus);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private updateStatus(
    newStatus: DriverLiveTrackingStatus,
  ) {
    if (this.trackingStatus === newStatus) {
      return;
    }

    this.trackingStatus = newStatus;

    for (const listener of this.statusListeners) {
      listener(newStatus);
    }
  }

  /**
   * Synchronises a CONFIRMED job state with the tracking manager.
   *
   * Important:
   * - null / undefined job data can happen temporarily while screens reload,
   *   navigation changes or React state is refreshing.
   * - transient missing data MUST NOT destroy the live tracking session.
   *
   * Explicit logout / confirmed unassignment should call:
   *
   * stopDriverLiveTracking({ clearDbLocation: true })
   */
  public async syncActiveJob(
    jobId: string | null,
    status: string | null | undefined,
  ): Promise<void> {
    /**
     * Temporary UI/loading state.
     *
     * Do NOT clear activeJobId.
     * Do NOT remove AppState listener.
     * Do NOT clear DB latest location.
     */
    if (!jobId || !status) {
      console.log(
        `[DLL] syncActiveJob transient missing data ignored | incomingJob=${jobId ?? 'none'} | incomingStatus=${status ?? 'none'} | preservedJob=${this.activeJobId ?? 'none'} | preservedStatus=${this.activeJobStatus ?? 'none'}`,
      );

      return;
    }

    /**
     * A concrete job + concrete terminal/non-trackable status
     * is authoritative enough to end tracking for that job.
     */
    if (!isTrackableDriverJobStatus(status)) {
      console.log(
        `[DLL] syncActiveJob confirmed non-trackable status | job=${jobId} | status=${status}`,
      );

      /**
       * Only clear our current tracking session if the status belongs
       * to the job currently being tracked.
       *
       * This prevents an old/stale screen response for another job
       * from killing the current session.
       */
      if (this.activeJobId === jobId) {
        await this.stopTracking({
          clearDbLocation: true,
        });
      } else {
        console.log(
          `[DLL] ignoring non-trackable status for non-active job | incomingJob=${jobId} | activeJob=${this.activeJobId ?? 'none'}`,
        );
      }

      return;
    }

    const executionStatus =
      status as DriverExecutionStatus;

    if (
      this.activeJobId === jobId &&
      this.activeJobStatus === executionStatus &&
      this.isTrackingActive
    ) {
      console.log(
        `[DLL] syncActiveJob already tracking | job=${jobId} | status=${executionStatus}`,
      );

      return;
    }

    console.log(
      `[DLL] syncActiveJob starting/resuming | job=${jobId} | status=${executionStatus}`,
    );

    await this.startTracking(
      jobId,
      executionStatus,
    );
  }

  public async startTracking(
    jobId: string,
    status: DriverExecutionStatus,
  ): Promise<void> {
    this.ensureAppStateListener();

    const sessionId =
      ++this.startSessionId;

    return new Promise((resolve) => {
      void this.enqueueLifecycle(
        'startTracking',
        async () => {
          if (
            sessionId !== this.startSessionId
          ) {
            console.log(
              `[DLL] startTracking aborted: stale session | requested=${sessionId} current=${this.startSessionId}`,
            );

            resolve();
            return;
          }

          if (
            !isTrackableDriverJobStatus(status)
          ) {
            console.log(
              `[DLL] startTracking rejected non-trackable status | job=${jobId} | status=${status}`,
            );

            await this.stopTrackingInternal({
              clearDbLocation: true,
            });

            resolve();
            return;
          }

          /**
           * Preserve this state through background pauses.
           */
          this.activeJobId = jobId;
          this.activeJobStatus = status;

          /**
           * If start was requested while app is not active,
           * preserve session metadata and wait for AppState active.
           */
          if (
            AppState.currentState !== 'active'
          ) {
            console.log(
              `[DLL] startTracking deferred: app not active | appState=${AppState.currentState} | job=${jobId}`,
            );

            resolve();
            return;
          }

          /**
           * Serialised cleanup ensures an old realtime channel has
           * completely left before a replacement channel is created.
           */
          await this.stopWatcherAndChannelAsync();

          if (
            sessionId !== this.startSessionId
          ) {
            console.log(
              `[DLL] startTracking aborted after cleanup: stale session | requested=${sessionId} current=${this.startSessionId}`,
            );

            resolve();
            return;
          }

          // 1. Verify location services
          try {
            let servicesEnabled =
              await areDriverLocationServicesEnabled();

            if (
              sessionId !==
              this.startSessionId
            ) {
              resolve();
              return;
            }

            if (!servicesEnabled) {
              this.updateStatus(
                'services-disabled',
              );
              
              await this.stopTrackingInternal({ clearDbLocation: true });

              resolve();
              return;
            }
          } catch (err) {
            if (
              sessionId !==
              this.startSessionId
            ) {
              resolve();
              return;
            }

            console.warn(
              '[DLL] location services check failed',
              err,
            );

            this.updateStatus('error');

            resolve();
            return;
          }

          // 2. Verify foreground location permission
          try {
            let permission =
              await getDriverLocationPermission();

            if (
              sessionId !==
              this.startSessionId
            ) {
              resolve();
              return;
            }

            if (!permission.granted) {
              this.updateStatus(
                'permission-denied',
              );
              
              await this.stopTrackingInternal({ clearDbLocation: true });

              resolve();
              return;
            }
          } catch (err) {
            if (
              sessionId !==
              this.startSessionId
            ) {
              resolve();
              return;
            }

            console.warn(
              '[DLL] location permission check failed',
              err,
            );

            this.updateStatus('error');

            resolve();
            return;
          }

          // 3. Create private realtime channel
          const channelName =
            `driver-location:${jobId}`;

          console.log(
            `[DLL] creating channel: ${channelName} | session=${sessionId}`,
          );

          try {
            this.activeChannel =
              supabase.channel(
                channelName,
                {
                  config: {
                    broadcast: {
                      self: false,
                    },
                  },
                },
              );

            const currentChannel =
              this.activeChannel;

            this.activeChannel.subscribe(
              (channelStatus, err) => {
                /**
                 * Ignore callbacks belonging to old channels.
                 */
                if (
                  this.activeChannel !==
                  currentChannel
                ) {
                  console.log(
                    `[DLL] ignoring stale channel status: ${channelStatus}`,
                  );

                  return;
                }

                console.log(
                  `[DLL] channel status: ${channelStatus}`,
                  err ?? '',
                );

                if (
                  channelStatus ===
                  'SUBSCRIBED'
                ) {
                  this.isChannelSubscribed =
                    true;

                  if (
                    this.latestLocation &&
                    this.isTrackingActive &&
                    this.activeJobId
                  ) {
                    console.log(
                      '[DLL] SUBSCRIBED: flushing pending location',
                    );

                    this.sendBroadcast(
                      this.latestLocation,
                    );
                  } else {
                    console.log(
                      '[DLL] SUBSCRIBED: no pending location to flush',
                    );
                  }

                  return;
                }

                this.isChannelSubscribed =
                  false;
              },
            );
          } catch (err) {
            console.warn(
              '[DLL] channel subscribe error',
              err,
            );
          }

          this.isTrackingActive = true;
          this.updateStatus('tracking');

          // 4. Immediate fresh last-known reading
          try {
            const lastKnown =
              await Location.getLastKnownPositionAsync(
                {
                  maxAge: 60_000,
                },
              );

            if (
              sessionId ===
              this.startSessionId &&
              this.isTrackingActive &&
              lastKnown &&
              AppState.currentState ===
              'active'
            ) {
              this.handleLocationReading(
                lastKnown,
              );
            }
          } catch (err) {
            console.warn(
              '[DLL] last known position unavailable',
              err,
            );
          }

          if (
            sessionId !==
            this.startSessionId
          ) {
            resolve();
            return;
          }

          // 5. Start foreground watcher
          try {
            this.locationWatcher =
              await watchVisibleDriverLocation(
                (location) => {
                  if (
                    sessionId ===
                    this.startSessionId &&
                    this.isTrackingActive &&
                    AppState.currentState ===
                    'active'
                  ) {
                    this.handleLocationReading(
                      location,
                    );
                  }
                },
              );

            console.log(
              `[DLL] location watcher started | job=${jobId} | session=${sessionId}`,
            );
          } catch (err) {
            if (
              sessionId ===
              this.startSessionId
            ) {
              console.warn(
                '[DLL] watchVisibleDriverLocation failed',
                err,
              );

              this.updateStatus('error');
            }
          }

          resolve();
        },
      );
    });
  }

  private handleLocationReading(
    loc: Location.LocationObject,
  ) {
    if (
      !this.isTrackingActive ||
      !this.activeJobId ||
      AppState.currentState !== 'active'
    ) {
      return;
    }

    /**
     * Retain one latest point only.
     * Never queue historical points.
     */
    this.latestLocation = loc;

    const now = Date.now();

    // -------------------------------------------------------------------------
    // Realtime broadcast: maximum once every 10 seconds
    // -------------------------------------------------------------------------

    const timeSinceBroadcast =
      now - this.lastBroadcastTime;

    if (
      timeSinceBroadcast >=
      BROADCAST_THROTTLE_MS
    ) {
      if (this.broadcastTimer) {
        clearTimeout(
          this.broadcastTimer,
        );

        this.broadcastTimer = null;
      }

      this.sendBroadcast(loc);
    } else if (!this.broadcastTimer) {
      const delay =
        BROADCAST_THROTTLE_MS -
        timeSinceBroadcast;

      this.broadcastTimer =
        setTimeout(() => {
          this.broadcastTimer = null;

          if (
            this.latestLocation &&
            this.isTrackingActive &&
            this.activeJobId &&
            AppState.currentState ===
            'active'
          ) {
            this.sendBroadcast(
              this.latestLocation,
            );
          }
        }, delay);
    }

    // -------------------------------------------------------------------------
    // DB latest snapshot: maximum once every 60 seconds
    // -------------------------------------------------------------------------

    const timeSinceSnapshot =
      now - this.lastSnapshotTime;

    if (
      timeSinceSnapshot >=
      SNAPSHOT_THROTTLE_MS
    ) {
      if (this.snapshotTimer) {
        clearTimeout(
          this.snapshotTimer,
        );

        this.snapshotTimer = null;
      }

      void this.sendSnapshot(loc);
    } else if (!this.snapshotTimer) {
      const delay =
        SNAPSHOT_THROTTLE_MS -
        timeSinceSnapshot;

      this.snapshotTimer =
        setTimeout(() => {
          this.snapshotTimer = null;

          if (
            this.latestLocation &&
            this.isTrackingActive &&
            this.activeJobId &&
            AppState.currentState ===
            'active'
          ) {
            void this.sendSnapshot(
              this.latestLocation,
            );
          }
        }, delay);
    }
  }

  private sendBroadcast(
    loc: Location.LocationObject,
  ) {
    if (
      !this.activeChannel ||
      !this.activeJobId ||
      !this.isTrackingActive ||
      AppState.currentState !== 'active'
    ) {
      return;
    }

    if (!this.isChannelSubscribed) {
      console.log(
        '[DLL] broadcast skipped: channel not yet SUBSCRIBED',
      );

      return;
    }

    this.lastBroadcastTime =
      Date.now();

    const {
      latitude,
      longitude,
      accuracyM,
      headingDeg,
      speedMps,
      recordedAt,
    } =
      this.extractLocationFields(loc);

    const payload: DriverLocationBroadcastPayload =
    {
      pickupJobId:
        this.activeJobId,
      pickup_job_id:
        this.activeJobId,

      latitude,
      longitude,

      accuracyM,
      accuracy_m: accuracyM,

      headingDeg,
      heading_deg: headingDeg,

      speedMps,
      speed_mps: speedMps,

      recordedAt,
      recorded_at: recordedAt,
    };

    console.log(
      `[DLL] broadcast send | job=${this.activeJobId} | lat=${latitude.toFixed(5)} lon=${longitude.toFixed(5)} at=${recordedAt}`,
    );

    this.activeChannel
      .send({
        type: 'broadcast',
        event: 'location',
        payload,
      })
      .then((result) => {
        console.log(
          '[DLL] broadcast result:',
          result,
        );
      })
      .catch((err) => {
        console.warn(
          '[DLL] broadcast error:',
          err,
        );
      });
  }

  private async sendSnapshot(
    loc: Location.LocationObject,
  ): Promise<void> {
    if (
      this.snapshotInFlight ||
      !this.activeJobId ||
      !this.isTrackingActive ||
      AppState.currentState !== 'active'
    ) {
      return;
    }

    /**
     * Capture job ID before async RPC.
     * Prevents later state changes from changing this request identity.
     */
    const jobId =
      this.activeJobId;

    this.snapshotInFlight = true;

    this.lastSnapshotTime =
      Date.now();

    const {
      latitude,
      longitude,
      accuracyM,
      headingDeg,
      speedMps,
      recordedAt,
    } =
      this.extractLocationFields(loc);

    const params: DriverLocationSnapshotParams =
    {
      p_pickup_job_id: jobId,
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy_m: accuracyM,
      p_heading_deg: headingDeg,
      p_speed_mps: speedMps,
      p_recorded_at: recordedAt,
    };

    console.log(
      `[DLL] snapshot send | job=${jobId} | lat=${latitude.toFixed(5)} lon=${longitude.toFixed(5)} at=${recordedAt}`,
    );

    try {
      const result =
        await upsertDriverLatestLocation(
          params,
        );

      console.log(
        '[DLL] snapshot result:',
        result.success
          ? 'ok'
          : result.error,
      );
    } finally {
      this.snapshotInFlight = false;
    }
  }

  private extractLocationFields(
    loc: Location.LocationObject,
  ) {
    const coords = loc.coords;

    const latitude =
      Number.isFinite(coords.latitude)
        ? coords.latitude
        : 0;

    const longitude =
      Number.isFinite(coords.longitude)
        ? coords.longitude
        : 0;

    const accuracyM =
      typeof coords.accuracy ===
        'number' &&
        Number.isFinite(
          coords.accuracy,
        ) &&
        coords.accuracy >= 0
        ? Math.round(
          coords.accuracy * 10,
        ) / 10
        : null;

    const headingDeg =
      typeof coords.heading ===
        'number' &&
        Number.isFinite(
          coords.heading,
        ) &&
        coords.heading >= 0 &&
        coords.heading <= 360
        ? Math.round(
          coords.heading * 10,
        ) / 10
        : null;

    const speedMps =
      typeof coords.speed ===
        'number' &&
        Number.isFinite(
          coords.speed,
        ) &&
        coords.speed >= 0
        ? Math.round(
          coords.speed * 10,
        ) / 10
        : null;

    const recordedAt =
      new Date(
        loc.timestamp ||
        Date.now(),
      ).toISOString();

    return {
      latitude,
      longitude,
      accuracyM,
      headingDeg,
      speedMps,
      recordedAt,
    };
  }

  /**
   * Stops foreground resources only.
   *
   * IMPORTANT:
   * - activeJobId preserved
   * - activeJobStatus preserved
   * - AppState listener preserved
   * - DB latest location preserved
   *
   * Used for background pause and safe restart.
   */
  private async stopWatcherAndChannelAsync() {
    this.isTrackingActive = false;
    this.isChannelSubscribed = false;

    if (this.locationWatcher) {
      console.log(
        '[DLL] removing location watcher',
      );

      this.locationWatcher.remove();
      this.locationWatcher = null;

      console.log(
        '[DLL] location watcher removed',
      );
    }

    if (this.broadcastTimer) {
      clearTimeout(
        this.broadcastTimer,
      );

      this.broadcastTimer = null;

      console.log(
        '[DLL] broadcast timer cleared',
      );
    }

    if (this.snapshotTimer) {
      clearTimeout(
        this.snapshotTimer,
      );

      this.snapshotTimer = null;

      console.log(
        '[DLL] snapshot timer cleared',
      );
    }

    if (this.activeChannel) {
      const channelToClose =
        this.activeChannel;

      this.activeChannel = null;

      console.log(
        `[DLL] removing channel: ${channelToClose.topic}`,
      );

      await supabase.removeChannel(
        channelToClose,
      );

      console.log(
        `[DLL] channel removed: ${channelToClose.topic}`,
      );
    }
  }

  /**
   * Background/inactive pause.
   *
   * Never destroys active job session.
   */
  private pauseTrackingOnBackground() {
    this.startSessionId += 1;

    const pauseSession =
      this.startSessionId;

    console.log(
      `[DLL] pauseTrackingOnBackground | new session=${pauseSession} | preservedJob=${this.activeJobId ?? 'none'}`,
    );

    void this.enqueueLifecycle(
      'pauseTrackingOnBackground',
      async () => {
        await this.stopWatcherAndChannelAsync();

        /**
         * Job metadata intentionally stays preserved
         * so foreground AppState can restart tracking.
         */
        this.updateStatus('idle');
      },
    );
  }

  private async stopTrackingInternal(
    options: {
      clearDbLocation: boolean;
    },
  ) {
    await this.stopWatcherAndChannelAsync();

    /**
     * Full session clear.
     *
     * Only explicit terminal/unassignment/logout paths
     * should use clearDbLocation=true.
     */
    if (options.clearDbLocation) {
      const previousJobId =
        this.activeJobId;

      console.log(
        `[DLL] clearing driver tracking session | previousJob=${previousJobId ?? 'none'}`,
      );

      this.latestLocation = null;

      this.activeJobId = null;
      this.activeJobStatus = null;

      this.lastBroadcastTime = 0;
      this.lastSnapshotTime = 0;

      this.removeAppStateListener();

      const clearResult =
        await clearDriverLatestLocation();

      console.log(
        '[DLL] clear DB location result:',
        clearResult.success
          ? 'ok'
          : clearResult.error,
      );
    }

    this.updateStatus('idle');
  }

  public async stopTracking(
    options: {
      clearDbLocation: boolean;
    } = {
        clearDbLocation: false,
      },
  ): Promise<void> {
    this.startSessionId += 1;

    const stopSession =
      this.startSessionId;

    console.log(
      `[DLL] stopTracking requested | clearDbLocation=${options.clearDbLocation} | session=${stopSession}`,
    );

    return new Promise((resolve) => {
      void this.enqueueLifecycle(
        'stopTracking',
        async () => {
          await this.stopTrackingInternal(
            options,
          );

          resolve();
        },
      );
    });
  }

  /**
   * Called when device networking reconnects.
   *
   * Only latest point is retried.
   * Historical points are never queued/replayed.
   */
  public onNetworkReconnect() {
    console.log(
      `[DLL] network reconnect | tracking=${this.isTrackingActive} | job=${this.activeJobId ?? 'none'} | appState=${AppState.currentState}`,
    );

    if (
      this.isTrackingActive &&
      this.activeJobId &&
      this.latestLocation &&
      AppState.currentState === 'active'
    ) {
      this.sendBroadcast(
        this.latestLocation,
      );

      void this.sendSnapshot(
        this.latestLocation,
      );
    }
  }
}

export const driverLiveLocationManager =
  new DriverLiveLocationManager();

export function syncDriverLiveTracking(
  jobId: string | null,
  status: string | null | undefined,
): Promise<void> {
  return driverLiveLocationManager.syncActiveJob(
    jobId,
    status,
  );
}

/**
 * Use clearDbLocation=true ONLY for confirmed:
 * - logout
 * - unassignment
 * - terminal/delivered job
 * - driver session termination
 */
export function stopDriverLiveTracking(
  options?: {
    clearDbLocation: boolean;
  },
): Promise<void> {
  return driverLiveLocationManager.stopTracking(
    options,
  );
}

export function getDriverLiveTrackingStatus(): DriverLiveTrackingStatus {
  return driverLiveLocationManager.getStatus();
}

export function subscribeToDriverLiveTrackingStatus(
  listener: (
    status: DriverLiveTrackingStatus,
  ) => void,
): () => void {
  return driverLiveLocationManager.subscribeStatus(
    listener,
  );
}

export function notifyDriverLiveLocationNetworkReconnect(): void {
  driverLiveLocationManager.onNetworkReconnect();
}

export function useDriverLiveTrackingStatus(): DriverLiveTrackingStatus {
  const [
    status,
    setStatus,
  ] = useState<DriverLiveTrackingStatus>(
    getDriverLiveTrackingStatus(),
  );

  useEffect(() => {
    return subscribeToDriverLiveTrackingStatus(
      (newStatus) => {
        setStatus(newStatus);
      },
    );
  }, []);

  return status;
}