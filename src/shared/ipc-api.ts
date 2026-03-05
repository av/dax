import type { FileEntry, FileStat, SearchResult, ValidationResult } from './file-types';
import type { FSEvent, FSEventBatch } from './events';
import type { AgentStateRow, InstructionRow, ActionLogRow, ChatMessageRow, ShortcutRow } from '../renderer/db/types';

/** Context passed alongside an agent prompt */
export interface AgentContext {
  workspacePath?: string;
  beliefs?: Record<string, unknown>;
  fileCount?: number;
  selectedFiles?: string[];
}

/** A structured response from the agent LLM */
export interface AgentResponse {
  message: string;
  actions?: Array<{
    type: 'organize' | 'search' | 'create' | 'move' | 'rename' | 'delete' | 'none';
    targetPath?: string;
    destinationPath?: string;
    name?: string;
    query?: string;
    reason: string;
  }>;
  reasoning?: string;
}

/**
 * All IPC channels and their request→response type signatures.
 * This is the single typed contract between main and renderer processes.
 */
export interface DaxAPI {
  // ── Directory ──
  'dialog:selectDirectory': () => Promise<string | null>;

  // ── Config ──
  'config:get': (key: string) => Promise<string | null>;
  'config:set': (key: string, value: string) => Promise<void>;

  // ── Filesystem ──
  'fs:scan': (dirPath: string, maxDepth: number) => Promise<FileEntry[]>;
  'fs:stat': (filePath: string) => Promise<FileStat>;
  'fs:create': (filePath: string, type: 'file' | 'folder') => Promise<void>;
  'fs:rename': (oldPath: string, newPath: string) => Promise<void>;
  'fs:move': (sourcePath: string, targetDir: string) => Promise<void>;
  'fs:delete': (filePath: string) => Promise<void>;
  'fs:open': (filePath: string) => Promise<void>;
  'fs:readText': (filePath: string, maxBytes: number) => Promise<string>;
  'fs:search': (
    query: string,
    dir: string,
    mode: 'name' | 'content',
  ) => Promise<SearchResult[]>;
  'fs:folderSize': (dirPath: string) => Promise<number>;
  'fs:validateName': (name: string) => Promise<ValidationResult>;

  // ── Watcher ──
  'watcher:start': (dirPath: string) => Promise<void>;
  'watcher:stop': () => Promise<void>;
  // Push channel: main→renderer (not request/response)
  'watcher:events': (batch: FSEventBatch) => void;

  // ── Scene DB ──
  'db:scene:getAll': () => Promise<SceneObjectRow[]>;
  'db:scene:upsert': (obj: SceneObjectRow) => Promise<void>;
  'db:scene:upsertBatch': (objs: SceneObjectRow[]) => Promise<void>;
  'db:scene:delete': (path: string) => Promise<void>;
  'db:scene:deleteOrphans': (validPaths: string[]) => Promise<number>;

  // ── App ──
  'app:getVersion': () => Promise<string>;
  'app:getPlatform': () => Promise<NodeJS.Platform>;
  'app:getDataPath': () => Promise<string>;

  // ── Agent ──
  'agent:prompt': (sessionId: string, message: string, context: AgentContext) => Promise<AgentResponse>;
  'agent:createSession': () => Promise<string>;
  'agent:health': () => Promise<boolean>;

  // ── Agent DB ──
  'db:agent:getState': () => Promise<AgentStateRow | null>;
  'db:agent:saveState': (state: AgentStateRow) => Promise<void>;
  'db:agent:getInstructions': () => Promise<InstructionRow[]>;
  'db:agent:saveInstruction': (inst: InstructionRow) => Promise<void>;
  'db:agent:deleteInstruction': (id: string) => Promise<void>;
  'db:agent:logAction': (log: ActionLogRow) => Promise<void>;
  'db:agent:getActionLog': (limit: number, offset: number) => Promise<ActionLogRow[]>;
  'db:agent:pruneLog': (olderThanMs: number) => Promise<number>;

  // ── Chat DB ──
  'db:chat:getMessages': (limit: number, beforeTimestamp?: number) => Promise<ChatMessageRow[]>;
  'db:chat:saveMessage': (msg: ChatMessageRow) => Promise<void>;

