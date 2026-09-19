import type { ConversationMessage } from '../types';

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === 'string' &&
    (message.role === 'USER' || message.role === 'ASSISTANT') &&
    typeof message.content === 'string' &&
    typeof message.createdAt === 'string'
  );
}

async function readJson(response: Response, errorMessage: string) {
  try {
    return await response.json() as unknown;
  } catch (error) {
    throw new Error(errorMessage, { cause: error });
  }
}

export async function getConversationMessages(
  projectId: string,
  signal?: AbortSignal,
): Promise<ConversationMessage[]> {
  let response: Response;

  try {
    response = await fetch(
      '/api/projects/' + encodeURIComponent(projectId) + '/messages',
      {
        headers: {
          Accept: 'application/json',
        },
        signal,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to load conversation.', { cause: error });
  }

  if (!response.ok) {
    throw new Error(
      'Unable to load conversation (HTTP ' + response.status + ').',
    );
  }

  const data = await readJson(
    response,
    'Conversation API returned invalid JSON.',
  );

  if (!Array.isArray(data) || !data.every(isConversationMessage)) {
    throw new Error('Conversation API returned an invalid response.');
  }

  return data;
}

export async function sendConversationMessage(
  projectId: string,
  content: string,
): Promise<ConversationMessage> {
  let response: Response;

  try {
    response = await fetch(
      '/api/projects/' + encodeURIComponent(projectId) + '/messages',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      },
    );
  } catch (error) {
    throw new Error('Unable to send message.', { cause: error });
  }

  if (!response.ok) {
    throw new Error('Unable to send message (HTTP ' + response.status + ').');
  }

  const data = await readJson(
    response,
    'Conversation API returned invalid JSON.',
  );

  if (!isConversationMessage(data)) {
    throw new Error('Conversation API returned an invalid message.');
  }

  return data;
}
