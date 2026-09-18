export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  depth: number;
};

export type WorkspaceFile = {
  projectId: string;
  workspaceId: string;
  path: string;
  content: string;
};

export type WorkspaceStatus = {
  projectId: string;
  workspaceId: string;
  pristine: boolean;
};

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      body?.error ?? `Workspace request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

function workspaceUrl(projectId: string, path: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/workspace${path}`;
}

export function getWorkspaceStatus(
  projectId: string,
): Promise<WorkspaceStatus> {
  return request<WorkspaceStatus>(workspaceUrl(projectId, "/status"));
}

export async function listWorkspaceFiles(
  projectId: string,
): Promise<WorkspaceEntry[]> {
  const result = await request<{
    projectId: string;
    workspaceId: string;
    entries: WorkspaceEntry[];
  }>(workspaceUrl(projectId, "/tree"));

  return result.entries;
}

export function readWorkspaceFile(
  projectId: string,
  path: string,
): Promise<WorkspaceFile> {
  return request<WorkspaceFile>(
    `${workspaceUrl(projectId, "/file")}?path=${encodeURIComponent(path)}`,
  );
}

export function writeWorkspaceFile(
  projectId: string,
  path: string,
  content: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(workspaceUrl(projectId, "/file"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

export function deleteWorkspaceFile(
  projectId: string,
  path: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `${workspaceUrl(projectId, "/file")}?path=${encodeURIComponent(path)}`,
    { method: "DELETE" },
  );
}
