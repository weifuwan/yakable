export type Project = {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
};

export async function getCurrentProject(): Promise<Project> {
  const response = await fetch("/api/project/current");

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      body?.error ?? `Project request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<Project>;
}
