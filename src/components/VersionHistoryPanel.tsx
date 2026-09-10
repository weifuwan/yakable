import {
  ChevronRight,
  FileDiff,
  History,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  getProjectVersionDiff,
  type ProjectVersionDiff,
  type ProjectVersionSummary,
} from '../lib/agent-api';

interface VersionHistoryPanelProps {
  projectId?: string;
  versions: ProjectVersionSummary[];
  currentVersionId?: string;
  isRollingBack: boolean;
  onRollback: (version: ProjectVersionSummary) => void;
}

function versionMeta(version: ProjectVersionSummary) {
  if (version.origin === 'rollback' && version.sourceVersionId) {
    return `Rollback from ${version.sourceVersionId}`;
  }
  if (version.origin === 'repair') {
    return 'Preview repair';
  }
  return 'Agent change';
}

export default function VersionHistoryPanel({
  projectId,
  versions,
  currentVersionId,
  isRollingBack,
  onRollback,
}: VersionHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [diff, setDiff] = useState<ProjectVersionDiff>();
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string>();

  const selectedVersion = versions.find((version) => version.id === selectedId);

  useEffect(() => {
    if (!open || versions.length === 0) {
      return;
    }

    if (!selectedId || !versions.some((version) => version.id === selectedId)) {
      setSelectedId(versions[0].id);
    }
  }, [open, selectedId, versions]);

  useEffect(() => {
    if (!open || !projectId || !selectedId) {
      return;
    }

    let cancelled = false;
    setLoadingDiff(true);
    setDiff(undefined);
    setDiffError(undefined);

    void getProjectVersionDiff(projectId, selectedId)
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDiffError(error instanceof Error ? error.message : 'Could not load version diff.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDiff(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId, selectedId]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!projectId || versions.length === 0}
        onClick={() => setOpen((current) => !current)}
        title="Version history"
        aria-label="Version history"
        aria-expanded={open}
        className="relative flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300"
      >
        <History size={14} strokeWidth={1.8} />
        {versions.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-3.5 items-center justify-center rounded-full bg-zinc-950 px-1 text-[8px] font-semibold leading-3.5 text-white">
            {versions.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-40 flex h-[520px] w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(24,24,27,0.18)]">
          <aside className="w-[260px] flex-none border-r border-zinc-200 bg-zinc-50/70">
            <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4">
              <div>
                <p className="text-xs font-semibold text-zinc-900">Version history</p>
                <p className="text-[9px] text-zinc-400">Stable live snapshots only</p>
              </div>
            </div>
            <div className="yakable-scrollbar h-[calc(100%-3rem)] overflow-y-auto p-2">
              {versions.map((version) => {
                const active = version.id === selectedId;
                const current = version.id === currentVersionId;

                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedId(version.id)}
                    className={`mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-zinc-300 bg-white shadow-sm'
                        : 'border-transparent hover:border-zinc-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900">v{version.number}</span>
                      {current ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-700">
                          Current
                        </span>
                      ) : null}
                      <ChevronRight className="ml-auto text-zinc-300" size={12} strokeWidth={1.8} />
                    </div>
                    <p className="mt-1.5 truncate text-[10px] font-medium text-zinc-600">
                      {version.label}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[9px] text-zinc-400">
                      <span>{versionMeta(version)}</span>
                      <span className="text-emerald-600">+{version.additions}</span>
                      <span className="text-rose-600">-{version.deletions}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4">
              <div className="flex min-w-0 items-center gap-2">
                <FileDiff size={14} strokeWidth={1.8} className="flex-none text-zinc-600" />
                <span className="truncate text-xs font-semibold text-zinc-900">
                  {selectedVersion ? `v${selectedVersion.number} · ${selectedVersion.label}` : 'Version diff'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close version history"
                className="flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>

            <div className="yakable-scrollbar h-[calc(100%-6.5rem)] overflow-y-auto p-4">
              {loadingDiff ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
                  <LoaderCircle className="animate-spin" size={14} strokeWidth={1.8} />
                  Loading diff...
                </div>
              ) : diffError ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                  {diffError}
                </div>
              ) : diff ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>{diff.files.length} changed files</span>
                    <span className="font-medium text-emerald-600">+{diff.additions}</span>
                    <span className="font-medium text-rose-600">-{diff.deletions}</span>
                    <span className="ml-auto">
                      {diff.against ? `Compared with v${diff.against.number}` : 'First stable version'}
                    </span>
                  </div>

                  {diff.files.map((file) => (
                    <article key={file.path} className="overflow-hidden rounded-xl border border-zinc-200">
                      <header className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                        <span className="truncate font-mono text-[10px] font-medium text-zinc-700">
                          {file.path}
                        </span>
                        <span className="ml-auto text-[9px] font-medium text-emerald-600">+{file.additions}</span>
                        <span className="text-[9px] font-medium text-rose-600">-{file.deletions}</span>
                      </header>
                      <div className="grid gap-px bg-zinc-200 lg:grid-cols-2">
                        <div className="min-w-0 bg-white p-3">
                          <p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-rose-500">Before</p>
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[9px] leading-4 text-zinc-500">
                            {file.beforePreview.length > 0 ? file.beforePreview.join('\n') : '—'}
                          </pre>
                        </div>
                        <div className="min-w-0 bg-white p-3">
                          <p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-emerald-600">After</p>
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[9px] leading-4 text-zinc-700">
                            {file.afterPreview.length > 0 ? file.afterPreview.join('\n') : '—'}
                          </pre>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="flex h-[4.5rem] items-center justify-between border-t border-zinc-200 px-4">
              <p className="max-w-[280px] text-[9px] leading-4 text-zinc-400">
                Rollback creates a new version instead of deleting later history.
              </p>
              <button
                type="button"
                disabled={!selectedVersion || selectedVersion.id === currentVersionId || isRollingBack}
                onClick={() => selectedVersion && onRollback(selectedVersion)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {isRollingBack ? (
                  <LoaderCircle className="animate-spin" size={12} strokeWidth={1.8} />
                ) : (
                  <RotateCcw size={12} strokeWidth={1.8} />
                )}
                {isRollingBack ? 'Rolling back...' : selectedVersion ? `Rollback to v${selectedVersion.number}` : 'Rollback'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
