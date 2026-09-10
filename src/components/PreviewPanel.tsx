import {
  AlertTriangle,
  ExternalLink,
  FileCode2,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
  Tablet,
} from 'lucide-react';

import type {
  AgentProjectSnapshot,
  AgentRepairSummary,
  PreviewRuntimeSnapshot,
} from '../lib/agent-api';
import PreviewMockup from './PreviewMockup';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  viewport: PreviewViewport;
  onViewportChange: (viewport: PreviewViewport) => void;
  project?: AgentProjectSnapshot;
  runtime?: PreviewRuntimeSnapshot;
  repair?: AgentRepairSummary;
  changedFiles: string[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

const viewportWidths: Record<PreviewViewport, string> = {
  desktop: '100%',
  tablet: '820px',
  mobile: '390px',
};

const viewportOptions: Array<{
  value: PreviewViewport;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'tablet', label: 'Tablet', icon: Tablet },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
];

function runtimeBadge(
  project: AgentProjectSnapshot | undefined,
  runtime: PreviewRuntimeSnapshot | undefined,
  repair: AgentRepairSummary | undefined,
) {
  if (runtime?.status === 'ready' && repair?.attempted && repair.succeeded) {
    return { label: 'Auto-fixed', className: 'bg-violet-50 text-violet-700' };
  }

  if (runtime?.status === 'ready') {
    return { label: 'Live', className: 'bg-emerald-50 text-emerald-700' };
  }

  if (runtime?.status === 'error') {
    return { label: 'Runtime error', className: 'bg-rose-50 text-rose-700' };
  }

  if (runtime?.status === 'starting') {
    return { label: 'Starting', className: 'bg-sky-50 text-sky-700' };
  }

  if (project) {
    return { label: 'Source ready', className: 'bg-amber-50 text-amber-700' };
  }

  return { label: 'Mock', className: 'bg-zinc-100 text-zinc-600' };
}

export default function PreviewPanel({
  viewport,
  onViewportChange,
  project,
  runtime,
  repair,
  changedFiles,
  isRefreshing,
  onRefresh,
}: PreviewPanelProps) {
  const badge = runtimeBadge(project, runtime, repair);
  const previewUrl = runtime?.status === 'ready' ? runtime.previewUrl : undefined;
  const livePreview = Boolean(previewUrl);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#f4f4f5]">
      <div className="flex h-12 flex-none items-center justify-between border-b border-zinc-200 bg-white px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800">Preview</span>
          <span
            className={`hidden rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] sm:inline-flex ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {viewportOptions.map((option) => {
            const Icon = option.icon;
            const active = viewport === option.value;

            return (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                aria-pressed={active}
                onClick={() => onViewportChange(option.value)}
                className={`flex size-7 items-center justify-center rounded-md transition ${
                  active
                    ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5'
                    : 'text-zinc-400 hover:bg-white hover:text-zinc-700'
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={!project || isRefreshing}
            title={runtime?.status === 'error' ? 'Repair preview with Agent' : 'Synchronize and reload preview'}
            aria-label={runtime?.status === 'error' ? 'Repair preview with Agent' : 'Synchronize and reload preview'}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            <RefreshCw
              className={isRefreshing ? 'animate-spin' : undefined}
              size={14}
              strokeWidth={1.8}
            />
          </button>
          <button
            type="button"
            disabled
            title="A dedicated external preview origin is intentionally deferred"
            aria-label="Open preview in new tab"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300"
          >
            <ExternalLink size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {project ? (
        <div className="flex h-9 flex-none items-center gap-2 border-b border-zinc-200 bg-white px-4 text-[10px] text-zinc-500">
          <FileCode2 size={13} strokeWidth={1.8} className="text-zinc-700" />
          <span className="font-medium text-zinc-700">{project.files.length} project files</span>
          {changedFiles.length > 0 ? (
            <>
              <span className="text-zinc-300">·</span>
              <span className="truncate">Changed: {changedFiles.join(', ')}</span>
            </>
          ) : null}
          {repair?.attempted ? (
            <span
              className={`ml-auto hidden items-center gap-1 sm:inline-flex ${
                repair.succeeded ? 'text-violet-600' : 'text-rose-600'
              }`}
            >
              <Sparkles size={11} strokeWidth={1.8} />
              {repair.succeeded
                ? `Auto-repaired in ${repair.attempts}`
                : `${repair.attempts} repair ${repair.attempts === 1 ? 'attempt' : 'attempts'}`}
            </span>
          ) : runtime?.status === 'ready' ? (
            <span className="ml-auto hidden text-emerald-600 sm:inline">
              Runtime revision {runtime.revision}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        <div
          className="mx-auto h-full min-h-[480px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_18px_55px_rgba(24,24,27,0.08)] transition-[width] duration-300"
          style={{ width: viewportWidths[viewport], maxWidth: '100%' }}
        >
          <div className="flex h-9 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3">
            <div className="flex gap-1.5">
              <span className="size-2 rounded-full bg-zinc-300" />
              <span className="size-2 rounded-full bg-zinc-300" />
              <span className="size-2 rounded-full bg-zinc-300" />
            </div>
            <div className="mx-auto flex h-6 max-w-sm flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-2 text-[9px] text-zinc-400">
              {livePreview ? `preview/${project?.id}` : 'preview.yakable.local'}
            </div>
            <div className="w-[29px]" />
          </div>

          <div className="relative h-[calc(100%-2.25rem)] overflow-hidden bg-white">
            {previewUrl ? (
              <iframe
                key={`${project?.id ?? 'preview'}-${runtime?.revision ?? 0}`}
                title="Yakable generated app preview"
                src={previewUrl}
                sandbox="allow-scripts allow-forms allow-modals"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0 bg-white"
              />
            ) : runtime?.status === 'error' ? (
              <div className="grid h-full min-h-[440px] place-items-center bg-zinc-50 px-6">
                <div className="max-w-lg text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                    <AlertTriangle size={18} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-900">Preview validation failed</h3>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500">
                    {runtime.error ?? 'The generated source is saved, but the controlled Vite runtime could not validate it.'}
                  </p>
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {isRefreshing ? (
                      <LoaderCircle className="animate-spin" size={13} strokeWidth={1.8} />
                    ) : (
                      <Sparkles size={13} strokeWidth={1.8} />
                    )}
                    {isRefreshing ? 'Repairing...' : 'Repair with Agent'}
                  </button>
                </div>
              </div>
            ) : project ? (
              <div className="grid h-full min-h-[440px] place-items-center bg-zinc-50">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <LoaderCircle className="animate-spin" size={15} strokeWidth={1.8} />
                  Validating live preview...
                </div>
              </div>
            ) : (
              <div className="yakable-scrollbar h-full overflow-auto">
                <PreviewMockup
                  compact={viewport === 'tablet'}
                  mobile={viewport === 'mobile'}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
