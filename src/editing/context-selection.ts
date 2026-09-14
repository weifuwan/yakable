import path from 'node:path';

import { requestProjectContextSelection } from '../model/deepseek.js';
import type { ProjectVisualSelection } from '../types.js';
import type { EditIntentDelta } from './edit-intent.js';

export const MAX_EDIT_CONTEXT_FILES = 12;
export const MAX_PROJECT_CONTEXT_CANDIDATES = 500;
export const MAX_CONTEXT_SEARCH_QUERY_LENGTH = 80;
const FALLBACK_CONTEXT_FILES = 8;

export type EditContextSelectionSource = 'visual' | 'model' | 'search' | 'fallback';

export interface EditContextSelection {
  version: 1;
  relevantFiles: string[];
  searchQuery: string | null;
  reason: string;
  source: EditContextSelectionSource;
}

export interface EditContextSelectionInput {
  userRequest: string;
  visualSelections: ProjectVisualSelection[];
  editIntent?: EditIntentDelta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAvailableFiles(availableFiles: string[]): string[] {
  const files = [...new Set(availableFiles.map((file) => file.trim()).filter(Boolean))].sort();
  if (files.length === 0) {
    throw new Error('Project context selection requires at least one available file.');
  }
  if (files.length > MAX_PROJECT_CONTEXT_CANDIDATES) {
    throw new Error(
      `Project context selection supports at most ${MAX_PROJECT_CONTEXT_CANDIDATES} candidate files.`,
    );
  }
  return files;
}

export function buildProjectContextSelectionRequest(
  input: EditContextSelectionInput,
  availableFiles: string[],
): string {
  const files = normalizeAvailableFiles(availableFiles);
  const visualSelections = input.visualSelections.slice(0, 20).map((selection) => ({
    ...(selection.file ? { file: selection.file } : {}),
    tagName: selection.tagName,
    text: selection.text,
    selector: selection.selector,
  }));

  return JSON.stringify({
    userRequest: input.userRequest.trim(),
    editIntent: input.editIntent ?? null,
    availableFiles: files,
    visualSelections,
  });
}

export function parseProjectContextSelection(
  rawContent: string,
  availableFiles: string[],
): Omit<EditContextSelection, 'source'> {
  const candidates = new Set(normalizeAvailableFiles(availableFiles));
  let value: unknown;

  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Project context selector output was not valid JSON.');
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.relevantFiles)) {
    throw new Error('Project context selector output must contain version 1 and relevantFiles.');
  }

  const files: string[] = [];
  for (const item of value.relevantFiles) {
    if (typeof item !== 'string') {
      throw new Error('Project context selector relevantFiles must contain strings only.');
    }
    const file = item.trim();
    if (!file || !candidates.has(file)) {
      throw new Error(`Project context selector returned an unavailable file: ${file || '<empty>'}`);
    }
    if (!files.includes(file)) files.push(file);
  }

  if (files.length > MAX_EDIT_CONTEXT_FILES) {
    throw new Error(
      `Project context selector may return at most ${MAX_EDIT_CONTEXT_FILES} files.`,
    );
  }

  let searchQuery: string | null = null;
  if (value.searchQuery !== null && value.searchQuery !== undefined) {
    if (typeof value.searchQuery !== 'string') {
      throw new Error('Project context selector searchQuery must be a string or null.');
    }
    searchQuery = value.searchQuery.trim();
    if (!searchQuery || searchQuery.length > MAX_CONTEXT_SEARCH_QUERY_LENGTH) {
      throw new Error(
        `Project context selector searchQuery must contain 1-${MAX_CONTEXT_SEARCH_QUERY_LENGTH} characters.`,
      );
    }
  }

  if (files.length === 0 && !searchQuery) {
    throw new Error('Project context selector must return relevantFiles or one searchQuery.');
  }

  const reason = typeof value.reason === 'string' ? value.reason.trim().slice(0, 400) : '';

  return {
    version: 1,
    relevantFiles: files,
    searchQuery,
    reason: reason || 'Selected the smallest relevant project context.',
  };
}

