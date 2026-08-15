import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React from 'react';

import { useUserRole } from '@/context/UserRoleContext';
import { registerAuthenticatedDeviceForPush, updateAuthenticatedDevicePushToken } from '@/services/push-notification-service';
import { ROLES } from '@/shared/roles';

function isAvailableJobsNotification(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && (data as { route?: unknown }).route === 'driver_available_jobs');
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
    const openAvailableJobs = (notification: Notifications.Notification) => {
      if (isAvailableJobsNotification(notification.request.content.data)) router.push('/(driver)/jobs');
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) openAvailableJobs(response.notification);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => openAvailableJobs(response.notification));
    return () => responseSubscription.remove();
  }, [role]);

  return null;
}
