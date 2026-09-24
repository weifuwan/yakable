import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpUtils } from '@/service/http';

import { ProjectService } from '../ProjectService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectService', () => {
  it('loads published Project file paths from the encoded Project endpoint', async () => {
    const files = { files: ['package.json', 'src/App.tsx'] };
    const get = vi.spyOn(HttpUtils, 'get').mockResolvedValue(files);

    await expect(ProjectService.queryProjectFiles('project 1')).resolves.toEqual(files);

    expect(get).toHaveBeenCalledWith('/api/projects/project%201/files', {
      signal: undefined,
    });
  });

  it('loads one Project file on demand with an encoded relative path', async () => {
    const file = {
      path: 'src/App.tsx',
      content: 'export default function App() {}',
    };
    const get = vi.spyOn(HttpUtils, 'get').mockResolvedValue(file);

    await expect(ProjectService.queryProjectFile('project 1', 'src/App.tsx')).resolves.toEqual(
      file,
    );

    expect(get).toHaveBeenCalledWith('/api/projects/project%201/files/content?path=src%2FApp.tsx', {
      signal: undefined,
    });
  });

  it('rejects an invalid Project file list response as a parse error', async () => {
    vi.spyOn(HttpUtils, 'get').mockResolvedValue({ files: ['package.json', 1] });

    await expect(ProjectService.queryProjectFiles('project-1')).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'parse',
    });
  });

  it('rejects invalid Project file content as a parse error', async () => {
    vi.spyOn(HttpUtils, 'get').mockResolvedValue({ path: 'src/App.tsx' });

    await expect(ProjectService.queryProjectFile('project-1', 'src/App.tsx')).rejects.toMatchObject(
      {
        name: 'ApiError',
        kind: 'parse',
      },
    );
  });
});
