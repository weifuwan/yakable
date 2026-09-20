import { ApiError, HttpUtils } from '../http';
import type {
  CreateProjectInput,
  ProjectDetails,
  ProjectPage,
  ProjectSummary,
} from './types';

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

function isProjectDetails(value: unknown): value is ProjectDetails {
  return (
    isProjectSummary(value) &&
    (value as ProjectDetails).status === 'CREATED' &&
    typeof (value as ProjectDetails).createdAt === 'string'
  );
}

function isProjectPage(value: unknown): value is ProjectPage {
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

async function queryProjectPage(
  current = 1,
  pageSize = 50,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    current: String(current),
    pageSize: String(pageSize),
  });
  const data = await HttpUtils.get<unknown>(
    '/api/projects?' + params.toString(),
    { signal },
  );
  return isProjectPage(data)
    ? data
    : invalidResponse('Project API returned an invalid page.', data);
}

async function queryProject(projectId: string, signal?: AbortSignal) {
  const data = await HttpUtils.get<unknown>(
    '/api/projects/' + encodeURIComponent(projectId),
    { signal },
  );
  return isProjectDetails(data)
    ? data
    : invalidResponse('Project API returned an invalid project.', data);
}

async function addProject(input: CreateProjectInput, signal?: AbortSignal) {
  const data = await HttpUtils.post<unknown>('/api/projects', input, { signal });
  return isProjectDetails(data)
    ? data
    : invalidResponse('Project API returned an invalid project.', data);
}

export const ProjectService = {
  queryProjectPage,
  queryProject,
  addProject,
};
