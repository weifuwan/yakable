import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationWorkspace } from './ConversationWorkspace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConversationWorkspace', () => {
  it('renders user messages and assistant messages with separate roles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'user-1',
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
        initialPrompt="Who are you?"
        initialCreatedAt="2026-09-19T00:00:00Z"
      />,
    );

    expect(screen.getByText('Who are you?')).toBeTruthy();
    expect(await screen.findByLabelText('Assistant message')).toBeTruthy();
    expect(screen.getByLabelText('User message')).toBeTruthy();
    expect(screen.getByText('I am Yakable.')).toBeTruthy();
  });

  it('sends a new turn and appends both user and assistant messages', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              userMessage: {
                id: 'message-2',
                role: 'USER',
                content: 'Tell me more',
                createdAt: '2026-09-19T00:00:02Z',
              },
              assistantMessage: {
                id: 'message-3',
                role: 'ASSISTANT',
                content: 'Here is more.',
                createdAt: '2026-09-19T00:00:03Z',
              },
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'message-1',
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
        initialPrompt="Who are you?"
        initialCreatedAt="2026-09-19T00:00:00Z"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Send a message' });
    fireEvent.change(input, { target: { value: 'Tell me more' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Tell me more')).toBeTruthy();
    expect(await screen.findByText('Here is more.')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      content: 'Tell me more',
    });

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('uses the project prompt to start the first LLM turn after navigation', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              userMessage: {
                id: 'message-1',
                role: 'USER',
                content: 'Build a CRM dashboard',
                createdAt: '2026-09-19T00:00:00Z',
              },
              assistantMessage: {
                id: 'message-2',
                role: 'ASSISTANT',
                content: 'What should the dashboard include?',
                createdAt: '2026-09-19T00:00:01Z',
              },
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <ConversationWorkspace
        projectId="project-1"
        initialPrompt="Build a CRM dashboard"
        initialCreatedAt="2026-09-19T00:00:00Z"
      />,
    );

    expect(await screen.findByText('What should the dashboard include?')).toBeTruthy();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      content: 'Build a CRM dashboard',
    });
  });
});