  // ── Crypto ──
  'crypto:encrypt': (plaintext: string) => Promise<string>;
  'crypto:decrypt': (ciphertext: string) => Promise<string>;

  // ── Keyboard Shortcuts DB ──
  'db:shortcuts:getAll': () => Promise<ShortcutRow[]>;
  'db:shortcuts:save': (shortcut: ShortcutRow) => Promise<void>;
  'db:shortcuts:reset': (action: string) => Promise<void>;
}

// Re-export for convenience
import type { SceneObjectRow } from '../renderer/db/types';
export type { SceneObjectRow };

/**
 * The shape of the API exposed to the renderer via contextBridge.
 * This is what `window.dax` looks like from the renderer's perspective.
 */
export interface DaxBridge {
  // ── App ──
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  getDataPath(): Promise<string>;

  // ── Directory ──
  selectDirectory(): Promise<string | null>;

  // ── Config ──
  configGet(key: string): Promise<string | null>;
  configSet(key: string, value: string): Promise<void>;

  // ── Filesystem ──
  fsAccess(dirPath: string): Promise<boolean>;
  fsScan(dirPath: string, maxDepth: number): Promise<FileEntry[]>;
  fsValidateName(name: string): Promise<ValidationResult>;
  fsCreate(filePath: string, type: 'file' | 'folder'): Promise<void>;
  fsRename(oldPath: string, newPath: string): Promise<void>;
  fsMove(sourcePath: string, targetDir: string): Promise<void>;
  fsDelete(filePath: string): Promise<void>;
  fsOpen(filePath: string): Promise<void>;
  fsStat(filePath: string): Promise<FileStat>;
  fsReadText(filePath: string, maxBytes: number): Promise<string>;
  fsFolderSize(dirPath: string): Promise<number>;

  // ── Clipboard ──
  clipboardWriteText(text: string): Promise<void>;

  // ── Search ──
  fsSearch(query: string, dir: string, mode: 'name' | 'content'): Promise<SearchResult[]>;

  // ── Watcher ──
  watcherStart(dirPath: string): Promise<void>;
  watcherStop(): Promise<void>;
  onWatcherEvents(callback: (batch: FSEventBatch) => void): () => void;

  // ── Scene DB ──
  dbSceneGetAll(): Promise<SceneObjectRow[]>;
  dbSceneUpsert(obj: SceneObjectRow): Promise<void>;
  dbSceneUpsertBatch(objs: SceneObjectRow[]): Promise<void>;
  dbSceneDelete(path: string): Promise<void>;
  dbSceneDeleteOrphans(validPaths: string[]): Promise<number>;

  // ── Agent ──
  agentPrompt(sessionId: string, message: string, context: AgentContext): Promise<AgentResponse>;
  agentCreateSession(): Promise<string>;
  agentHealth(): Promise<boolean>;

  // ── Agent DB ──
  dbAgentGetState(): Promise<AgentStateRow | null>;
  dbAgentSaveState(state: AgentStateRow): Promise<void>;
  dbAgentGetInstructions(): Promise<InstructionRow[]>;
  dbAgentSaveInstruction(inst: InstructionRow): Promise<void>;
  dbAgentDeleteInstruction(id: string): Promise<void>;
  dbAgentLogAction(log: ActionLogRow): Promise<void>;
  dbAgentGetActionLog(limit: number, offset: number): Promise<ActionLogRow[]>;
  dbAgentPruneLog(olderThanMs: number): Promise<number>;

  // ── Chat DB ──
  dbChatGetMessages(limit: number, beforeTimestamp?: number): Promise<ChatMessageRow[]>;
  dbChatSaveMessage(msg: ChatMessageRow): Promise<void>;

  // ── Crypto ──
  cryptoEncrypt(plaintext: string): Promise<string>;
  cryptoDecrypt(ciphertext: string): Promise<string>;

  // ── Keyboard Shortcuts DB ──
  dbShortcutsGetAll(): Promise<ShortcutRow[]>;
  dbShortcutsSave(shortcut: ShortcutRow): Promise<void>;
  dbShortcutsReset(action: string): Promise<void>;

  // ── Menu Events ──
  onMenuEvent(channel: string, callback: (...args: unknown[]) => void): () => void;
}
