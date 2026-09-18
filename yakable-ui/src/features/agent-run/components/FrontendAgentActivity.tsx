import { useEffect, useMemo, useRef, useState } from 'react';

import {
  subscribeFrontendAgentProgress,
  type FrontendAgentEvent,
  type FrontendAgentState,
} from '@/features/agent-run/model/frontend-agent';

const LABELS: Record<FrontendAgentState, string> = {
  ROUTE: 'Route',
  UNDERSTAND: 'Understand',
  DESIGN: 'Design',
  TEMPLATE: 'Template',
  GENERATE: 'Generate',
  WRITE: 'Write',
  SELECT_CONTEXT: 'Context',
  READ: 'Read',
  EDIT: 'Edit',
  CHECK: 'Check',
  RUNTIME: 'Runtime',
  OBSERVE: 'Observe',
  CRITIQUE: 'Critique',
  REPAIR: 'Repair',
  DONE: 'Done',
};

const CREATE_PIPELINE: FrontendAgentState[] = [
  'ROUTE',
  'UNDERSTAND',
  'DESIGN',
  'TEMPLATE',
  'GENERATE',
  'WRITE',
  'CHECK',
  'REPAIR',
  'RUNTIME',
  'DONE',
];

const EDIT_PIPELINE: FrontendAgentState[] = [
  'SELECT_CONTEXT',
  'READ',
  'EDIT',
  'CHECK',
  'OBSERVE',
  'CRITIQUE',
  'REPAIR',
  'DONE',
];

type ProgressItem = Extract<FrontendAgentEvent, { type: 'progress' }>;

function latestByState(items: FrontendAgentEvent[]): Map<FrontendAgentState, ProgressItem> {
  const result = new Map<FrontendAgentState, ProgressItem>();
  for (const item of items) {
    if (item.type === 'progress') result.set(item.state, item);
  }
  return result;
}

function stateClass(item: ProgressItem | undefined): string {
  if (!item) return 'border-black/[0.06] bg-white text-black/30';
  if (item.status === 'ACTIVE') return 'border-black/15 bg-black/[0.04] text-black';
  if (item.status === 'FAILED') return 'border-red-200 bg-red-50 text-red-700';
  if (item.status === 'SKIPPED') return 'border-black/[0.08] bg-black/[0.025] text-black/45';
  return 'border-black/[0.08] bg-white text-black/65';
}

function dotClass(item: ProgressItem | undefined): string {
  if (!item) return 'bg-black/15';
  if (item.status === 'ACTIVE') return 'bg-black animate-pulse';
  if (item.status === 'FAILED') return 'bg-red-500';
  if (item.status === 'SKIPPED') return 'bg-black/25';
  return 'bg-black/55';
}

function itemLabel(item: FrontendAgentEvent): string {
  if (item.type === 'tool_call') return `Tool · ${item.toolName}`;
  if (item.type === 'file_change') return `Files · ${item.files.length}`;
  if (item.type === 'command_execution') return `Command · ${item.phase ?? 'run'}`;
  if (item.type === 'check_result') return `Check · ${item.result}`;
  if (item.type === 'agent_message') return 'Agent message';
  return LABELS[item.state];
}

function itemTone(item: FrontendAgentEvent): string {
  if (item.status === 'FAILED') return 'text-red-700';
  if (item.status === 'ACTIVE') return 'text-blue-700';
  return 'text-black/62';
}

export function FrontendAgentActivity() {
  const [runId, setRunId] = useState('');
  const [items, setItems] = useState<FrontendAgentEvent[]>([]);
  const [visible, setVisible] = useState(false);
  const runIdRef = useRef('');
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeFrontendAgentProgress((detail) => {
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      setVisible(true);
      if (runIdRef.current !== detail.runId) {
        runIdRef.current = detail.runId;
        setRunId(detail.runId);
        setItems([detail.item]);
      } else {
        setItems((current) => {
          const index = current.findIndex((item) => item.id === detail.item.id);
          if (index === -1) return [...current, detail.item].slice(-80);
          const next = [...current];
          next[index] = detail.item;
          return next;
        });
      }

      if (detail.item.type === 'progress' && detail.item.state === 'DONE') {
        hideTimer.current = window.setTimeout(() => {
          setVisible(false);
          hideTimer.current = null;
        }, 4500);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const latest = items.at(-1);
  const byState = useMemo(() => latestByState(items), [items]);
  const pipeline = useMemo(
    () => (items.some((item) => item.type === 'progress' && item.state === 'ROUTE')
      ? CREATE_PIPELINE
      : EDIT_PIPELINE),
    [items],
  );
  const structured = useMemo(
    () => items.filter((item) => item.type !== 'progress').slice(-4),
    [items],
  );
  if (!visible || !runId || !latest) return null;

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-[100] w-[380px] rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
            Agent Runtime
          </div>
          <div className="mt-1 truncate text-sm font-medium text-black/80">{latest.message}</div>
        </div>
        <span className="mt-0.5 rounded-full border border-black/[0.08] px-2 py-0.5 text-[10px] font-medium text-black/45">
          protocol v1
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {pipeline.map((state) => {
          const item = byState.get(state);
          return (
            <div
              key={state}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium ${stateClass(item)}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(item)}`} />
              <span className="truncate">{LABELS[state]}</span>
            </div>
          );
        })}
      </div>

      {structured.length ? (
        <div className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-2.5">
          {structured.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-[10px] leading-4">
              <span className="min-w-[88px] shrink-0 font-semibold text-black/40">{itemLabel(item)}</span>
              <span className={`min-w-0 flex-1 truncate ${itemTone(item)}`}>{item.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
