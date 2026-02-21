// ── File Tree ────────────────────────────────────────────

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension: string | null;
  sizeBytes: number;
  modifiedAt: number;
  children?: FileNode[];
  position: [number, number, number];
  metadata?: Record<string, unknown>;
}

// ── File System Events ──────────────────────────────────

export interface FileChangeEventStat {
  id: string;
  name: string;
  extension: string | null;
  sizeBytes: number;
  modifiedAt: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  fileInfo?: FileChangeEventStat;
}

// ── Settings ────────────────────────────────────────────

export interface AppSettings {
  llm: LLMConfig;
  theme: 'dark' | 'light';
  cameraSpeed: number;
  lastOpenedFolder: string | null;
}

export interface LLMConfig {
  apiEndpoint: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPromptOverride: string | null;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Agent ───────────────────────────────────────────────

export enum AgentState {
  Idle = 'idle',
  Thinking = 'thinking',
  Acting = 'acting',
  Error = 'error',
  WaitingApproval = 'waiting-approval',
}

export interface AgentStep {
  id: string;
  description: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'running' | 'done' | 'failed' | 'rejected';
  result?: string;
  error?: string;
}

// ── IPC Bridge ──────────────────────────────────────────

export interface DaxAPI {
  openFolder(): Promise<string | null>;
  readDirectory(path: string): Promise<FileNode[]>;
  statFile(path: string): Promise<FileNode | null>;
  readFileContent(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<string>;
  writeFileContent(path: string, content: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(path: string, newName: string): Promise<void>;
  openExternal(path: string): Promise<void>;
  onFileChange(callback: (event: FileChangeEvent) => void): () => void;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  testLLMConnection(config: LLMConfig): Promise<boolean>;
  sendLLMMessage(messages: LLMMessage[], config: LLMConfig): Promise<string>;
  abortLLM(): Promise<void>;
}
