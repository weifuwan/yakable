export type SessionRole = 'USER' | 'ASSISTANT';
export type SessionStatus = 'ACTIVE' | 'ARCHIVED';
export type TurnStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

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

export interface SessionTurn {
  id: string;
  status: TurnStatus;
  errorMessage: string | null;
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

export interface TurnStartResult {
  turn: SessionTurn;
  userMessage: SessionMessage;
}
