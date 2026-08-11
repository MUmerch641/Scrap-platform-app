import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type NetworkStatus = 'checking' | 'online' | 'offline' | 'back-online';

interface NetworkStatusContextValue {
  status: NetworkStatus;
  isOffline: boolean;
  isOnline: boolean;
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | undefined>(undefined);
const BACK_ONLINE_DURATION_MS = 2_500;

function getNetworkStatus(state: NetInfoState): 'checking' | 'online' | 'offline' {
  if (state.isConnected === null) return 'checking';
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  return 'online';
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('checking');
  const previousStatusRef = useRef<NetworkStatus>('checking');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const updateStatus = (state: NetInfoState) => {
      const nextStatus = getNetworkStatus(state);
      const previousStatus = previousStatusRef.current;

      if (nextStatus === 'checking') return;
      if (nextStatus === previousStatus) return;

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      if (nextStatus === 'online' && previousStatus === 'offline') {
        previousStatusRef.current = 'online';
        setStatus('back-online');
        dismissTimerRef.current = setTimeout(() => {
          setStatus('online');
          dismissTimerRef.current = null;
        }, BACK_ONLINE_DURATION_MS);
        return;
      }

      previousStatusRef.current = nextStatus;
      setStatus(nextStatus);
    };

    const unsubscribe = NetInfo.addEventListener(updateStatus);
    void NetInfo.fetch().then(updateStatus);

    return () => {
      unsubscribe();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const value = useMemo(() => ({
    status,
    isOffline: status === 'offline',
    isOnline: status === 'online' || status === 'back-online',
  }), [status]);

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusContextValue {
  const context = useContext(NetworkStatusContext);
  if (!context) throw new Error('useNetworkStatus must be used within NetworkStatusProvider.');
  return context;
}
