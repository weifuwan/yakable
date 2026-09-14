export type PreviewSelectionSource = {
  file: string;
  line: number;
  column: number;
};

export type PreviewSelection = {
  id: string;
  sourceId?: string;
  source?: PreviewSelectionSource;
  tagName: string;
  text: string;
  selector: string;
  rect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type UserEditMessageSubmittedDetail = {
  prompt: string;
  createdAt: string;
  selections: PreviewSelection[];
};

type PreviewSelectionMessage = {
  source: "yakable-preview";
  type: "yakable:selection-change";
  selections: unknown;
};

export const USER_EDIT_MESSAGE_SUBMITTED_EVENT = "yakable:user-edit-message-submitted";

const DASHBOARD_SOURCE = "yakable-dashboard";
const PREVIEW_SOURCE = "yakable-preview";
const MAX_SELECTIONS = 20;
const MAX_PROMPT_SELECTIONS = 10;
let latestSelections: PreviewSelection[] = [];
let selectionFrame: WindowProxy | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPreviewFrame(): HTMLIFrameElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLIFrameElement>('iframe[title$=" preview"]');
}

function normalizeSource(value: unknown): PreviewSelectionSource | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.file !== "string" ||
    !Number.isInteger(value.line) ||
    !Number.isInteger(value.column)
  ) {
    return undefined;
  }

  const file = value.file.trim();
  const line = Number(value.line);
  const column = Number(value.column);
  if (!file || line <= 0 || column <= 0) return undefined;
  return { file, line, column };
}

function normalizeSelection(value: unknown): PreviewSelection | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.tagName !== "string" ||
    typeof value.text !== "string" ||
    typeof value.selector !== "string"
  ) {
    return null;
  }

  const source = normalizeSource(value.source);
  return {
    id: value.id.slice(0, 120),
    sourceId:
      typeof value.sourceId === "string" && value.sourceId.trim()
        ? value.sourceId.trim().slice(0, 120)
        : undefined,
    source,
    tagName: value.tagName.slice(0, 80),
    text: value.text.slice(0, 180),
    selector: value.selector.slice(0, 320),
  };
}

function normalizeSelections(value: unknown): PreviewSelection[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_SELECTIONS)
    .map(normalizeSelection)
    .filter((selection): selection is PreviewSelection => Boolean(selection));
}

function cloneSelections(value: PreviewSelection[]): PreviewSelection[] {
  return value.map((selection) => ({
    ...selection,
    source: selection.source ? { ...selection.source } : undefined,
    rect: selection.rect ? { ...selection.rect } : undefined,
  }));
}

function handlePreviewMessage(event: MessageEvent<PreviewSelectionMessage>) {
  const frame = getPreviewFrame();
  if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (
    !message ||
    message.source !== PREVIEW_SOURCE ||
    message.type !== "yakable:selection-change"
  ) {
    return;
  }

  selectionFrame = frame.contentWindow;
  latestSelections = normalizeSelections(message.selections);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", handlePreviewMessage);
}

export function getCurrentPreviewSelections(): PreviewSelection[] {
  const currentFrame = getPreviewFrame()?.contentWindow ?? null;
  if (!currentFrame || currentFrame !== selectionFrame) return [];
  return cloneSelections(latestSelections);
}

export function announceUserEditMessageSubmitted(
  prompt: string,
  selections: PreviewSelection[],
): UserEditMessageSubmittedDetail {
  const detail: UserEditMessageSubmittedDetail = {
    prompt: prompt.trim(),
    createdAt: new Date().toISOString(),
    selections: cloneSelections(selections),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<UserEditMessageSubmittedDetail>(USER_EDIT_MESSAGE_SUBMITTED_EVENT, {
        detail,
      }),
    );
  }

  return detail;
}

export function clearCurrentPreviewSelections(): void {
  latestSelections = [];
  const frame = getPreviewFrame();
  selectionFrame = frame?.contentWindow ?? null;
  frame?.contentWindow?.postMessage(
    { source: DASHBOARD_SOURCE, type: "yakable:clear-selections" },
    "*",
  );
}

type VisualSelectionInstance = {
  runtimeId: string;
  text: string;
  selector: string;
};

type VisualSelectionTarget = {
  sourceId?: string;
  file: string;
  line: number;
  column: number;
  tagName: string;
  instanceCount: number;
  instances: VisualSelectionInstance[];
};

function buildMappedTargets(selections: PreviewSelection[]): VisualSelectionTarget[] {
  const grouped = new Map<string, VisualSelectionTarget>();

  for (const selection of selections) {
    if (!selection.source) continue;
    const { file, line, column } = selection.source;
    const key = selection.sourceId || `${file}:${line}:${column}:${selection.tagName}`;
    const current = grouped.get(key);
    const instance = {
      runtimeId: selection.id,
      text: selection.text,
      selector: selection.selector,
    };

    if (current) {
      current.instanceCount += 1;
      current.instances.push(instance);
      continue;
    }

    grouped.set(key, {
      sourceId: selection.sourceId,
      file,
      line,
      column,
      tagName: selection.tagName,
      instanceCount: 1,
      instances: [instance],
    });
  }

  return [...grouped.values()];
}

export function buildVisualEditPrompt(
  userRequest: string,
  selections: PreviewSelection[] = getCurrentPreviewSelections(),
): string {
  const request = userRequest.trim();
  if (!request || selections.length === 0) return request;

  const contextSelections = selections.slice(0, MAX_PROMPT_SELECTIONS);
  const targets = buildMappedTargets(contextSelections);
  const unmappedSelections = contextSelections
    .filter((selection) => !selection.source)
    .map((selection) => ({
      runtimeId: selection.id,
      tagName: selection.tagName,
      text: selection.text,
      selector: selection.selector,
    }));

  const envelope = {
    userRequest: request,
    visualSelections: {
      selectedCount: selections.length,
      contextSelectionCount: contextSelections.length,
      truncated: selections.length > contextSelections.length,
      mappedTargetCount: targets.length,
      targets,
      unmappedSelections,
    },
  };

  return [
    "[[YAKABLE_VISUAL_EDIT_REQUEST]]",
    JSON.stringify(envelope),
    "[[/YAKABLE_VISUAL_EDIT_REQUEST]]",
  ].join("\n");
}
