import {
  USER_EDIT_MESSAGE_SUBMITTED_EVENT,
  type PreviewSelection,
  type UserEditMessageSubmittedDetail,
} from './visual-edit-context';

export type { PreviewSelection } from './visual-edit-context';

type PreviewMessage =
  | { source: 'yakable-preview'; type: 'yakable:selection-ready' }
  | { source: 'yakable-preview'; type: 'yakable:selection-mode-change'; enabled: boolean }
  | { source: 'yakable-preview'; type: 'yakable:selection-change'; selections: PreviewSelection[] };

const DASHBOARD_SOURCE = 'yakable-dashboard';
const PREVIEW_SOURCE = 'yakable-preview';
const PREVIEW_BADGE_ATTRIBUTE = 'data-yakable-selection-badge';
const USER_EDIT_MESSAGE_ATTRIBUTE = 'data-yakable-user-edit-message';
const ACTIVE_BUTTON_BACKGROUND = 'rgba(49, 104, 232, 0.14)';
const ACTIVE_BUTTON_COLOR = 'rgb(36, 95, 232)';
const MAX_PENDING_USER_MESSAGES = 20;

let started = false;
let selectionMode = false;
let selections: PreviewSelection[] = [];
let currentFrame: HTMLIFrameElement | null = null;
let observer: MutationObserver | null = null;
let pendingUserMessages: UserEditMessageSubmittedDetail[] = [];

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

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (sameDay) return `Today at ${time}`;

  const day = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
  return `${day} at ${time}`;
}

function sourceLabel(selection: PreviewSelection): string {
  if (!selection.source) return selection.selector || `Selected ${selection.tagName}`;
  const file = selection.source.file.split('/').filter(Boolean).at(-1) || selection.source.file;
  return `Line ${selection.source.line} in ${file}`;
}

function createTargetChip(selection: PreviewSelection): HTMLElement {
  const chip = document.createElement('span');
  chip.setAttribute('data-yakable-message-target', selection.sourceId || selection.id);
  Object.assign(chip.style, {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '22px',
    padding: '0 6px 0 4px',
    borderRadius: '7px',
    background: 'rgba(229, 236, 255, 0.92)',
    color: 'rgb(47, 93, 224)',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: '22px',
    whiteSpace: 'nowrap',
  });

  const icon = document.createElement('span');
  icon.textContent = 'T';
  Object.assign(icon.style, {
    display: 'grid',
    placeItems: 'center',
    width: '14px',
    height: '14px',
    border: '1px solid rgba(75, 115, 255, 0.72)',
    borderRadius: '4px',
    fontSize: '8px',
    fontWeight: '700',
    lineHeight: '1',
  });
  chip.appendChild(icon);

  const label = document.createElement('span');
  label.textContent = selection.tagName.toLowerCase();
  chip.appendChild(label);

  const tooltip = document.createElement('span');
  tooltip.textContent = sourceLabel(selection);
  Object.assign(tooltip.style, {
    position: 'absolute',
    left: '50%',
    bottom: 'calc(100% + 8px)',
    zIndex: '80',
    transform: 'translate(-50%, 3px)',
    padding: '6px 9px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.98)',
    color: '#30302d',
    boxShadow: '0 5px 16px rgba(15, 23, 42, 0.12)',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '16px',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 120ms ease-out, transform 120ms ease-out',
    whiteSpace: 'nowrap',
  });
  chip.appendChild(tooltip);

  chip.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translate(-50%, 0)';
  });
  chip.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translate(-50%, 3px)';
  });

  return chip;
}

function createOverflowChip(count: number): HTMLElement {
  const chip = document.createElement('span');
  chip.textContent = `+${count}`;
  Object.assign(chip.style, {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '22px',
    padding: '0 7px',
    borderRadius: '7px',
    background: 'rgba(229, 236, 255, 0.72)',
    color: 'rgb(47, 93, 224)',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: '22px',
  });
  return chip;
}

function createCopyIcon(): SVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('aria-hidden', 'true');

  const back = document.createElementNS(namespace, 'rect');
  back.setAttribute('x', '5');
  back.setAttribute('y', '5');
  back.setAttribute('width', '11');
  back.setAttribute('height', '11');
  back.setAttribute('rx', '2');
  svg.appendChild(back);

  const front = document.createElementNS(namespace, 'rect');
  front.setAttribute('x', '9');
  front.setAttribute('y', '9');
  front.setAttribute('width', '10');
  front.setAttribute('height', '10');
  front.setAttribute('rx', '2');
  svg.appendChild(front);
  return svg;
}

