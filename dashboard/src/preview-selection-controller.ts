export type PreviewSelection = {
  id: string;
  tagName: string;
  text: string;
  selector: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type PreviewMessage =
  | { source: 'yakable-preview'; type: 'yakable:selection-ready' }
  | { source: 'yakable-preview'; type: 'yakable:selection-mode-change'; enabled: boolean }
  | { source: 'yakable-preview'; type: 'yakable:selection-change'; selections: PreviewSelection[] };

const DASHBOARD_SOURCE = 'yakable-dashboard';
const PREVIEW_SOURCE = 'yakable-preview';
const PREVIEW_BADGE_ATTRIBUTE = 'data-yakable-selection-badge';
const ACTIVE_BUTTON_BACKGROUND = 'rgba(49, 104, 232, 0.14)';
const ACTIVE_BUTTON_COLOR = 'rgb(36, 95, 232)';

let started = false;
let selectionMode = false;
let selections: PreviewSelection[] = [];
let currentFrame: HTMLIFrameElement | null = null;
let observer: MutationObserver | null = null;

function getPreviewFrame(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[title$=" preview"]');
}

function getSelectionButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('button[aria-label="Select elements"]');
}

function getPreviewToolbarSurface(): HTMLElement | null {
  const toolbar = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Preview interactions"]');
  return toolbar?.closest<HTMLElement>('[data-allow-shadow]') ?? null;
}

function postToPreview(type: string, payload: Record<string, unknown> = {}) {
  const frame = getPreviewFrame();
  frame?.contentWindow?.postMessage({ source: DASHBOARD_SOURCE, type, ...payload }, '*');
}

function selectionLabel() {
  return `${selections.length} ${selections.length === 1 ? 'selection' : 'selections'}`;
}

function applySelectionButtonState() {
  const button = getSelectionButton();
  if (!button) return;
  button.setAttribute('aria-pressed', selectionMode ? 'true' : 'false');
  button.style.background = selectionMode ? ACTIVE_BUTTON_BACKGROUND : '';
  button.style.color = selectionMode ? ACTIVE_BUTTON_COLOR : '';
}

function applyToolbarVisibility() {
  const toolbarSurface = getPreviewToolbarSurface();
  if (!toolbarSurface) return;
  toolbarSurface.style.opacity = selections.length ? '0' : '';
  toolbarSurface.style.pointerEvents = selections.length ? 'none' : '';
  toolbarSurface.style.transition = 'opacity 120ms ease-out';
}

function createSelectionIcon(): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.textContent = '⌖';
  Object.assign(icon.style, {
    display: 'grid',
    placeItems: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '9999px',
    flex: '0 0 auto',
    background: 'rgb(49 104 232)',
    color: 'white',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: '1',
  });
  return icon;
}

function ensurePreviewBadge() {
  const frame = getPreviewFrame();
  const previewSurface = frame?.parentElement;
  if (!previewSurface) return;

  let badge = previewSurface.querySelector<HTMLDivElement>(`[${PREVIEW_BADGE_ATTRIBUTE}="preview"]`);
  if (!selections.length) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.setAttribute(PREVIEW_BADGE_ATTRIBUTE, 'preview');
    badge.setAttribute('data-allow-shadow', '');
    Object.assign(badge.style, {
      position: 'absolute',
      left: '50%',
      bottom: '10px',
      transform: 'translateX(-50%)',
      zIndex: '35',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '36px',
      padding: '4px 5px 4px 4px',
      borderRadius: '9999px',
      border: '1px solid rgba(15, 23, 42, 0.12)',
      background: 'rgba(255, 255, 255, 0.94)',
      color: '#2b2b29',
      boxShadow: '0 4px 18px rgba(15, 23, 42, 0.12)',
      backdropFilter: 'blur(12px)',
      fontSize: '13px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
    });

    const icon = createSelectionIcon();
    icon.setAttribute('data-yakable-selection-icon', '');
    badge.appendChild(icon);

    const label = document.createElement('span');
    label.setAttribute('data-yakable-selection-count', '');
    badge.appendChild(label);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.setAttribute('data-yakable-clear-selections', '');
    Object.assign(clear.style, {
      height: '28px',
      padding: '0 12px',
      borderRadius: '9999px',
      border: '1px solid rgba(15, 23, 42, 0.12)',
      background: 'white',
      color: '#31312f',
      cursor: 'pointer',
      font: 'inherit',
      fontSize: '12px',
      fontWeight: '500',
    });
    clear.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      postToPreview('yakable:clear-selections');
    });
    badge.appendChild(clear);
    previewSurface.appendChild(badge);
  }

  const label = badge.querySelector<HTMLElement>('[data-yakable-selection-count]');
  const nextLabel = selectionLabel();
  if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
}

