export type PreviewPageObservationRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PreviewPageObservationSource = {
  file: string;
  line: number;
  column: number;
};

export type PreviewPageObservationElement = {
  tagName: string;
  text: string;
  selector: string;
  rect: PreviewPageObservationRect;
  role?: string;
  ariaLabel?: string;
  sourceId?: string;
  source?: PreviewPageObservationSource;
};

export type PreviewPageObservation = {
  version: 1;
  route: string;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };
  documentSize: {
    width: number;
    height: number;
  };
  elements: PreviewPageObservationElement[];
  runtimeErrors: Array<{
    kind: 'error' | 'unhandledrejection';
    message: string;
  }>;
  truncated: {
    elements: boolean;
    runtimeErrors: boolean;
  };
};

type PreviewObservationMessage = {
  source: 'yakable-preview';
  type: 'yakable:page-observation';
  requestId: string;
  observation: PreviewPageObservation;
};

const DASHBOARD_SOURCE = 'yakable-dashboard';
const PREVIEW_SOURCE = 'yakable-preview';
const DEFAULT_OBSERVATION_TIMEOUT_MS = 2_000;
let nextObservationRequestId = 1;

export function requestPreviewPageObservation(
  frame: HTMLIFrameElement,
  timeoutMs = DEFAULT_OBSERVATION_TIMEOUT_MS,
): Promise<PreviewPageObservation> {
  const targetWindow = frame.contentWindow;
  if (!targetWindow) {
    return Promise.reject(new Error('Preview frame is not ready for page observation.'));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('Page observation timeout must be a positive number.'));
  }

  const requestId = `page-observation-${Date.now()}-${nextObservationRequestId++}`;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeout);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleMessage = (event: MessageEvent<PreviewObservationMessage>) => {
      if (event.source !== targetWindow) return;
      const message = event.data;
      if (
        !message
        || message.source !== PREVIEW_SOURCE
        || message.type !== 'yakable:page-observation'
        || message.requestId !== requestId
      ) {
        return;
      }
      settle(() => resolve(message.observation));
    };

    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error('Preview page observation timed out.')));
    }, timeoutMs);

    window.addEventListener('message', handleMessage);
    targetWindow.postMessage({
      source: DASHBOARD_SOURCE,
      type: 'yakable:request-page-observation',
      requestId,
    }, '*');
  });
}
