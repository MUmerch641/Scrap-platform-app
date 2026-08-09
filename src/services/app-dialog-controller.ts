export interface AndroidErrorDialogRequest {
  title: string;
  message: string;
}

type AndroidErrorDialogHandler = (request: AndroidErrorDialogRequest) => void;

let androidErrorDialogHandler: AndroidErrorDialogHandler | null = null;

/** Registers the application-level Android dialog host without exposing React hooks to services. */
export function registerAndroidErrorDialogHandler(
  handler: AndroidErrorDialogHandler,
): () => void {
  androidErrorDialogHandler = handler;
  return () => {
    if (androidErrorDialogHandler === handler) androidErrorDialogHandler = null;
  };
}

export function showAndroidErrorDialog(request: AndroidErrorDialogRequest): boolean {
  if (!androidErrorDialogHandler) return false;
  androidErrorDialogHandler(request);
  return true;
}
