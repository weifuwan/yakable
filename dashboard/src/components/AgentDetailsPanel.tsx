import { useEffect, useMemo, useState } from "react";

export type AgentRunKind = "CREATE" | "EDIT";
export type AgentRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type AgentStepStatus = "ACTIVE" | "COMPLETED" | "SKIPPED" | "FAILED";
export type AgentFileChangeType = "ADDED" | "MODIFIED" | "DELETED";
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

export interface AgentFileChangeView {
  ordinal: number;
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
  events: AgentTimelineEvent[];
  changes?: AgentFileChangeView[];
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

type DiffLine = {
  type: "context" | "add" | "remove";
  text: string;
  oldLine?: number;
  newLine?: number;
};

type DiffRenderRow = DiffLine | { type: "skip"; count: number; key: string };

function contentLines(content: string | null): string[] {
  if (content === null || content.length === 0) return [];
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}

function fallbackLineDiff(before: string[], after: string[]): DiffLine[] {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (let index = 0; index < prefix; index += 1) {
    result.push({ type: "context", text: before[index]!, oldLine: oldLine++, newLine: newLine++ });
  }
  for (let index = prefix; index < before.length - suffix; index += 1) {
    result.push({ type: "remove", text: before[index]!, oldLine: oldLine++ });
  }
  for (let index = prefix; index < after.length - suffix; index += 1) {
    result.push({ type: "add", text: after[index]!, newLine: newLine++ });
  }
  for (let index = 0; index < suffix; index += 1) {
    result.push({
      type: "context",
      text: before[before.length - suffix + index]!,
      oldLine: oldLine++,
      newLine: newLine++,
    });
  }
  return result;
}

function buildLineDiff(beforeContent: string | null, afterContent: string | null): DiffLine[] {
  const before = contentLines(beforeContent);
  const after = contentLines(afterContent);
  const cells = (before.length + 1) * (after.length + 1);
  if (cells > 120_000) return fallbackLineDiff(before, after);

  const matrix = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      matrix[left]![right] = before[left] === after[right]
        ? matrix[left + 1]![right + 1]! + 1
        : Math.max(matrix[left + 1]![right]!, matrix[left]![right + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let left = 0;
  let right = 0;
  let oldLine = 1;
  let newLine = 1;

  while (left < before.length || right < after.length) {
    if (left < before.length && right < after.length && before[left] === after[right]) {
      result.push({ type: "context", text: before[left]!, oldLine: oldLine++, newLine: newLine++ });
      left += 1;
      right += 1;
      continue;
    }

    const removeScore = left < before.length ? matrix[left + 1]![right]! : -1;
    const addScore = right < after.length ? matrix[left]![right + 1]! : -1;
    if (left < before.length && (right >= after.length || removeScore >= addScore)) {
      result.push({ type: "remove", text: before[left]!, oldLine: oldLine++ });
      left += 1;
    } else if (right < after.length) {
      result.push({ type: "add", text: after[right]!, newLine: newLine++ });
      right += 1;
    }
  }

  return result;
}

function compactDiff(lines: DiffLine[], contextSize = 3): DiffRenderRow[] {
  const changed = lines
    .map((line, index) => (line.type === "context" ? -1 : index))
    .filter((index) => index >= 0);
  if (!changed.length) return lines;

  const visible = new Set<number>();
  for (const index of changed) {
    for (
      let current = Math.max(0, index - contextSize);
      current <= Math.min(lines.length - 1, index + contextSize);
      current += 1
    ) {
      visible.add(current);
    }
  }

  const result: DiffRenderRow[] = [];
  let index = 0;
  while (index < lines.length) {
    if (visible.has(index)) {
      result.push(lines[index]!);
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && !visible.has(index)) index += 1;
    result.push({ type: "skip", count: index - start, key: `skip-${start}-${index}` });
  }
  return result;
}

function diffStats(change: AgentFileChangeView): { added: number; removed: number } {
  const lines = buildLineDiff(change.beforeContent, change.afterContent);
  return {
    added: lines.filter((line) => line.type === "add").length,
    removed: lines.filter((line) => line.type === "remove").length,
  };
}

function DiffRow({ row }: { row: DiffRenderRow }) {
  if (row.type === "skip") {
    return (
      <div className="grid grid-cols-[42px_42px_20px_minmax(0,1fr)] border-y border-black/[0.05] bg-[#f8f8f6] text-[10px] text-black/35">
        <span />
        <span />
        <span className="py-1.5 text-center">···</span>
        <span className="py-1.5">{row.count} unchanged lines</span>
      </div>
    );
  }

  const background = row.type === "add"
    ? "bg-emerald-50/80"
    : row.type === "remove"
      ? "bg-rose-50/80"
      : "bg-white";
  const marker = row.type === "add" ? "+" : row.type === "remove" ? "−" : " ";
  const markerColor = row.type === "add"
    ? "text-emerald-700"
    : row.type === "remove"
      ? "text-rose-700"
      : "text-black/20";

  return (
    <div className={`grid min-h-6 grid-cols-[42px_42px_20px_minmax(0,1fr)] font-mono text-[11px] leading-6 ${background}`}>
      <span className="select-none border-r border-black/[0.045] pr-2 text-right text-black/25">{row.oldLine ?? ""}</span>
      <span className="select-none border-r border-black/[0.045] pr-2 text-right text-black/25">{row.newLine ?? ""}</span>
      <span className={`select-none text-center font-semibold ${markerColor}`}>{marker}</span>
      <span className="overflow-x-visible whitespace-pre pr-4 text-[#3b3b38]">{row.text || " "}</span>
    </div>
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
  const items = useMemo(
    () => (selectedRun ? timelineItems(selectedRun.events) : []),
    [selectedRun],
  );
  const changes = useMemo(
    () => [...(selectedRun?.changes ?? [])].sort((left, right) => left.ordinal - right.ordinal),
    [selectedRun],
  );
  const selectedChange = changes.find((change) => change.path === selectedChangePath) ?? changes[0] ?? null;
  const selectedDiff = useMemo(
    () => selectedChange ? buildLineDiff(selectedChange.beforeContent, selectedChange.afterContent) : [],
    [selectedChange],
  );
  const renderedDiff = useMemo(() => compactDiff(selectedDiff), [selectedDiff]);
  const selectedStats = useMemo(
    () => selectedChange
      ? {
          added: selectedDiff.filter((line) => line.type === "add").length,
          removed: selectedDiff.filter((line) => line.type === "remove").length,
        }
      : { added: 0, removed: 0 },
    [selectedChange, selectedDiff],
  );
  const runStats = useMemo(
    () => changes.reduce(
      (total, change) => {
        const stats = diffStats(change);
        total.added += stats.added;
        total.removed += stats.removed;
        return total;
      },
      { added: 0, removed: 0 },
    ),
    [changes],
  );
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
            Timeline
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${activeTab === "changes" ? "bg-white text-black/75 shadow-[0_1px_2px_rgba(15,23,42,0.06)]" : "text-black/42 hover:text-black/65"}`}
            type="button"
            onClick={() => setActiveTab("changes")}
          >
            Changes{changes.length ? ` ${changes.length}` : ""}
          </button>
        </div>
        {activeTab === "changes" && changes.length ? (
          <span className="text-[11px] font-medium">
            <span className="text-emerald-700">+{runStats.added}</span>
            <span className="ml-1.5 text-rose-700">−{runStats.removed}</span>
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
      ) : selectedRun && activeTab === "changes" ? (
        changes.length ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="w-[210px] shrink-0 overflow-y-auto border-r border-black/[0.06] bg-[#fafaf8] py-2">
              <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-black/35">
                Files changed
              </div>
              {changes.map((change) => {
                const stats = diffStats(change);
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
                      <span className="mt-1 block text-[9px] font-medium">
                        <span className="text-emerald-700">+{stats.added}</span>
                        <span className="ml-1.5 text-rose-700">−{stats.removed}</span>
                      </span>
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
                    <div className="shrink-0 text-[10px] font-medium">
                      <span className="text-emerald-700">+{selectedStats.added}</span>
                      <span className="ml-1.5 text-rose-700">−{selectedStats.removed}</span>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto bg-white">
                    {renderedDiff.length ? (
                      <div className="min-w-max py-2">
                        {renderedDiff.map((row, index) => (
                          <DiffRow
                            key={row.type === "skip" ? row.key : `${index}-${row.type}-${row.oldLine ?? ""}-${row.newLine ?? ""}`}
                            row={row}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-black/38">
                        This file changed but contains no displayable text lines.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <div className="text-sm font-medium text-black/58">No persisted source diff</div>
              <p className="mb-0 mt-2 text-xs leading-5 text-black/38">
                Runs completed before Changes persistence was added can still be inspected in Timeline.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm text-black/42">
          No persisted agent run is available for this project yet.
        </div>
      )}
    </div>
  );
}
