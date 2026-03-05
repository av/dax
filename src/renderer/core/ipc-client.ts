import { IPC_TIMEOUT_MS } from '@shared/constants';
import type { FileEntry, FileStat, SearchResult, ValidationResult } from '@shared/file-types';
import type { FSEventBatch } from '@shared/events';
import type { SceneObjectRow, AgentStateRow, InstructionRow, ActionLogRow, ChatMessageRow, ShortcutRow } from '../db/types';
import type { AgentContext, AgentResponse } from '@shared/ipc-api';

/**
 * Typed IPC client for the renderer process.
 * Wraps window.dax.* calls with error handling and timeouts.
 *
 * All IPC communication goes through the contextBridge-exposed `window.dax` API.
 */

function withTimeout<T>(promise: Promise<T>, ms: number = IPC_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IPC call timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const ipcClient = {
  /** Get the application version from package.json */
  getVersion: (): Promise<string> => withTimeout(window.dax.getVersion()),

  /** Get the current platform (darwin, linux, win32) */
  getPlatform: (): Promise<string> => withTimeout(window.dax.getPlatform()),

  /** Get the app's user data path */
  getDataPath: (): Promise<string> => withTimeout(window.dax.getDataPath()),

  /** Open the native directory picker dialog */
  selectDirectory: (): Promise<string | null> =>
    withTimeout(window.dax.selectDirectory(), 60_000), // longer timeout for dialog

  /** Get a config value by key */
  configGet: (key: string): Promise<string | null> =>
    withTimeout(window.dax.configGet(key)),

  /** Set a config value */
  configSet: (key: string, value: string): Promise<void> =>
    withTimeout(window.dax.configSet(key, value)),

  /** Check if a directory/file is accessible */
  fsAccess: (dirPath: string): Promise<boolean> =>
    withTimeout(window.dax.fsAccess(dirPath)),

  /** Scan a directory recursively and return FileEntry[] */
  fsScan: (dirPath: string, maxDepth: number): Promise<FileEntry[]> =>
    withTimeout(window.dax.fsScan(dirPath, maxDepth), 30_000), // longer timeout for large dirs

  /** Validate a filename */
  fsValidateName: (name: string): Promise<ValidationResult> =>
    withTimeout(window.dax.fsValidateName(name)),

  /** Create a file or folder on disk */
  fsCreate: (filePath: string, type: 'file' | 'folder'): Promise<void> =>
    withTimeout(window.dax.fsCreate(filePath, type)),

  /** Rename a file or folder */
  fsRename: (oldPath: string, newPath: string): Promise<void> =>
    withTimeout(window.dax.fsRename(oldPath, newPath)),

  /** Move a file/folder to a target directory */
  fsMove: (sourcePath: string, targetDir: string): Promise<void> =>
    withTimeout(window.dax.fsMove(sourcePath, targetDir)),

  /** Delete (trash) a file or folder */
  fsDelete: (filePath: string): Promise<void> =>
    withTimeout(window.dax.fsDelete(filePath)),

  /** Open a file in the OS default application */
  fsOpen: (filePath: string): Promise<void> =>
    withTimeout(window.dax.fsOpen(filePath)),

  /** Get file/folder metadata */
  fsStat: (filePath: string): Promise<FileStat> =>
    withTimeout(window.dax.fsStat(filePath)),

  /** Read a text file (with size limit) */
  fsReadText: (filePath: string, maxBytes: number = 1024 * 1024): Promise<string> =>
    withTimeout(window.dax.fsReadText(filePath, maxBytes)),

  /** Calculate folder total size */
  fsFolderSize: (dirPath: string): Promise<number> =>
    withTimeout(window.dax.fsFolderSize(dirPath), 60_000),

  /** Copy text to clipboard */
  clipboardWriteText: (text: string): Promise<void> =>
    withTimeout(window.dax.clipboardWriteText(text)),

  /** Search files by name or content */
  fsSearch: (query: string, dir: string, mode: 'name' | 'content'): Promise<SearchResult[]> =>
    withTimeout(window.dax.fsSearch(query, dir, mode), 30_000),

  /** Start the filesystem watcher on a directory */
  watcherStart: (dirPath: string): Promise<void> =>
    withTimeout(window.dax.watcherStart(dirPath)),

  /** Stop the filesystem watcher */
  watcherStop: (): Promise<void> =>
    withTimeout(window.dax.watcherStop()),

  /** Subscribe to watcher events. Returns an unsubscribe function. */
  onWatcherEvents: (callback: (batch: FSEventBatch) => void): (() => void) =>
    window.dax.onWatcherEvents(callback),

  /** Get all scene objects from DB */
  dbSceneGetAll: (): Promise<SceneObjectRow[]> =>
    withTimeout(window.dax.dbSceneGetAll()),

  /** Upsert a single scene object */
  dbSceneUpsert: (obj: SceneObjectRow): Promise<void> =>
    withTimeout(window.dax.dbSceneUpsert(obj)),

  /** Upsert a batch of scene objects */
  dbSceneUpsertBatch: (objs: SceneObjectRow[]): Promise<void> =>
    withTimeout(window.dax.dbSceneUpsertBatch(objs), 30_000),

  /** Delete a scene object by path */
  dbSceneDelete: (path: string): Promise<void> =>
    withTimeout(window.dax.dbSceneDelete(path)),

  /** Delete orphaned scene objects (paths not in validPaths list) */
  dbSceneDeleteOrphans: (validPaths: string[]): Promise<number> =>
    withTimeout(window.dax.dbSceneDeleteOrphans(validPaths), 30_000),

  // ── Agent ──

  /** Create a new agent LLM session */
  agentCreateSession: (): Promise<string> =>
    withTimeout(window.dax.agentCreateSession()),

  /** Send a prompt to the agent LLM */
  agentPrompt: (sessionId: string, message: string, context: AgentContext): Promise<AgentResponse> =>
    withTimeout(window.dax.agentPrompt(sessionId, message, context), 30_000),

  /** Check agent LLM health */
  agentHealth: (): Promise<boolean> =>
    withTimeout(window.dax.agentHealth()),

  // ── Agent DB ──

  /** Get persisted agent state */
  dbAgentGetState: (): Promise<AgentStateRow | null> =>
    withTimeout(window.dax.dbAgentGetState()),

  /** Save agent state */
  dbAgentSaveState: (state: AgentStateRow): Promise<void> =>
    withTimeout(window.dax.dbAgentSaveState(state)),

  /** Get all agent instructions */
  dbAgentGetInstructions: (): Promise<InstructionRow[]> =>
    withTimeout(window.dax.dbAgentGetInstructions()),

  /** Save an agent instruction */
  dbAgentSaveInstruction: (inst: InstructionRow): Promise<void> =>
    withTimeout(window.dax.dbAgentSaveInstruction(inst)),

  /** Delete an agent instruction */
  dbAgentDeleteInstruction: (id: string): Promise<void> =>
    withTimeout(window.dax.dbAgentDeleteInstruction(id)),

  /** Log an agent action */
  dbAgentLogAction: (log: ActionLogRow): Promise<void> =>
    withTimeout(window.dax.dbAgentLogAction(log)),

  /** Get agent action log with pagination */
  dbAgentGetActionLog: (limit: number, offset: number): Promise<ActionLogRow[]> =>
    withTimeout(window.dax.dbAgentGetActionLog(limit, offset)),

  /** Prune old agent log entries */
  dbAgentPruneLog: (olderThanMs: number): Promise<number> =>
    withTimeout(window.dax.dbAgentPruneLog(olderThanMs)),

  // ── Chat DB ──

  /** Get chat messages with optional pagination */
  dbChatGetMessages: (limit: number, beforeTimestamp?: number): Promise<ChatMessageRow[]> =>
    withTimeout(window.dax.dbChatGetMessages(limit, beforeTimestamp)),

  /** Save a chat message */
  dbChatSaveMessage: (msg: ChatMessageRow): Promise<void> =>
    withTimeout(window.dax.dbChatSaveMessage(msg)),

  // ── Crypto ──

  /** Encrypt a string (for API key storage) */
  cryptoEncrypt: (plaintext: string): Promise<string> =>
    withTimeout(window.dax.cryptoEncrypt(plaintext)),

  /** Decrypt a string */
  cryptoDecrypt: (ciphertext: string): Promise<string> =>
    withTimeout(window.dax.cryptoDecrypt(ciphertext)),

  // ── Keyboard Shortcuts DB ──

  /** Get all keyboard shortcuts */
  dbShortcutsGetAll: (): Promise<ShortcutRow[]> =>
    withTimeout(window.dax.dbShortcutsGetAll()),

  /** Save a keyboard shortcut */
  dbShortcutsSave: (shortcut: ShortcutRow): Promise<void> =>
    withTimeout(window.dax.dbShortcutsSave(shortcut)),

  /** Reset a keyboard shortcut to default */
  dbShortcutsReset: (action: string): Promise<void> =>
    withTimeout(window.dax.dbShortcutsReset(action)),
};

export type IPCClient = typeof ipcClient;