function ensureComposerBadge() {
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask Yakable..."]')
    ?? document.querySelector<HTMLTextAreaElement>('textarea[data-yakable-selection-composer]');
  const form = textarea?.closest('form');
  if (!textarea || !form) return;

  let badge = form.querySelector<HTMLDivElement>(`[${PREVIEW_BADGE_ATTRIBUTE}="composer"]`);
  if (!selections.length) {
    badge?.remove();
    const originalPlaceholder = textarea.dataset.yakableDefaultPlaceholder;
    if (originalPlaceholder && textarea.placeholder !== originalPlaceholder) {
      textarea.placeholder = originalPlaceholder;
    }
    textarea.removeAttribute('data-yakable-selection-composer');
    return;
  }

  if (!textarea.dataset.yakableDefaultPlaceholder) {
    textarea.dataset.yakableDefaultPlaceholder = textarea.placeholder || 'Ask Yakable...';
  }
  textarea.setAttribute('data-yakable-selection-composer', 'true');
  if (textarea.placeholder !== 'Ask Yakable to modify the selected elements...') {
    textarea.placeholder = 'Ask Yakable to modify the selected elements...';
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.setAttribute(PREVIEW_BADGE_ATTRIBUTE, 'composer');
    Object.assign(badge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      alignSelf: 'flex-start',
      minHeight: '24px',
      margin: '0 0 2px 1px',
      padding: '0 8px 0 5px',
      borderRadius: '9999px',
      color: 'rgb(36 95 232)',
      background: 'rgba(238, 243, 255, 0.82)',
      border: '1px solid rgba(117, 151, 255, 0.38)',
      fontSize: '11px',
      fontWeight: '600',
      lineHeight: '22px',
      width: 'fit-content',
    });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '9px',
      height: '9px',
      borderRadius: '9999px',
      border: '1.5px dashed currentColor',
      flex: '0 0 auto',
    });
    badge.appendChild(dot);

    const label = document.createElement('span');
    label.setAttribute('data-yakable-selection-count', '');
    badge.appendChild(label);
    form.insertBefore(badge, textarea);
  }

  const label = badge.querySelector<HTMLElement>('[data-yakable-selection-count]');
  const nextLabel = selectionLabel();
  if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
}

function renderSelectionUi() {
  applySelectionButtonState();
  applyToolbarVisibility();
  ensurePreviewBadge();
  ensureComposerBadge();
}

function resetForFrame(frame: HTMLIFrameElement | null) {
  if (frame === currentFrame) return;
  currentFrame = frame;
  selections = [];
  renderSelectionUi();

  if (frame) {
    frame.addEventListener('load', () => {
      frame.contentWindow?.postMessage({
        source: DASHBOARD_SOURCE,
        type: 'yakable:selection-mode',
        enabled: selectionMode,
      }, '*');
    }, { once: true });
  }
}

function syncDom() {
  resetForFrame(getPreviewFrame());
  renderSelectionUi();
}

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  renderSelectionUi();
  postToPreview('yakable:selection-mode', { enabled: selectionMode });
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const selectionButton = target.closest('button[aria-label="Select elements"]');
  if (!selectionButton) return;
  event.preventDefault();
  toggleSelectionMode();
}

function handleMessage(event: MessageEvent<PreviewMessage>) {
  const frame = getPreviewFrame();
  if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (!message || message.source !== PREVIEW_SOURCE) return;

  if (message.type === 'yakable:selection-ready') {
    postToPreview('yakable:selection-mode', { enabled: selectionMode });
    postToPreview('yakable:request-selection-state');
    return;
  }

  if (message.type === 'yakable:selection-mode-change') {
    selectionMode = message.enabled;
    renderSelectionUi();
    return;
  }

  if (message.type === 'yakable:selection-change') {
    selections = Array.isArray(message.selections) ? message.selections : [];
    renderSelectionUi();
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !selectionMode) return;
  selectionMode = false;
  renderSelectionUi();
  postToPreview('yakable:selection-mode', { enabled: false });
}

export function startPreviewSelectionController() {
  if (started) return;
  started = true;

  document.addEventListener('click', handleDocumentClick, true);
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeyDown);

  observer = new MutationObserver(syncDom);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncDom();
}

export function stopPreviewSelectionController() {
  if (!started) return;
  started = false;
  observer?.disconnect();
  observer = null;
  document.removeEventListener('click', handleDocumentClick, true);
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
}
