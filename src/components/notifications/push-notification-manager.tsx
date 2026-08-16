import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React from 'react';

import { useUserRole } from '@/context/UserRoleContext';
import { registerAuthenticatedDeviceForPush, updateAuthenticatedDevicePushToken } from '@/services/push-notification-service';
import { ROLES } from '@/shared/roles';

type NotificationData = Record<string, unknown>;

const DRIVER_JOB_DETAIL_TYPES = new Set([
  'driver_job_assigned',
  'driver_pickup_rescheduled',
  'driver_yard_weight_confirmed',
]);

const SALES_REP_PICKUP_TYPES = new Set([
  'sales_rep_driver_assigned',
  'sales_rep_pickup_rescheduled',
  'sales_rep_delivered_to_yard',
  'sales_rep_yard_weight_confirmed',
]);

function asData(data: unknown): NotificationData | null {
  return data && typeof data === 'object' ? data as NotificationData : null;
}

function notificationType(data: NotificationData): string | null {
  const value = data.type ?? data.notificationType ?? data.notification_type;
  return typeof value === 'string' ? value : null;
}

function stringValue(data: NotificationData, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function openDriverNotification(notification: Notifications.Notification) {
  const data = asData(notification.request.content.data);
  if (!data) return;
  const route = stringValue(data, 'route');
  const type = notificationType(data);
  if (route === 'driver_available_jobs') { router.push('/(driver)/jobs'); return; }
  if (type === 'driver_job_unassigned') { router.push('/(driver)/jobs'); return; }
  if (!type || !DRIVER_JOB_DETAIL_TYPES.has(type)) return;

  const pickupJobId = stringValue(data, 'pickupJobId', 'pickup_job_id');
  if (!pickupJobId) { router.push('/(driver)/jobs'); return; }
  router.push({ pathname: '/(driver)/active-job', params: { pickupJobId, jobId: pickupJobId } });
}

function openSalesRepNotification(notification: Notifications.Notification) {
  const data = asData(notification.request.content.data);
  if (!data) return;
  if (stringValue(data, 'route') === 'sales_rep_follow_ups') { router.push('/(sales-rep)/follow-ups' as never); return; }
  const type = notificationType(data);
  if (!type || !SALES_REP_PICKUP_TYPES.has(type)) return;

  const pickupRequestId = stringValue(data, 'pickupRequestId', 'pickup_request_id');
  if (pickupRequestId) {
    router.push({ pathname: '/(sales-rep)/(home)/pickup/[id]', params: { id: pickupRequestId } } as never);
    return;
  }
  const customerId = stringValue(data, 'customerId', 'customer_id');
  if (customerId) {
    router.push({ pathname: '/(sales-rep)/customers/[id]', params: { id: customerId } } as never);
    return;
  }
  // A Sales Rep cannot securely derive a pickup request from a pickup-job ID alone.
  router.push('/(sales-rep)/(home)/pickups' as never);
}

export function PushNotificationManager() {
  const { user, role, isActive } = useUserRole();

  React.useEffect(() => {
    if (!user || !isActive || (role !== ROLES.DRIVER && role !== ROLES.SALES_REP)) return;
    void registerAuthenticatedDeviceForPush().catch(() => undefined);
  }, [isActive, role, user]);

  React.useEffect(() => {
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      if (token.type === 'expo') void updateAuthenticatedDevicePushToken(token.data);
    });
    return () => tokenSubscription.remove();
  }, []);

  React.useEffect(() => {
    if (role !== ROLES.DRIVER) return;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) openDriverNotification(response.notification);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => openDriverNotification(response.notification));
    return () => subscription.remove();
  }, [role]);

  React.useEffect(() => {
    if (role !== ROLES.SALES_REP) return;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) openSalesRepNotification(response.notification);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => openSalesRepNotification(response.notification));
    return () => subscription.remove();
  }, [role]);

  return null;
}
