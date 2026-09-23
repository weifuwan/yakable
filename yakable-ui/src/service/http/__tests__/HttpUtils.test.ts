import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpUtils, setUnauthorizedHandler, type SseEvent } from '../HttpUtils';

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
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('HttpUtils', () => {
  it('returns API data for a successful request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse({ id: 'project-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(HttpUtils.get<{ id: string }>('/api/projects/project-1')).resolves.toEqual({
      id: 'project-1',
    });

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

  it('sends JSON PUT requests through the shared transport', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue(apiResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await HttpUtils.put('/api/users/me/password', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: 'old-password',
          newPassword: 'new-password',
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'csrf-token',
        },
      }),
    );
  });

  it('sends the CSRF cookie value for unsafe requests', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue(apiResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await HttpUtils.post('/api/auth/logout', {});

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'csrf-token',
        },
      }),
    );
  });

  it('bootstraps CSRF before an unsafe request when the cookie is missing', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/csrf') {
        document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
        return apiResponse('csrf-token');
      }
      return apiResponse({ id: 'project-1' });
    });
    vi.stubGlobal('fetch', fetchMock);

    await HttpUtils.post('/api/projects', { prompt: 'Build a CRM' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/csrf',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/projects',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': 'csrf-token',
        },
      }),
    );
  });

  it('notifies the app when an HTTP request becomes unauthorized', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(null, {
          code: 30001,
          message: 'Authentication required',
          status: 401,
        }),
      ),
    );

    await expect(HttpUtils.get('/api/projects')).rejects.toMatchObject({
      status: 401,
      code: 30001,
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(HttpUtils.get('/api/projects')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        kind: 'network',
        message: 'Unable to connect to server.',
      }),
    );
  });

  it('parses SSE events even when one event is split across chunks', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
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
