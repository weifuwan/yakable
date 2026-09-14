import {
  MAX_EDIT_CONTEXT_FILES,
  fallbackEditContextFiles,
  type EditContextSelection,
} from './context-selection.js';
import { searchProjectTool, type SearchProjectMatch } from '../tools/search-project.js';

export function rankProjectSearchFiles(matches: SearchProjectMatch[]): string[] {
  const stats = new Map<string, { count: number; firstIndex: number }>();

  for (const [index, match] of matches.entries()) {
    const existing = stats.get(match.path);
    if (existing) {
      existing.count += 1;
    } else {
      stats.set(match.path, { count: 1, firstIndex: index });
    }
  }

  return [...stats.entries()]
    .sort((left, right) => {
      const countDiff = right[1].count - left[1].count;
      if (countDiff !== 0) return countDiff;
      return left[1].firstIndex - right[1].firstIndex;
    })
    .map(([file]) => file);
}

export async function resolveProjectContextSearch(
  projectDirectory: string,
  userRequest: string,
  availableFiles: string[],
  selection: EditContextSelection,
): Promise<EditContextSelection> {
  if (!selection.searchQuery) return selection;

  const search = await searchProjectTool.execute(
    {
      query: selection.searchQuery,
      paths: availableFiles,
      maxResults: 20,
    },
    { projectDirectory },
  );

  if (!search.ok) {
    if (selection.relevantFiles.length > 0) {
      return {
        ...selection,
        source: 'search',
        reason: `${selection.reason} Search could not run: ${search.error.message}`.slice(0, 400),
      };
    }

    return {
      version: 1,
      relevantFiles: fallbackEditContextFiles(userRequest, availableFiles),
      searchQuery: selection.searchQuery,
      reason: `Context search failed and deterministic fallback was used: ${search.error.message}`.slice(
        0,
        400,
      ),
      source: 'fallback',
    };
  }

  const searchedFiles = rankProjectSearchFiles(search.value.matches);
  const relevantFiles = [...selection.relevantFiles];
  for (const file of searchedFiles) {
    if (relevantFiles.length >= MAX_EDIT_CONTEXT_FILES) break;
    if (!relevantFiles.includes(file)) relevantFiles.push(file);
  }

  if (relevantFiles.length === 0) {
    return {
      version: 1,
      relevantFiles: fallbackEditContextFiles(userRequest, availableFiles),
      searchQuery: selection.searchQuery,
      reason: `Search for "${selection.searchQuery}" returned no matches; deterministic fallback was used.`.slice(
        0,
        400,
      ),
      source: 'fallback',
    };
  }

  return {
    ...selection,
    relevantFiles,
    source: 'search',
    reason: `${selection.reason} Searched for "${selection.searchQuery}" and added ${searchedFiles.length} matched file(s).`.slice(
      0,
      400,
    ),
  };
}
