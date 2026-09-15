import { useMemo } from "react";

export type AgentRunKind = "CREATE" | "EDIT";
export type AgentRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type AgentStepStatus = "ACTIVE" | "COMPLETED" | "SKIPPED" | "FAILED";
export type AgentState =
  | "ROUTE"
  | "UNDERSTAND"
  | "DESIGN"
  | "TEMPLATE"
  | "GENERATE"
  | "WRITE"
  | "SELECT_CONTEXT"
  | "READ"
  | "EDIT"
  | "CHECK"
  | "RUNTIME"
  | "OBSERVE"
  | "CRITIQUE"
  | "REPAIR"
  | "DONE";

export interface AgentTimelineEvent {
  version: 1;
  sequence: number;
  state: AgentState;
  status: AgentStepStatus;
  message: string;
  at: string;
  iteration?: 0 | 1;
}

export interface AgentRunView {
  id: string;
  projectId: string;
  kind: AgentRunKind;
  status: AgentRunStatus;
  prompt: string;
  model?: string;
  summary?: string;
  startedAt: string;
  completedAt?: string;
  events: AgentTimelineEvent[];
}

interface ConversationLike {
  messages?: Array<{ agentRun?: AgentRunView }>;
}

const STATE_LABELS: Record<AgentState, string> = {
  ROUTE: "Route request",
  UNDERSTAND: "Understand request",
  DESIGN: "Design direction",
  TEMPLATE: "Select template",
  GENERATE: "Generate project",
  WRITE: "Write project",
  SELECT_CONTEXT: "Select context",
  READ: "Read project files",
  EDIT: "Edit project",
  CHECK: "Check project",
  RUNTIME: "Start runtime",
  OBSERVE: "Observe preview",
  CRITIQUE: "Critique result",
  REPAIR: "Repair project",
  DONE: "Complete",
};

export function extractAgentRunsFromConversation(conversation: unknown): AgentRunView[] {
  if (!conversation || typeof conversation !== "object") return [];
  const messages = (conversation as ConversationLike).messages;
  if (!Array.isArray(messages)) return [];

  const runs = new Map<string, AgentRunView>();
  for (const message of messages) {
    const run = message?.agentRun;
    if (!run?.id || !Array.isArray(run.events)) continue;
    runs.set(run.id, run);
  }

  return [...runs.values()].sort(
    (left, right) =>
      right.startedAt.localeCompare(left.startedAt) || right.id.localeCompare(left.id),
  );
}

function millisecondsBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return endMs - startMs;
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "";
  if (milliseconds < 1_000) return `${Math.max(1, Math.round(milliseconds))}ms`;
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

type TimelineItem = {
  key: string;
  state: AgentState;
  status: AgentStepStatus;
  startedAt: string;
  completedAt?: string;
  activeMessage?: string;
  message: string;
  iteration?: 0 | 1;
};

function timelineItems(events: AgentTimelineEvent[]): TimelineItem[] {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const items: TimelineItem[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index]!;
    if (event.status === "ACTIVE") {
      const next = ordered[index + 1];
      if (next && next.state === event.state && next.status !== "ACTIVE") {
        items.push({
          key: `${event.sequence}-${next.sequence}`,
          state: event.state,
          status: next.status,
          startedAt: event.at,
          completedAt: next.at,
          activeMessage: event.message,
          message: next.message,
          ...(event.iteration === undefined ? {} : { iteration: event.iteration }),
        });
        index += 1;
        continue;
      }
    }

    items.push({
      key: String(event.sequence),
      state: event.state,
      status: event.status,
      startedAt: event.at,
      message: event.message,
      ...(event.iteration === undefined ? {} : { iteration: event.iteration }),
    });
  }

  return items;
}

function statusDot(status: AgentStepStatus): string {
  if (status === "FAILED") return "bg-rose-500 ring-rose-100";
  if (status === "ACTIVE") return "animate-pulse bg-blue-500 ring-blue-100";
  if (status === "SKIPPED") return "bg-black/25 ring-black/[0.04]";
  return "bg-emerald-500 ring-emerald-100";
}

function statusText(status: AgentStepStatus): string {
  if (status === "FAILED") return "text-rose-700";
  if (status === "ACTIVE") return "text-blue-700";
  if (status === "SKIPPED") return "text-black/40";
  return "text-black/62";
}

