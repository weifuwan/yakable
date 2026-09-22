import { ApiError, HttpUtils } from '../http';
import type { CreateProjectInput, ProjectSummary } from './types';

interface PageData<T> {
  records: T[];
  total: number;
  pages: number;
  current: number;
  pageSize: number;
}

interface PageQuery {
  current: number;
  pageSize: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.latestSessionId === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isProjectPageData(value: unknown): value is PageData<ProjectSummary> {
  return (
    isRecord(value) &&
    Array.isArray(value.records) &&
    value.records.every(isProjectSummary) &&
    typeof value.total === 'number' &&
    typeof value.pages === 'number' &&
    typeof value.current === 'number' &&
    typeof value.pageSize === 'number'
  );
}

function invalidResponse(message: string, data: unknown): never {
  throw new ApiError(message, { kind: 'parse', data });
}

async function queryProject(
  query: PageQuery,
  signal?: AbortSignal,
): Promise<PageData<ProjectSummary>> {
  const params = new URLSearchParams({
    current: String(query.current),
    pageSize: String(query.pageSize),
  });
  const data = await HttpUtils.get<unknown>('/api/projects?' + params.toString(), { signal });
  return isProjectPageData(data)
    ? data
    : invalidResponse('Project API returned invalid PageData.', data);
}

async function addProject(input: CreateProjectInput, signal?: AbortSignal) {
  const data = await HttpUtils.post<unknown>('/api/projects', input, { signal });
  return isProjectSummary(data)
    ? data
    : invalidResponse('Project API returned an invalid project.', data);
}

export const ProjectService = {
  queryProject,
  addProject,
};
