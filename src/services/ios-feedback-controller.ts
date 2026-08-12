export type IOSFeedbackKind = 'success' | 'info';

export interface IOSFeedbackRequest {
  message: string;
  kind: IOSFeedbackKind;
}

type IOSFeedbackHandler = (request: IOSFeedbackRequest) => void;

let iosFeedbackHandler: IOSFeedbackHandler | null = null;

export function registerIOSFeedbackHandler(handler: IOSFeedbackHandler): () => void {
  iosFeedbackHandler = handler;
  return () => {
    if (iosFeedbackHandler === handler) iosFeedbackHandler = null;
  };
}

export function showIOSFeedback(request: IOSFeedbackRequest): boolean {
  if (!iosFeedbackHandler) return false;
  iosFeedbackHandler(request);
  return true;
}
