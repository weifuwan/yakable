import {
  ExternalLink,
  FileCode2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { useState } from 'react';

import type { AgentProjectSnapshot } from '../lib/agent-api';
import PreviewMockup from './PreviewMockup';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  viewport: PreviewViewport;
  onViewportChange: (viewport: PreviewViewport) => void;
  project?: AgentProjectSnapshot;
  changedFiles: string[];
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

export default function PreviewPanel({
  viewport,
  onViewportChange,
  project,
  changedFiles,
}: PreviewPanelProps) {
  const [revision, setRevision] = useState(0);
  const sourceReady = Boolean(project);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#f4f4f5]">
      <div className="flex h-12 flex-none items-center justify-between border-b border-zinc-200 bg-white px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-800">Preview</span>
          <span
            className={`hidden rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] sm:inline-flex ${
              sourceReady
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {sourceReady ? 'Source ready' : 'Mock'}
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
            onClick={() => setRevision((current) => current + 1)}
            title="Reload preview shell"
            aria-label="Reload preview shell"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <RefreshCw size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            disabled
            title="External sandbox previews arrive in PR 4"
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
          <span className="ml-auto hidden text-zinc-400 sm:inline">Live runtime arrives in PR 4</span>
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
              preview.yakable.local
            </div>
            <div className="w-[29px]" />
          </div>

          <div className="yakable-scrollbar h-[calc(100%-2.25rem)] overflow-auto">
            <PreviewMockup
              key={revision}
              compact={viewport === 'tablet'}
              mobile={viewport === 'mobile'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
