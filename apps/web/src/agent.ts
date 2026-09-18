export type AgentRunResult = {
  projectId: string;
  changedFiles: string[];
};

export async function runAgent(
  projectId: string,
  prompt: string,
): Promise<AgentRunResult> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/agent/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      body?.error ?? `Agent request failed: ${response.status}`,
    );
  }

  return response.json() as Promise<AgentRunResult>;
}
