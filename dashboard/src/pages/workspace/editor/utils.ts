import type {
  PersistedVisualSelection,
  ProjectConversation,
  ProjectRoute,
} from "../../../api";
import type { PreviewSelection } from "../../../visual-edit-context";
import type { ChatMessage } from "./types";

export const SUGGESTION_PROMPTS = [
  "Polish this page",
  "Improve the mobile layout",
  "Refine the copy",
  "Add subtle interactions",
];

export const DEFAULT_CHAT_WIDTH = 45.3;
export const MIN_CHAT_WIDTH = 17;
export const MAX_CHAT_WIDTH = 70;
export const FALLBACK_ROUTES: ProjectRoute[] = [{ path: "/", title: "Home" }];

export function clampChatWidth(value: number) {
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, value));
}

export function buildPreviewUrl(runtimeUrl: string, routePath: string): string {
  const url = new URL(runtimeUrl, window.location.origin);
  url.pathname = routePath || "/";
  return url.toString();
}

export function formatMessageTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (sameDay) return `Today at ${time}`;

  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${day} at ${time}`;
}

export function sourceLabel(selection: PersistedVisualSelection): string {
  if (!selection.file || !selection.line) {
    return selection.selector || `Selected ${selection.tagName}`;
  }
  const file = selection.file.split("/").filter(Boolean).at(-1) || selection.file;
  return `Line ${selection.line} in ${file}`;
}

export function persistedSelection(
  selection: PreviewSelection,
): PersistedVisualSelection {
  return {
    ...(selection.sourceId ? { sourceId: selection.sourceId } : {}),
    ...(selection.source?.file ? { file: selection.source.file } : {}),
    ...(selection.source?.line ? { line: selection.source.line } : {}),
    ...(selection.source?.column ? { column: selection.source.column } : {}),
    tagName: selection.tagName,
    text: selection.text,
    selector: selection.selector,
  };
}

export function conversationMessages(
  conversation: ProjectConversation | null | undefined,
  fallbackSummary?: string,
): ChatMessage[] {
  if (conversation?.messages.length) {
    return conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content:
        message.role === "assistant" && message.changedFiles?.length
          ? `${message.content}\nChanged: ${message.changedFiles.join(", ")}`
          : message.content,
      createdAt: message.createdAt,
      visualSelections: message.visualSelections,
    }));
  }

  return [
    {
      id: "workspace-initial-assistant",
      role: "assistant",
      content:
        fallbackSummary ||
        "Project is running. Tell Yakable what you want to change.",
    },
  ];
}
