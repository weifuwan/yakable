import { useEffect, useMemo, useState } from "react";

import type {
  AgentItemStatus,
  AgentProgressState,
  AgentProtocolItem,
} from "@/features/agent-run/model/agent-protocol";

export type AgentRunKind = "CREATE" | "EDIT";
export type AgentRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type AgentFileChangeType = "ADDED" | "MODIFIED" | "DELETED";

export interface AgentFileChangeView {
  path: string;
  type: AgentFileChangeType;
  beforeContent: string | null;
  afterContent: string | null;
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
  items: AgentProtocolItem[];
  turnDiff?: {
    files: AgentFileChangeView[];
    unifiedDiff: string;
    addedLines: number;
    removedLines: number;
  } | null;
}

interface ConversationLike {
  messages?: Array<{ agentRun?: AgentRunView }>;
}

const STATE_LABELS: Record<AgentProgressState, string> = {
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
    if (!run?.id || !Array.isArray(run.items)) continue;
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

function statusDot(status: AgentItemStatus): string {
  if (status === "FAILED") return "bg-rose-500 ring-rose-100";
  if (status === "ACTIVE") return "animate-pulse bg-blue-500 ring-blue-100";
  if (status === "SKIPPED") return "bg-black/25 ring-black/[0.04]";
  return "bg-emerald-500 ring-emerald-100";
}

function statusText(status: AgentItemStatus): string {
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

function itemTitle(item: AgentProtocolItem): string {
  if (item.type === "progress") return STATE_LABELS[item.state];
  if (item.type === "tool_call") return `Tool · ${item.toolName}`;
  if (item.type === "file_change") return "File change";
  if (item.type === "command_execution") return `Command · ${item.phase ?? "execution"}`;
  if (item.type === "check_result") return `Check · ${item.result}`;
  return "Agent message";
}

function itemDetails(item: AgentProtocolItem): string[] {
  if (item.type === "tool_call") {
    return [item.inputSummary, item.outputSummary].filter((value): value is string => Boolean(value));
  }
  if (item.type === "file_change") {
    return item.files.map((file) => `${file.changeType[0]}  ${file.path}`);
  }
  if (item.type === "command_execution") {
    return [
      item.command,
      item.exitCode === undefined ? undefined : `exit ${item.exitCode ?? "null"}`,
      item.timedOut ? "timed out" : undefined,
      item.outputTruncated ? "output truncated" : undefined,
    ].filter((value): value is string => Boolean(value));
  }
  if (item.type === "check_result") {
    return [
      ...item.checks.map((check) => `${check.phase}: ${check.status}`),
      item.diagnosticCount ? `${item.diagnosticCount} diagnostic(s)` : undefined,
    ].filter((value): value is string => Boolean(value));
  }
  if (item.type === "agent_message") return [item.content];
  return item.iteration === undefined ? [] : [`iteration ${item.iteration}`];
}

function fileName(filePath: string): string {
  return filePath.split("/").filter(Boolean).at(-1) ?? filePath;
}

function changeBadge(type: AgentFileChangeType): string {
  if (type === "ADDED") return "A";
  if (type === "DELETED") return "D";
  return "M";
}

function changeBadgeClass(type: AgentFileChangeType): string {
  if (type === "ADDED") return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
  if (type === "DELETED") return "bg-rose-50 text-rose-700 ring-rose-600/10";
  return "bg-amber-50 text-amber-700 ring-amber-600/10";
}

function lineCount(content: string | null): number {
  if (!content) return 0;
  return content.replace(/\r\n/g, "\n").split("\n").length;
}

function SourcePane({ title, content }: { title: string; content: string | null }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-black/[0.06] bg-[#fafaf8] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-black/38">
        {title}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre p-3 font-mono text-[11px] leading-5 text-[#3b3b38]">
        {content ?? "∅"}
      </pre>
    </section>
  );
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
  const [activeTab, setActiveTab] = useState<"timeline" | "changes">("timeline");
  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(null);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;
  const items = selectedRun?.items ?? [];
  const changes = useMemo(
    () => [...(selectedRun?.turnDiff?.files ?? [])],
    [selectedRun?.turnDiff],
  );
  const selectedChange = changes.find((change) => change.path === selectedChangePath) ?? changes[0] ?? null;
  const runDuration = selectedRun
    ? formatDuration(millisecondsBetween(selectedRun.startedAt, selectedRun.completedAt))
    : "";

  useEffect(() => {
    setSelectedChangePath(changes[0]?.path ?? null);
  }, [selectedRun?.id]);

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
          <button
            className={`rounded-full px-3 py-1 transition ${activeTab === "timeline" ? "bg-white text-black/75 shadow-[0_1px_2px_rgba(15,23,42,0.06)]" : "text-black/42 hover:text-black/65"}`}
            type="button"
            onClick={() => setActiveTab("timeline")}
          >
            Items{items.length ? ` ${items.length}` : ""}
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${activeTab === "changes" ? "bg-white text-black/75 shadow-[0_1px_2px_rgba(15,23,42,0.06)]" : "text-black/42 hover:text-black/65"}`}
            type="button"
            onClick={() => setActiveTab("changes")}
          >
            Changes{changes.length ? ` ${changes.length}` : ""}
          </button>
        </div>
        {activeTab === "changes" && selectedRun?.turnDiff ? (
          <span className="text-[11px] font-medium">
            <span className="text-emerald-700">+{selectedRun.turnDiff.addedLines}</span>
            <span className="ml-1.5 text-rose-700">−{selectedRun.turnDiff.removedLines}</span>
          </span>
        ) : runDuration ? (
          <span className="text-[11px] text-black/42">{runDuration}</span>
        ) : null}
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

      {selectedRun && activeTab === "timeline" ? (
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
            {selectedRun.model ? <div className="mt-2 text-[11px] text-black/38">{selectedRun.model}</div> : null}
          </div>

          <div className="relative pl-6">
            <div className="absolute bottom-3 left-[7px] top-3 w-px bg-black/[0.08]" aria-hidden="true" />
            <div className="space-y-5">
              {items.map((item) => {
                const duration = formatDuration(millisecondsBetween(item.startedAt, item.completedAt));
                const details = itemDetails(item);
                return (
                  <article key={item.id} className="relative">
                    <span className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-4 ${statusDot(item.status)}`} aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-[13px] font-semibold text-black/78">{itemTitle(item)}</strong>
                          <span className="rounded-full bg-black/[0.045] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-black/38">{item.type.replace("_", " ")}</span>
                        </div>
                        <p className={`mb-0 mt-1 text-xs leading-5 ${statusText(item.status)}`}>{item.message}</p>
                        {details.length ? (
                          <div className="mt-1.5 space-y-0.5 font-mono text-[10px] leading-4 text-black/38">
                            {details.map((detail, index) => <div key={`${item.id}-${index}`} className="truncate">{detail}</div>)}
                          </div>
                        ) : null}
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
        </div>
      ) : selectedRun && activeTab === "changes" ? (
        changes.length ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-black/[0.06] bg-[#fafaf8] py-2">
              <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/35">Turn diff</div>
              {changes.map((change) => {
                const active = selectedChange?.path === change.path;
                return (
                  <button
                    key={change.path}
                    className={`flex w-full items-start gap-2 border-0 px-3 py-2.5 text-left transition ${active ? "bg-white shadow-[inset_2px_0_0_#5578e8]" : "bg-transparent hover:bg-black/[0.035]"}`}
                    type="button"
                    onClick={() => setSelectedChangePath(change.path)}
                  >
                    <span className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[9px] font-bold ring-1 ring-inset ${changeBadgeClass(change.type)}`}>
                      {changeBadge(change.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-black/68">{fileName(change.path)}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-black/32">{change.path}</span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
              {selectedChange ? (
                <>
                  <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-3.5">
                    <div className="min-w-0 truncate font-mono text-[11px] font-semibold text-black/62">{selectedChange.path}</div>
                    <div className="shrink-0 text-[10px] text-black/35">
                      {lineCount(selectedChange.beforeContent)} → {lineCount(selectedChange.afterContent)} lines
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 divide-x divide-black/[0.06] overflow-hidden">
                    <SourcePane title="Before" content={selectedChange.beforeContent} />
                    <SourcePane title="After" content={selectedChange.afterContent} />
                  </div>
                </>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-black/38">No source changes for this run.</div>
        )
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-black/38">No Agent run selected.</div>
      )}
    </div>
  );
}
