export type Project = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
};

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      body?.error ?? `Project request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export function getDefaultProject(): Promise<Project> {
  return request<Project>("/api/projects/default");
}

export function getProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/projects/${encodeURIComponent(projectId)}`);
}
