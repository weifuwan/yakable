export const PAGE_OBSERVATION_VERSION = 1 as const;
export const PAGE_OBSERVATION_MAX_ELEMENTS = 80;
export const PAGE_OBSERVATION_MAX_RUNTIME_ERRORS = 12;
export const PAGE_OBSERVATION_MAX_TEXT_LENGTH = 180;
export const PAGE_OBSERVATION_MAX_SELECTOR_LENGTH = 500;
export const PAGE_OBSERVATION_MAX_ERROR_LENGTH = 500;

export interface PageObservationRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageObservationSource {
  file: string;
  line: number;
  column: number;
}

export interface PageObservationElement {
  tagName: string;
  text: string;
  selector: string;
  rect: PageObservationRect;
  role?: string;
  ariaLabel?: string;
  sourceId?: string;
  source?: PageObservationSource;
}

export type PageObservationRuntimeErrorKind = 'error' | 'unhandledrejection';

export interface PageObservationRuntimeError {
  kind: PageObservationRuntimeErrorKind;
  message: string;
}

export interface PageObservation {
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
  elements: PageObservationElement[];
  runtimeErrors: PageObservationRuntimeError[];
  truncated: {
    elements: boolean;
    runtimeErrors: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== 'string') {
    throw new Error(`Page observation ${field} must be a string.`);
  }
  const normalized = value.trim();
  if ((!normalized && !allowEmpty) || normalized.length > maxLength) {
    throw new Error(`Page observation ${field} is invalid.`);
  }
  return normalized;
}

function readFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Page observation ${field} must be a finite number.`);
  }
  return value;
}

function readNonNegativeNumber(value: unknown, field: string): number {
  const number = readFiniteNumber(value, field);
  if (number < 0) {
    throw new Error(`Page observation ${field} must be non-negative.`);
  }
  return number;
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Page observation ${field} must be a positive integer.`);
  }
  return value;
}

function readRect(value: unknown): PageObservationRect {
  if (!isRecord(value)) {
    throw new Error('Page observation element rect must be an object.');
  }
  return {
    left: readFiniteNumber(value.left, 'element.rect.left'),
    top: readFiniteNumber(value.top, 'element.rect.top'),
    width: readNonNegativeNumber(value.width, 'element.rect.width'),
    height: readNonNegativeNumber(value.height, 'element.rect.height'),
  };
}

function readSource(value: unknown): PageObservationSource | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error('Page observation element source must be an object.');
  }
  return {
    file: readString(value.file, 'element.source.file', 240),
    line: readPositiveInteger(value.line, 'element.source.line'),
    column: readPositiveInteger(value.column, 'element.source.column'),
  };
}

function readElement(value: unknown): PageObservationElement {
  if (!isRecord(value)) {
    throw new Error('Page observation element must be an object.');
  }

  const role = value.role === undefined
    ? undefined
    : readString(value.role, 'element.role', 120, true);
  const ariaLabel = value.ariaLabel === undefined
    ? undefined
    : readString(value.ariaLabel, 'element.ariaLabel', PAGE_OBSERVATION_MAX_TEXT_LENGTH, true);
  const sourceId = value.sourceId === undefined
    ? undefined
    : readString(value.sourceId, 'element.sourceId', 120);
  const source = readSource(value.source);

  return {
    tagName: readString(value.tagName, 'element.tagName', 80),
    text: readString(value.text, 'element.text', PAGE_OBSERVATION_MAX_TEXT_LENGTH, true),
    selector: readString(value.selector, 'element.selector', PAGE_OBSERVATION_MAX_SELECTOR_LENGTH),
    rect: readRect(value.rect),
    ...(role ? { role } : {}),
    ...(ariaLabel ? { ariaLabel } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(source ? { source } : {}),
  };
}

function readRuntimeError(value: unknown): PageObservationRuntimeError {
  if (!isRecord(value)) {
    throw new Error('Page observation runtime error must be an object.');
  }
  if (value.kind !== 'error' && value.kind !== 'unhandledrejection') {
    throw new Error('Page observation runtime error kind is invalid.');
  }
  return {
    kind: value.kind,
    message: readString(value.message, 'runtimeErrors.message', PAGE_OBSERVATION_MAX_ERROR_LENGTH),
  };
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Page observation ${field} must be a boolean.`);
  }
  return value;
}

export function parsePageObservation(value: unknown): PageObservation {
  if (!isRecord(value) || value.version !== PAGE_OBSERVATION_VERSION) {
    throw new Error('Page observation must be a version 1 object.');
  }
  if (!isRecord(value.viewport) || !isRecord(value.documentSize) || !isRecord(value.truncated)) {
    throw new Error('Page observation is missing viewport, documentSize, or truncated metadata.');
  }
  if (!Array.isArray(value.elements) || value.elements.length > PAGE_OBSERVATION_MAX_ELEMENTS) {
    throw new Error(`Page observation may contain at most ${PAGE_OBSERVATION_MAX_ELEMENTS} elements.`);
  }
  if (
    !Array.isArray(value.runtimeErrors)
    || value.runtimeErrors.length > PAGE_OBSERVATION_MAX_RUNTIME_ERRORS
  ) {
    throw new Error(
      `Page observation may contain at most ${PAGE_OBSERVATION_MAX_RUNTIME_ERRORS} runtime errors.`,
    );
  }

  return {
    version: PAGE_OBSERVATION_VERSION,
    route: readString(value.route, 'route', 1_000),
    viewport: {
      width: readNonNegativeNumber(value.viewport.width, 'viewport.width'),
      height: readNonNegativeNumber(value.viewport.height, 'viewport.height'),
      scrollX: readFiniteNumber(value.viewport.scrollX, 'viewport.scrollX'),
      scrollY: readFiniteNumber(value.viewport.scrollY, 'viewport.scrollY'),
      devicePixelRatio: readNonNegativeNumber(
        value.viewport.devicePixelRatio,
        'viewport.devicePixelRatio',
      ),
    },
    documentSize: {
      width: readNonNegativeNumber(value.documentSize.width, 'documentSize.width'),
      height: readNonNegativeNumber(value.documentSize.height, 'documentSize.height'),
    },
    elements: value.elements.map(readElement),
    runtimeErrors: value.runtimeErrors.map(readRuntimeError),
    truncated: {
      elements: readBoolean(value.truncated.elements, 'truncated.elements'),
      runtimeErrors: readBoolean(value.truncated.runtimeErrors, 'truncated.runtimeErrors'),
    },
  };
}