function findUserMessage(prompt: string): { row: HTMLElement; bubble: HTMLElement } | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('div.flex.justify-end.py-1'));
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.hasAttribute(USER_EDIT_MESSAGE_ATTRIBUTE)) continue;
    const bubble = row.firstElementChild;
    if (!(bubble instanceof HTMLElement)) continue;
    if ((bubble.textContent || '').trim() !== prompt.trim()) continue;
    return { row, bubble };
  }
  return null;
}

function decorateUserMessage(detail: UserEditMessageSubmittedDetail): boolean {
  const match = findUserMessage(detail.prompt);
  if (!match) return false;

  const { row, bubble } = match;
  row.setAttribute(USER_EDIT_MESSAGE_ATTRIBUTE, 'true');
  Object.assign(row.style, {
    flexDirection: 'column',
    alignItems: 'flex-end',
  });

  bubble.setAttribute('data-yakable-message-content', detail.prompt);
  bubble.style.borderRadius = '24px';
  bubble.style.borderBottomRightRadius = '24px';
  bubble.replaceChildren();

  if (detail.selections.length) {
    const targets = document.createElement('div');
    Object.assign(targets.style, {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '5px',
      marginBottom: '7px',
    });

    const visibleSelections = detail.selections.slice(0, 3);
    for (const selection of visibleSelections) {
      targets.appendChild(createTargetChip(selection));
    }
    if (detail.selections.length > visibleSelections.length) {
      targets.appendChild(createOverflowChip(detail.selections.length - visibleSelections.length));
    }
    bubble.appendChild(targets);
  }

  const content = document.createElement('div');
  content.textContent = detail.prompt;
  content.style.whiteSpace = 'pre-wrap';
  bubble.appendChild(content);

  const metadata = document.createElement('div');
  metadata.setAttribute('data-yakable-message-meta', '');
  Object.assign(metadata.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    minHeight: '24px',
    marginTop: '2px',
    paddingRight: '3px',
    color: 'rgba(48, 48, 45, 0.48)',
    fontSize: '11px',
    lineHeight: '16px',
  });

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.setAttribute('aria-label', 'Copy message');
  Object.assign(copy.style, {
    display: 'grid',
    placeItems: 'center',
    width: '24px',
    height: '24px',
    padding: '0',
    border: '0',
    borderRadius: '9999px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  });
  copy.appendChild(createCopyIcon());
  copy.addEventListener('mouseenter', () => {
    copy.style.background = 'rgba(15, 23, 42, 0.05)';
    copy.style.color = 'rgba(48, 48, 45, 0.72)';
  });
  copy.addEventListener('mouseleave', () => {
    copy.style.background = 'transparent';
    copy.style.color = 'inherit';
  });
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(detail.prompt);
  });
  metadata.appendChild(copy);

  const time = document.createElement('span');
  time.textContent = formatMessageTime(detail.createdAt);
  metadata.appendChild(time);
  row.appendChild(metadata);
  return true;
}

function decoratePendingUserMessages() {
  for (let index = 0; index < pendingUserMessages.length;) {
    if (decorateUserMessage(pendingUserMessages[index])) {
      pendingUserMessages.splice(index, 1);
    } else {
      index += 1;
    }
  }
}

function handleUserEditMessageSubmitted(event: Event) {
  const detail = (event as CustomEvent<UserEditMessageSubmittedDetail>).detail;
  if (!detail || !detail.prompt.trim()) return;
  pendingUserMessages.push(detail);
  if (pendingUserMessages.length > MAX_PENDING_USER_MESSAGES) {
    pendingUserMessages = pendingUserMessages.slice(-MAX_PENDING_USER_MESSAGES);
  }
  decoratePendingUserMessages();
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
  decoratePendingUserMessages();
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
  window.addEventListener(USER_EDIT_MESSAGE_SUBMITTED_EVENT, handleUserEditMessageSubmitted);

  observer = new MutationObserver(syncDom);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  syncDom();
}

export function stopPreviewSelectionController() {
  if (!started) return;
  started = false;
  observer?.disconnect();
  observer = null;
  pendingUserMessages = [];
  document.removeEventListener('click', handleDocumentClick, true);
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener(USER_EDIT_MESSAGE_SUBMITTED_EVENT, handleUserEditMessageSubmitted);
}
