import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationWorkspace } from './ConversationWorkspace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConversationWorkspace', () => {
  it('renders user messages on the user side and assistant messages on the assistant side', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'initial-project-1',
            role: 'USER',
            content: 'Who are you?',
            createdAt: '2026-09-19T00:00:00Z',
          },
          {
            id: 'assistant-1',
            role: 'ASSISTANT',
            content: 'I am Yakable.',
            createdAt: '2026-09-19T00:00:01Z',
          },
        ],
      }),
    );

    render(
      <ConversationWorkspace
        projectId="project-1"
        projectName="Who are you?"
        initialPrompt="Who are you?"
        initialCreatedAt="2026-09-19T00:00:00Z"
      />,
    );

    expect(screen.getByText('Who are you?')).toBeTruthy();

    expect(
      await screen.findByLabelText('Assistant message'),
    ).toBeTruthy();
    expect(screen.getByLabelText('User message')).toBeTruthy();
    expect(screen.getByText('I am Yakable.')).toBeTruthy();
  });

  it('sends a new user message and keeps it in the conversation', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: 'message-2',
              role: 'USER',
              content: 'Tell me more',
              createdAt: '2026-09-19T00:00:02Z',
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'initial-project-1',
              role: 'USER',
              content: 'Who are you?',
              createdAt: '2026-09-19T00:00:00Z',
            },
          ],
        };
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <ConversationWorkspace
        projectId="project-1"
        projectName="Who are you?"
        initialPrompt="Who are you?"
        initialCreatedAt="2026-09-19T00:00:00Z"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Send a message' });
    fireEvent.change(input, { target: { value: 'Tell me more' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Tell me more')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      content: 'Tell me more',
    });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });
});
