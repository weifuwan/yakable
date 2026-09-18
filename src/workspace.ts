export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  depth: number;
};

export type WorkspaceFile = {
  path: string;
  content: string;
};

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `Workspace request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listWorkspaceFiles(): Promise<WorkspaceEntry[]> {
  const result = await request<{
    workspaceId: string;
    entries: WorkspaceEntry[];
  }>("/api/workspace/tree");

  return result.entries;
}

export function readWorkspaceFile(path: string): Promise<WorkspaceFile> {
  return request<WorkspaceFile>(
    `/api/workspace/file?path=${encodeURIComponent(path)}`,
  );
}

export function writeWorkspaceFile(
  path: string,
  content: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/workspace/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

export function deleteWorkspaceFile(path: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/workspace/file?path=${encodeURIComponent(path)}`,
    { method: "DELETE" },
  );
}
