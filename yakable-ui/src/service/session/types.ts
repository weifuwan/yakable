export type SessionRole = 'USER' | 'ASSISTANT';
export type SessionStatus = 'ACTIVE' | 'ARCHIVED';
export type TurnStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface SessionModel {
  provider: string;
  model: string;
}

export interface SessionInfo {
  id: string;
  projectId: string;
  title: string;
  model: SessionModel;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TurnTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface TurnInvocation {
  provider: string;
  model: string;
  usage: TurnTokenUsage | null;
  providerRequestId: string | null;
  finishReason: string | null;
}

export interface SessionTurn {
  id: string;
  status: TurnStatus;
  attemptCount: number;
  errorMessage: string | null;
  invocation: TurnInvocation | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  turnId: string;
  role: SessionRole;
  content: string;
  sequence: number;
  createdAt: string;
}

export interface SessionSnapshot {
  session: SessionInfo;
  turns: SessionTurn[];
  messages: SessionMessage[];
}

export interface SessionChanges {
  latestTurn: SessionTurn;
  messages: SessionMessage[];
  latestSequence: number;
}

export interface SessionMessagePage {
  messages: SessionMessage[];
  nextBeforeSequence: number | null;
  hasMore: boolean;
}

export interface TurnStartResult {
  turn: SessionTurn;
  userMessage: SessionMessage;
}
