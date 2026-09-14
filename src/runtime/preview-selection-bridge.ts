import type { Plugin } from 'vite';

import {
  PAGE_OBSERVATION_MAX_ELEMENTS,
  PAGE_OBSERVATION_MAX_ERROR_LENGTH,
  PAGE_OBSERVATION_MAX_RUNTIME_ERRORS,
  PAGE_OBSERVATION_MAX_SELECTOR_LENGTH,
  PAGE_OBSERVATION_MAX_TEXT_LENGTH,
  PAGE_OBSERVATION_VERSION,
} from './page-observation.js';

export const PREVIEW_SELECTION_BRIDGE_SCRIPT = String.raw`(() => {
  if (window.__yakablePreviewSelectionBridgeInstalled) return;
  window.__yakablePreviewSelectionBridgeInstalled = true;

  const DASHBOARD_SOURCE = 'yakable-dashboard';
  const PREVIEW_SOURCE = 'yakable-preview';
  const OVERLAY_ATTRIBUTE = 'data-yakable-selection-overlay';
  const OBSERVATION_MAX_ELEMENTS = ${PAGE_OBSERVATION_MAX_ELEMENTS};
  const OBSERVATION_MAX_RUNTIME_ERRORS = ${PAGE_OBSERVATION_MAX_RUNTIME_ERRORS};
  const OBSERVATION_MAX_TEXT_LENGTH = ${PAGE_OBSERVATION_MAX_TEXT_LENGTH};
  const OBSERVATION_MAX_SELECTOR_LENGTH = ${PAGE_OBSERVATION_MAX_SELECTOR_LENGTH};
  const OBSERVATION_MAX_ERROR_LENGTH = ${PAGE_OBSERVATION_MAX_ERROR_LENGTH};
  const OBSERVATION_VERSION = ${PAGE_OBSERVATION_VERSION};
  const OBSERVATION_SELECTOR = [
    '[data-yakable-source-id]',
    '[role]',
    'main',
    'header',
    'nav',
    'section',
    'article',
    'aside',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'label',
    'img',
    'form',
    'table',
    'ul',
    'ol',
  ].join(',');
  const OBSERVATION_KEY_TAGS = new Set([
    'main',
    'header',
    'nav',
    'section',
    'article',
    'aside',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'label',
    'img',
    'form',
    'table',
    'ul',
    'ol',
  ]);
  const ids = new WeakMap();
  const selected = new Map();
  const runtimeErrors = [];
  let runtimeErrorsTruncated = false;
  let nextId = 1;
  let selectionMode = false;
  let hoveredElement = null;

  const style = document.createElement('style');
  style.setAttribute(OVERLAY_ATTRIBUTE, 'style');
  style.textContent = [
    'html[data-yakable-selecting="true"] * { cursor: crosshair !important; }',
    '[data-yakable-selection-overlay] { font-family: Inter, ui-sans-serif, system-ui, sans-serif !important; }',
  ].join('\n');
  document.documentElement.appendChild(style);

  function createOverlay(kind) {
    const overlay = document.createElement('div');
    overlay.setAttribute(OVERLAY_ATTRIBUTE, kind);
    Object.assign(overlay.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      border: kind === 'hover' ? '1.5px solid rgb(72 116 255)' : '1.5px solid rgb(54 104 255)',
      background: kind === 'hover' ? 'rgba(72, 116, 255, 0.035)' : 'rgba(72, 116, 255, 0.055)',
      zIndex: kind === 'hover' ? '2147483646' : '2147483645',
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  const hoverOverlay = createOverlay('hover');
  const hoverLabel = document.createElement('div');
  hoverLabel.setAttribute(OVERLAY_ATTRIBUTE, 'hover-label');
  Object.assign(hoverLabel.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'none',
    borderRadius: '9999px',
    background: 'rgb(54 104 255)',
    color: 'white',
    fontSize: '10px',
    lineHeight: '16px',
    fontWeight: '600',
    padding: '0 6px',
    zIndex: '2147483647',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.14)',
  });
  document.documentElement.appendChild(hoverLabel);

  function isBridgeNode(node) {
    return node instanceof Element && node.hasAttribute(OVERLAY_ATTRIBUTE);
  }

  function isSelectable(element) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
    if (isBridgeNode(element)) return false;
    if (element === document.documentElement || element === document.body) return false;
    return true;
  }

  function getElementId(element) {
    const existing = ids.get(element);
    if (existing) return existing;
    const id = 'yakable-selection-' + nextId++;
    ids.set(element, id);
    return id;
  }

  function sourceMetadataFor(element) {
    const sourceId = element.getAttribute('data-yakable-source-id') || '';
    const file = element.getAttribute('data-yakable-source-file') || '';
    const line = Number.parseInt(element.getAttribute('data-yakable-source-line') || '', 10);
    const column = Number.parseInt(element.getAttribute('data-yakable-source-column') || '', 10);
    const metadata = {};

    if (sourceId) metadata.sourceId = sourceId;
    if (file && Number.isFinite(line) && line > 0 && Number.isFinite(column) && column > 0) {
      metadata.source = { file, line, column };
    }
    return metadata;
  }

  function cssPath(element) {
    const parts = [];
    let current = element;
    while (current && current instanceof Element && current !== document.body && parts.length < 6) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += '#' + CSS.escape(current.id);
        parts.unshift(part);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) {
          part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
        }
      }
      parts.unshift(part);
      current = parent;
    }
    return parts.join(' > ').slice(0, OBSERVATION_MAX_SELECTOR_LENGTH);
  }

  function elementText(element) {
    const rawText = 'innerText' in element ? element.innerText : element.textContent;
    return String(rawText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, OBSERVATION_MAX_TEXT_LENGTH);
  }

  function descriptorFor(element) {
    const rect = element.getBoundingClientRect();
    return {
      id: getElementId(element),
      ...sourceMetadataFor(element),
      tagName: element.tagName.toLowerCase(),
      text: elementText(element),
      selector: cssPath(element),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  function normalizeRuntimeErrorMessage(value) {
    let message = '';
    if (value instanceof Error) {
      message = value.message || value.name;
    } else if (typeof value === 'string') {
      message = value;
    } else {
      try {
        message = JSON.stringify(value);
      } catch {
        message = String(value);
      }
    }
    return String(message || 'Unknown runtime error')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, OBSERVATION_MAX_ERROR_LENGTH);
  }

  function recordRuntimeError(kind, value) {
    const message = normalizeRuntimeErrorMessage(value);
    if (runtimeErrors.some((item) => item.kind === kind && item.message === message)) return;
    if (runtimeErrors.length >= OBSERVATION_MAX_RUNTIME_ERRORS) {
      runtimeErrorsTruncated = true;
      return;
    }
    runtimeErrors.push({ kind, message });
  }

  window.addEventListener('error', (event) => {
    recordRuntimeError('error', event.error || event.message || event.filename || 'Window error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordRuntimeError('unhandledrejection', event.reason);
  });

  function observationRectFor(element) {
    if (!isSelectable(element)) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
      return null;
    }
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse') {
      return null;
    }
    const opacity = Number.parseFloat(computed.opacity || '1');
    if (Number.isFinite(opacity) && opacity <= 0) return null;
    return rect;
  }

  function isKeyObservationElement(element, rect) {
    const tagName = element.tagName.toLowerCase();
    if (OBSERVATION_KEY_TAGS.has(tagName)) return true;
    if (element.getAttribute('role')) return true;
    if (!element.getAttribute('data-yakable-source-id')) return false;
    if (tagName === 'div') return rect.width >= 160 && rect.height >= 48;
    if (tagName === 'span') return rect.width >= 20 && rect.height >= 12 && Boolean(elementText(element));
    return false;
  }

  function observationDescriptorFor(element, rect) {
    const role = (element.getAttribute('role') || '').trim().slice(0, 120);
    const ariaLabel = (element.getAttribute('aria-label') || '')
      .trim()
      .slice(0, OBSERVATION_MAX_TEXT_LENGTH);
    return {
      ...sourceMetadataFor(element),
      tagName: element.tagName.toLowerCase(),
      text: elementText(element),
      selector: cssPath(element),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      ...(role ? { role } : {}),
      ...(ariaLabel ? { ariaLabel } : {}),
    };
  }

  function collectPageObservation() {
    const elements = [];
    let eligibleElements = 0;
    const candidates = Array.from(document.querySelectorAll(OBSERVATION_SELECTOR));

    for (const element of candidates) {
      const rect = observationRectFor(element);
      if (!rect || !isKeyObservationElement(element, rect)) continue;
      eligibleElements += 1;
      if (elements.length < OBSERVATION_MAX_ELEMENTS) {
        elements.push(observationDescriptorFor(element, rect));
      }
    }

    const root = document.documentElement;
    const body = document.body;
    const documentWidth = Math.max(
      window.innerWidth,
      root ? root.scrollWidth : 0,
      body ? body.scrollWidth : 0,
    );
    const documentHeight = Math.max(
      window.innerHeight,
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
    );

    return {
      version: OBSERVATION_VERSION,
      route: (window.location.pathname || '/') + window.location.search + window.location.hash,
      viewport: {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
        devicePixelRatio: Number(window.devicePixelRatio || 1),
      },
      documentSize: {
        width: Math.round(documentWidth),
        height: Math.round(documentHeight),
      },
      elements,
      runtimeErrors: runtimeErrors.slice(0, OBSERVATION_MAX_RUNTIME_ERRORS),
      truncated: {
        elements: eligibleElements > elements.length,
        runtimeErrors: runtimeErrorsTruncated,
      },
    };
  }

  function emitPageObservation(requestId) {
    window.parent.postMessage({
      source: PREVIEW_SOURCE,
      type: 'yakable:page-observation',
      requestId,
      observation: collectPageObservation(),
    }, '*');
  }

  function placeOverlay(overlay, element) {
    if (!element || !element.isConnected) {
      overlay.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function updateHoverOverlay(element) {
    hoveredElement = element;
    if (!selectionMode || !element) {
      hoverOverlay.style.display = 'none';
      hoverLabel.style.display = 'none';
      return;
    }
    placeOverlay(hoverOverlay, element);
    const rect = element.getBoundingClientRect();
    hoverLabel.textContent = element.tagName.toLowerCase();
    const source = element.getAttribute('data-yakable-source');
    if (source) hoverLabel.title = source;
    else hoverLabel.removeAttribute('title');
    hoverLabel.style.display = 'block';
    hoverLabel.style.left = Math.max(4, rect.left) + 'px';
    hoverLabel.style.top = Math.max(4, rect.top - 20) + 'px';
  }

  function updateSelectedOverlays() {
    for (const [id, item] of selected) {
      if (!item.element.isConnected) {
        item.overlay.remove();
        selected.delete(id);
        continue;
      }
      placeOverlay(item.overlay, item.element);
    }
  }

  function emitSelections() {
    const selections = Array.from(selected.values()).map((item) => descriptorFor(item.element));
    window.parent.postMessage({
      source: PREVIEW_SOURCE,
      type: 'yakable:selection-change',
      selections,
    }, '*');
  }

  function clearSelections() {
    for (const item of selected.values()) item.overlay.remove();
    selected.clear();
    emitSelections();
  }

  function setSelectionMode(enabled) {
    selectionMode = Boolean(enabled);
    document.documentElement.toggleAttribute('data-yakable-selecting', selectionMode);
    if (selectionMode) {
      document.documentElement.setAttribute('data-yakable-selecting', 'true');
    } else {
      document.documentElement.removeAttribute('data-yakable-selecting');
      updateHoverOverlay(null);
    }
    window.parent.postMessage({
      source: PREVIEW_SOURCE,
      type: 'yakable:selection-mode-change',
      enabled: selectionMode,
    }, '*');
  }

  function targetAtPointer(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    return isSelectable(target) ? target : null;
  }

  document.addEventListener('pointermove', (event) => {
    if (!selectionMode) return;
    const target = targetAtPointer(event);
    if (target !== hoveredElement) updateHoverOverlay(target);
  }, true);

  document.addEventListener('pointerleave', () => {
    if (selectionMode) updateHoverOverlay(null);
  }, true);

  document.addEventListener('click', (event) => {
    if (!selectionMode) return;
    const target = targetAtPointer(event);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const id = getElementId(target);
    const existing = selected.get(id);
    if (existing) {
      existing.overlay.remove();
      selected.delete(id);
    } else {
      const overlay = createOverlay('selected');
      selected.set(id, { element: target, overlay });
      placeOverlay(overlay, target);
    }
    emitSelections();
  }, true);

  window.addEventListener('scroll', () => {
    if (selectionMode && hoveredElement) updateHoverOverlay(hoveredElement);
    updateSelectedOverlays();
  }, true);

  window.addEventListener('resize', () => {
    if (selectionMode && hoveredElement) updateHoverOverlay(hoveredElement);
    updateSelectedOverlays();
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.source !== DASHBOARD_SOURCE) return;
    if (message.type === 'yakable:selection-mode') {
      setSelectionMode(Boolean(message.enabled));
    } else if (message.type === 'yakable:clear-selections') {
      clearSelections();
    } else if (message.type === 'yakable:request-selection-state') {
      emitSelections();
    } else if (message.type === 'yakable:request-page-observation') {
      const requestId = typeof message.requestId === 'string'
        ? message.requestId.trim().slice(0, 120)
        : '';
      if (requestId) emitPageObservation(requestId);
    }
  });

  window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'yakable:selection-ready' }, '*');
})();`;

export function previewSelectionBridgePlugin(): Plugin {
  return {
    name: 'yakable-preview-selection-bridge',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', 'data-yakable-preview-bridge': 'true' },
          children: PREVIEW_SELECTION_BRIDGE_SCRIPT,
          injectTo: 'head',
        },
      ];
    },
  };
}
