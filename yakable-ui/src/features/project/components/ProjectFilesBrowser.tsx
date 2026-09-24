import { useEffect, useState } from 'react';

import { ProjectService, type ProjectFile } from '@/service/project';

import { ProjectFilesTree } from './ProjectFilesTree';
import { ProjectFileViewer } from './ProjectFileViewer';

interface ProjectFilesBrowserProps {
  projectId: string;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ProjectFilesBrowser({ projectId }: ProjectFilesBrowserProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setFiles([]);
    setSelectedPath(null);
    setFile(null);
    setListError(null);
    setFileError(null);
    setListLoading(true);

    ProjectService.queryProjectFiles(projectId, controller.signal)
      .then((result) => setFiles(result.files))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListError(errorMessage(error, 'Failed to load project files.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });

    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    if (!selectedPath) {
      setFile(null);
      setFileError(null);
      setFileLoading(false);
      return;
    }

    const controller = new AbortController();

    setFile(null);
    setFileError(null);
    setFileLoading(true);

    ProjectService.queryProjectFile(projectId, selectedPath, controller.signal)
      .then(setFile)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFileError(errorMessage(error, 'Failed to load project file.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFileLoading(false);
      });

    return () => controller.abort();
  }, [projectId, selectedPath]);

  return (
    <section
      aria-label="Project files browser"
      className="flex h-full min-h-0 min-w-0 flex-col bg-surface"
    >
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">Files</span>
      </header>

      {listLoading ? (
        <output className="flex min-h-0 flex-1 items-center justify-center text-sm text-foreground-subtle">
          Loading files...
        </output>
      ) : listError ? (
        <div className="m-4 rounded-xl border border-danger-border-subtle bg-danger-surface px-4 py-3 text-sm text-danger-foreground" role="alert">
          {listError}
        </div>
      ) : files.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm text-foreground-subtle">
          No published files yet.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-52 shrink-0 min-h-0 flex-col border-r border-border">
            <ProjectFilesTree
              files={files}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center border-b border-border-quiet px-3">
              <span className="truncate text-xs text-foreground-muted">
                {selectedPath ?? 'Select a file'}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <ProjectFileViewer
                selectedPath={selectedPath}
                file={file}
                loading={fileLoading}
                error={fileError}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
