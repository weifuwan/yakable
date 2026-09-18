import { requestJson } from '@/shared/api/client';

export async function cancelAgentRun(runId: string): Promise<void> {
  if (!runId.trim()) return;

  await requestJson<{ ok: true; runId: string; cancelled: boolean }>(
    `/api/agent-runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST', body: '{}' },
  );
}