function runLabel(run: AgentRunView): string {
  const prefix = run.kind === "CREATE" ? "Build" : "Edit";
  const prompt = run.prompt.replace(/\s+/g, " ").trim();
  return `${prefix} · ${prompt.length > 54 ? `${prompt.slice(0, 53)}…` : prompt}`;
}

export function AgentDetailsPanel({
  runs,
  selectedRunId,
  onSelectRun,
  onClose,
}: {
  runs: AgentRunView[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onClose: () => void;
}) {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const items = useMemo(
    () => (selectedRun ? timelineItems(selectedRun.events) : []),
    [selectedRun],
  );
  const runDuration = selectedRun
    ? formatDuration(millisecondsBetween(selectedRun.startedAt, selectedRun.completedAt))
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#2d2d2a]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <strong className="text-sm font-semibold">Details</strong>
          <span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/45">
            {selectedRun?.kind === "CREATE" ? "Build" : "Edit"}
          </span>
        </div>
        <button
          className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent text-black/45 transition hover:bg-black/[0.05] hover:text-black/75"
          type="button"
          aria-label="Close details"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-2.5">
        <div className="inline-flex rounded-full bg-black/[0.045] p-0.5 text-[11px] font-medium">
          <button className="rounded-full bg-white px-3 py-1 text-black/75 shadow-[0_1px_2px_rgba(15,23,42,0.06)]" type="button">
            Timeline
          </button>
          <button className="cursor-not-allowed rounded-full px-3 py-1 text-black/30" type="button" disabled title="Changes view is planned for the next iteration">
            Changes
          </button>
        </div>
        {runDuration ? <span className="text-[11px] text-black/42">{runDuration}</span> : null}
      </div>

      {runs.length > 1 ? (
        <div className="shrink-0 border-b border-black/[0.06] px-4 py-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-black/38" htmlFor="agent-run-select">
            Agent run
          </label>
          <select
            id="agent-run-select"
            className="h-9 w-full rounded-xl border border-black/[0.10] bg-white px-3 text-xs text-black/70 outline-none transition focus:border-[#5f83ee] focus:ring-2 focus:ring-[#5f83ee]/15"
            value={selectedRun?.id ?? ""}
            onChange={(event) => onSelectRun(event.target.value)}
          >
            {runs.map((run) => (
              <option key={run.id} value={run.id}>{runLabel(run)}</option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedRun ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5">
          <div className="mb-5 rounded-2xl border border-black/[0.07] bg-[#fafaf8] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/38">
                {selectedRun.kind === "CREATE" ? "Build request" : "Edit request"}
              </div>
              <div className={`text-[11px] font-medium ${selectedRun.status === "FAILED" ? "text-rose-700" : "text-black/45"}`}>
                {selectedRun.status.toLowerCase()}
              </div>
            </div>
            <p className="mb-0 mt-2 text-sm leading-6 text-black/72">{selectedRun.prompt}</p>
            {selectedRun.model ? (
              <div className="mt-2 text-[11px] text-black/38">{selectedRun.model}</div>
            ) : null}
          </div>

          <div className="relative pl-6">
            <div className="absolute bottom-3 left-[7px] top-3 w-px bg-black/[0.08]" aria-hidden="true" />
            <div className="space-y-5">
              {items.map((item) => {
                const duration = formatDuration(millisecondsBetween(item.startedAt, item.completedAt));
                return (
                  <article key={item.key} className="relative">
                    <span className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-4 ${statusDot(item.status)}`} aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <strong className="text-[13px] font-semibold text-black/78">{STATE_LABELS[item.state]}</strong>
                          {item.iteration === 1 ? (
                            <span className="rounded-full bg-black/[0.045] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-black/40">retry</span>
                          ) : null}
                        </div>
                        {item.activeMessage && item.activeMessage !== item.message ? (
                          <p className="mb-0 mt-1 text-xs leading-5 text-black/46">{item.activeMessage}</p>
                        ) : null}
                        <p className={`mb-0 mt-1 text-xs leading-5 ${statusText(item.status)}`}>{item.message}</p>
                      </div>
                      <div className="shrink-0 text-right text-[10px] leading-4 text-black/32">
                        {duration ? <div>{duration}</div> : null}
                        <div>{formatClock(item.startedAt)}</div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {selectedRun.summary ? (
            <div className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-black/38">Result</div>
              <p className="mb-0 mt-2 text-xs leading-5 text-black/62">{selectedRun.summary}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm text-black/42">
          No persisted agent run is available for this project yet.
        </div>
      )}
    </div>
  );
}
