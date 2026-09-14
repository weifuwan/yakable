import { useEffect, useMemo, useRef, useState } from 'react';

import {
  subscribeFrontendAgentProgress,
  type FrontendAgentEvent,
  type FrontendAgentState,
} from '../frontend-agent';

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

function latestByState(events: FrontendAgentEvent[]): Map<FrontendAgentState, FrontendAgentEvent> {
  const result = new Map<FrontendAgentState, FrontendAgentEvent>();
  for (const event of events) result.set(event.state, event);
  return result;
}

function stateClass(event: FrontendAgentEvent | undefined): string {
  if (!event) return 'border-black/[0.06] bg-white text-black/30';
  if (event.status === 'ACTIVE') return 'border-black/15 bg-black/[0.04] text-black';
  if (event.status === 'FAILED') return 'border-red-200 bg-red-50 text-red-700';
  if (event.status === 'SKIPPED') return 'border-black/[0.08] bg-black/[0.025] text-black/45';
  return 'border-black/[0.08] bg-white text-black/65';
}

function dotClass(event: FrontendAgentEvent | undefined): string {
  if (!event) return 'bg-black/15';
  if (event.status === 'ACTIVE') return 'bg-black animate-pulse';
  if (event.status === 'FAILED') return 'bg-red-500';
  if (event.status === 'SKIPPED') return 'bg-black/25';
  return 'bg-black/55';
}

export function FrontendAgentActivity() {
  const [runId, setRunId] = useState('');
  const [events, setEvents] = useState<FrontendAgentEvent[]>([]);
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
        setEvents([detail.event]);
      } else {
        setEvents((currentEvents) => [...currentEvents, detail.event].slice(-60));
      }

      if (detail.event.state === 'DONE') {
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

  const latest = events.at(-1);
  const byState = useMemo(() => latestByState(events), [events]);
  const pipeline = useMemo(
    () => (events.some((event) => event.state === 'ROUTE') ? CREATE_PIPELINE : EDIT_PIPELINE),
    [events],
  );
  if (!visible || !runId || !latest) return null;

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-[100] w-[360px] rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
            Frontend Agent
          </div>
          <div className="mt-1 truncate text-sm font-medium text-black/80">{latest.message}</div>
        </div>
        <span className="mt-0.5 rounded-full border border-black/[0.08] px-2 py-0.5 text-[10px] font-medium text-black/45">
          v0
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {pipeline.map((state) => {
          const event = byState.get(state);
          return (
            <div
              key={state}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium ${stateClass(event)}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(event)}`} />
              <span className="truncate">{LABELS[state]}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
