import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { AppIconName } from '@/components/ui/app-icon';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { registerAndroidErrorDialogHandler } from '@/services/app-dialog-controller';

export interface AppDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  destructive?: boolean;
  icon?: AppIconName;
  dismissible?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface AppDialogContextValue {
  showDialog: (options: AppDialogOptions) => void;
  dismissDialog: () => void;
}

const AppDialogContext = createContext<AppDialogContextValue | undefined>(undefined);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = React.useRef(false);

  const dismissDialog = useCallback(() => {
    if (confirmingRef.current) return;
    setDialog(null);
  }, []);

  const showDialog = useCallback((options: AppDialogOptions) => {
    confirmingRef.current = false;
    setConfirming(false);
    setDialog(options);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!dialog || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      await dialog.onConfirm();
      setDialog(null);
    } catch {
      // Keep the decision visible so the caller can surface its controlled failure state.
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  }, [dialog]);

  const value = useMemo(
    () => ({ showDialog, dismissDialog }),
    [dismissDialog, showDialog],
  );

  React.useLayoutEffect(
    () => registerAndroidErrorDialogHandler(({ title, message }) => {
      showDialog({
        title,
        message,
        confirmLabel: 'OK',
        cancelLabel: null,
        destructive: false,
        icon: 'alert-circle-outline',
        dismissible: false,
        onConfirm: () => undefined,
      });
    }),
    [showDialog],
  );

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        visible={Boolean(dialog)}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        destructive={dialog?.destructive}
        icon={dialog?.icon}
        dismissible={dialog?.dismissible}
        loading={confirming}
        onConfirm={() => void handleConfirm()}
        onCancel={dismissDialog}
      />
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const context = useContext(AppDialogContext);
  if (!context) throw new Error('useAppDialog must be used within AppDialogProvider.');
  return context;
}