export function selectMappedVisualContextFiles(
  visualSelections: ProjectVisualSelection[],
  availableFiles: string[],
): string[] {
  const candidates = new Set(normalizeAvailableFiles(availableFiles));
  const selected: string[] = [];

  for (const selection of visualSelections) {
    const file = selection.file?.trim();
    if (!file || !candidates.has(file) || selected.includes(file)) continue;
    selected.push(file);
    if (selected.length >= MAX_EDIT_CONTEXT_FILES) break;
  }

  return selected;
}

function requestLooksStylingRelated(request: string): boolean {
  return /(颜色|配色|样式|间距|圆角|阴影|字体|排版|布局|视觉|高级|简洁|密度|color|style|spacing|radius|shadow|font|typography|layout|visual|theme|padding|margin)/i.test(
    request,
  );
}

function pathWords(file: string): string[] {
  return path.posix
    .basename(file, path.posix.extname(file))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3);
}

export function fallbackEditContextFiles(userRequest: string, availableFiles: string[]): string[] {
  const files = normalizeAvailableFiles(availableFiles);
  const request = userRequest.toLowerCase();
  const styling = requestLooksStylingRelated(userRequest);

  const ranked = files
    .map((file) => {
      let score = 0;
      const lower = file.toLowerCase();
      const base = path.posix.basename(lower, path.posix.extname(lower));
      if (base.length >= 3 && request.includes(base)) score += 10;
      for (const word of pathWords(file)) {
        if (request.includes(word)) score += 4;
      }
      if (lower.startsWith('src/pages/')) score += 2;
      if (lower.startsWith('src/components/product/')) score += 2;
      if (file === 'src/App.tsx') score += 1;
      if (styling && /(?:^|\/)(?:theme|styles?|index)\.css$/i.test(file)) score += 6;
      return { file, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file));

  const selected = ranked.slice(0, FALLBACK_CONTEXT_FILES).map((item) => item.file);
  const preferred = [
    'src/App.tsx',
    'src/routes.ts',
    'src/styles/theme.css',
    'src/index.css',
    'src/styles.css',
    'index.html',
  ];

  for (const file of preferred) {
    if (selected.length >= FALLBACK_CONTEXT_FILES) break;
    if (files.includes(file) && !selected.includes(file)) selected.push(file);
  }

  if (selected.length === 0) {
    const page = files.find((file) => file.startsWith('src/pages/'));
    selected.push(page ?? files[0]!);
  }

  return selected.slice(0, FALLBACK_CONTEXT_FILES);
}

function fallbackContextQuery(input: EditContextSelectionInput): string {
  if (!input.editIntent) return input.userRequest;
  return [
    input.userRequest,
    input.editIntent.summary,
    ...input.editIntent.targetHints,
    ...input.editIntent.directives.map((directive) => directive.directive),
  ].join(' ');
}

export async function selectProjectContextFiles(
  input: EditContextSelectionInput,
  availableFiles: string[],
): Promise<EditContextSelection> {
  const files = normalizeAvailableFiles(availableFiles);
  const visualFiles = selectMappedVisualContextFiles(input.visualSelections, files);

  if (visualFiles.length > 0) {
    return {
      version: 1,
      relevantFiles: visualFiles,
      searchQuery: null,
      reason: 'Used source-mapped Visual Edit targets as the edit context.',
      source: 'visual',
    };
  }

  try {
    const generation = await requestProjectContextSelection(
      buildProjectContextSelectionRequest(input, files),
    );
    return {
      ...parseProjectContextSelection(generation.content, files),
      source: 'model',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      version: 1,
      relevantFiles: fallbackEditContextFiles(fallbackContextQuery(input), files),
      searchQuery: null,
      reason: `Context selector fallback used after model selection failed: ${reason}`.slice(0, 400),
      source: 'fallback',
    };
  }
}
