import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  HttpUtils,
  type SseEvent,
} from '../HttpUtils';

function apiResponse(
  data: unknown,
  {
    code = 0,
    message = 'Success',
    status = 200,
  }: {
    code?: number;
    message?: string;
    status?: number;
  } = {},
) {
  return new Response(
    JSON.stringify({
      code,
      message,
      data,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpUtils', () => {
  it('returns API data for a successful request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      apiResponse({ id: 'project-1' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      HttpUtils.get<{ id: string }>('/api/projects/project-1'),
    ).resolves.toEqual({ id: 'project-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }),
    );
  });

  it('reports a business error returned by the API envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(
          { reason: 'invalid state' },
          {
            code: 40001,
            message: 'Project cannot be created.',
          },
        ),
      ),
    );

    await expect(HttpUtils.get('/api/projects')).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'business',
      code: 40001,
      message: 'Project cannot be created.',
    });
  });

  it('reports an HTTP error with the server error payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(null, {
          code: 50001,
          message: 'Server error.',
          status: 500,
        }),
      ),
    );

    await expect(HttpUtils.get('/api/projects')).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'http',
      status: 500,
      code: 50001,
      message: 'Server error.',
    });
  });

  it('reports a network error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('offline')),
    );

    await expect(HttpUtils.get('/api/projects')).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        kind: 'network',
        message: 'Unable to connect to server.',
      }),
    );
  });

  it('parses SSE events even when one event is split across chunks', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: delta\r\ndata: {"content":"Hel',
      'lo"}\r\n\r\nevent: complete\r\ndata: {"turnId":"turn-1"}\r\n\r\n',
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              chunks.forEach((chunk) => {
                controller.enqueue(encoder.encode(chunk));
              });
              controller.close();
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      ),
    );

    const events: SseEvent[] = [];

    await HttpUtils.postSse(
      '/api/sessions/session-1/turns/stream',
      { content: 'Hello' },
      (event) => {
        events.push(event);
      },
    );

    expect(events).toEqual([
      {
        event: 'delta',
        data: { content: 'Hello' },
      },
      {
        event: 'complete',
        data: { turnId: 'turn-1' },
      },
    ]);
  });
});
