/**
 * TypeScript types mirroring the drizzle schema.
 * These are renderer-side types — actual DB access goes through IPC to main.
 */

export interface SceneObjectRow {
  id: string;
  path: string;
  parentPath: string | null;
  type: 'file' | 'folder';
  positionX: number;
  positionY: number;
  positionZ: number;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentStateRow {
  id: 'singleton';
  beliefs: string;
  desires: string;
  currentIntention: string | null;
  status: 'idle' | 'thinking' | 'acting' | 'paused';
  positionX: number;
  positionZ: number;
  updatedAt: number;
}

export interface InstructionRow {
  id: string;
  triggerPattern: string;
  actionDescription: string;
  embedding: ArrayBuffer | null;
  confidence: number;
  usageCount: number;
  lastUsed: number | null;
  isUserCreated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActionLogRow {
  id: string;
  timestamp: number;
  actionType: string;
  targetPath: string | null;
  parameters: string | null;
  result: 'success' | 'failure';
  errorMessage: string | null;
  intentionId: string | null;
  instructionId: string | null;
  beliefSnapshot: string | null;
  durationMs: number | null;
}

export interface ChatMessageRow {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  sessionId: string | null;
}

export interface ShortcutRow {
  action: string;
  keyCombo: string;
  isDefault: boolean;
}

export interface AppConfigRow {
  key: string;
  value: string;
  updatedAt: number;
}
