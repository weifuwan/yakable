import type {
  PersistedVisualSelection,
  ProjectConversation,
  ProjectRoute,
  ProjectTemplate,
} from "../../../api";

export type ActiveProject = {
  id: string;
  title: string;
  previewUrl: string;
  template: ProjectTemplate;
  routes: ProjectRoute[];
  summary?: string;
  model?: string;
  conversation?: ProjectConversation | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  createdAt?: string;
  visualSelections?: PersistedVisualSelection[];
};
