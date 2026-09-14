import type { Tool, ToolContext, ToolResult } from './tool.js';
import { readProjectFileTool } from './read-project-file.js';

export const SEARCH_PROJECT_MAX_FILES = 500;
export const SEARCH_PROJECT_MAX_RESULTS = 20;
export const SEARCH_PROJECT_MAX_QUERY_LENGTH = 120;

export interface SearchProjectInput {
  query: string;
  paths: string[];
  maxResults?: number;
}

export interface SearchProjectMatch {
  path: string;
  line: number;
  column: number;
  snippet: string;
}

export interface SearchProjectOutput {
  query: string;
  matches: SearchProjectMatch[];
  scannedFiles: number;
  truncated: boolean;
}

function failure(code: string, message: string): ToolResult<SearchProjectOutput> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeInput(input: unknown): ToolResult<SearchProjectOutput> | SearchProjectInput {
  if (!isRecord(input) || typeof input.query !== 'string' || !Array.isArray(input.paths)) {
    return failure('INVALID_INPUT', 'search_project requires a string query and a paths array.');
  }

  const query = input.query.trim();
  if (!query || query.length > SEARCH_PROJECT_MAX_QUERY_LENGTH) {
    return failure(
      'INVALID_QUERY',
      `search_project query must contain 1-${SEARCH_PROJECT_MAX_QUERY_LENGTH} characters.`,
    );
  }

  const paths: string[] = [];
  for (const value of input.paths) {
    if (typeof value !== 'string' || !value.trim()) {
      return failure('INVALID_PATHS', 'search_project paths must contain non-empty strings only.');
    }
    const normalized = value.trim();
    if (!paths.includes(normalized)) paths.push(normalized);
  }

  if (paths.length === 0 || paths.length > SEARCH_PROJECT_MAX_FILES) {
    return failure(
      'INVALID_PATHS',
      `search_project requires between 1 and ${SEARCH_PROJECT_MAX_FILES} candidate paths.`,
    );
  }

  const maxResults = input.maxResults === undefined ? SEARCH_PROJECT_MAX_RESULTS : input.maxResults;
  if (
    typeof maxResults !== 'number' ||
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > SEARCH_PROJECT_MAX_RESULTS
  ) {
    return failure(
      'INVALID_MAX_RESULTS',
      `search_project maxResults must be an integer between 1 and ${SEARCH_PROJECT_MAX_RESULTS}.`,
    );
  }

  return { query, paths, maxResults };
}

function buildSnippet(line: string, matchColumn: number, queryLength: number): string {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) return normalized;

  const start = Math.max(0, matchColumn - 80);
  const end = Math.min(normalized.length, matchColumn + queryLength + 120);
  return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
}

export const searchProjectTool: Tool<unknown, SearchProjectOutput> = {
  name: 'search_project',
  description: 'Search readable frontend project text files for a case-insensitive literal string.',

  async execute(input: unknown, context: ToolContext): Promise<ToolResult<SearchProjectOutput>> {
    const normalized = normalizeInput(input);
    if ('ok' in normalized) return normalized;

    const needle = normalized.query.toLowerCase();
    const matches: SearchProjectMatch[] = [];
    let scannedFiles = 0;
    let truncated = false;

    for (const filePath of normalized.paths) {
      const read = await readProjectFileTool.execute(
        { path: filePath },
        { projectDirectory: context.projectDirectory },
      );
      if (!read.ok) continue;

      scannedFiles += 1;
      const lines = read.value.content.split(/\r?\n/);

      for (const [index, line] of lines.entries()) {
        let fromIndex = 0;
        const lowerLine = line.toLowerCase();

        while (fromIndex <= lowerLine.length) {
          const column = lowerLine.indexOf(needle, fromIndex);
          if (column === -1) break;

          matches.push({
            path: read.value.path,
            line: index + 1,
            column: column + 1,
            snippet: buildSnippet(line, column, normalized.query.length),
          });

          if (matches.length >= normalized.maxResults!) {
            truncated = true;
            return {
              ok: true,
              value: {
                query: normalized.query,
                matches,
                scannedFiles,
                truncated,
              },
            };
          }

          fromIndex = column + Math.max(needle.length, 1);
        }
      }
    }

    return {
      ok: true,
      value: {
        query: normalized.query,
        matches,
        scannedFiles,
        truncated,
      },
    };
  },
};
