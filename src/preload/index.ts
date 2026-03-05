import { contextBridge, ipcRenderer, clipboard } from 'electron';

/**
 * Preload script: exposes a typed API to the renderer via contextBridge.
 * This is the ONLY way the renderer can communicate with the main process.
 *
 * Security: contextIsolation is enabled, so the renderer cannot access
 * Node.js APIs or ipcRenderer directly. All communication goes through
 * the `window.dax` bridge defined here.
 */
const daxBridge = {
  // ── App Info ──
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:getPlatform'),
  getDataPath: (): Promise<string> => ipcRenderer.invoke('app:getDataPath'),

  // ── Directory ──
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),

  // ── Config ──
  configGet: (key: string): Promise<string | null> => ipcRenderer.invoke('config:get', key),
  configSet: (key: string, value: string): Promise<void> => ipcRenderer.invoke('config:set', key, value),

  // ── Filesystem ──
  fsAccess: (dirPath: string): Promise<boolean> => ipcRenderer.invoke('fs:access', dirPath),
  fsScan: (dirPath: string, maxDepth: number) => ipcRenderer.invoke('fs:scan', dirPath, maxDepth),
  fsValidateName: (name: string) => ipcRenderer.invoke('fs:validateName', name),
  fsCreate: (filePath: string, type: 'file' | 'folder') => ipcRenderer.invoke('fs:create', filePath, type),
  fsRename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  fsMove: (sourcePath: string, targetDir: string) => ipcRenderer.invoke('fs:move', sourcePath, targetDir),
  fsDelete: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),
  fsOpen: (filePath: string) => ipcRenderer.invoke('fs:open', filePath),
  fsStat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
  fsReadText: (filePath: string, maxBytes: number) => ipcRenderer.invoke('fs:readText', filePath, maxBytes),
  fsFolderSize: (dirPath: string) => ipcRenderer.invoke('fs:folderSize', dirPath),
  fsSearch: (query: string, dir: string, mode: 'name' | 'content') =>
    ipcRenderer.invoke('fs:search', query, dir, mode),

  // ── Clipboard ──
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),

  // ── Watcher ──
  watcherStart: (dirPath: string): Promise<void> => ipcRenderer.invoke('watcher:start', dirPath),
  watcherStop: (): Promise<void> => ipcRenderer.invoke('watcher:stop'),
  onWatcherEvents: (callback: (...args: unknown[]) => void): (() => void) => {
    const handler = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on('watcher:events', handler);
    return () => ipcRenderer.removeListener('watcher:events', handler);
  },

  // ── Scene DB ──
  dbSceneGetAll: () => ipcRenderer.invoke('db:scene:getAll'),
  dbSceneUpsert: (obj: unknown) => ipcRenderer.invoke('db:scene:upsert', obj),
  dbSceneUpsertBatch: (objs: unknown) => ipcRenderer.invoke('db:scene:upsertBatch', objs),
  dbSceneDelete: (path: string) => ipcRenderer.invoke('db:scene:delete', path),
  dbSceneDeleteOrphans: (validPaths: string[]) => ipcRenderer.invoke('db:scene:deleteOrphans', validPaths),

  // ── Agent ──
  agentPrompt: (sessionId: string, message: string, context: unknown) =>
    ipcRenderer.invoke('agent:prompt', sessionId, message, context),
  agentCreateSession: () => ipcRenderer.invoke('agent:createSession'),
  agentHealth: () => ipcRenderer.invoke('agent:health'),

  // ── Agent DB ──
  dbAgentGetState: () => ipcRenderer.invoke('db:agent:getState'),
  dbAgentSaveState: (state: unknown) => ipcRenderer.invoke('db:agent:saveState', state),
  dbAgentGetInstructions: () => ipcRenderer.invoke('db:agent:getInstructions'),
  dbAgentSaveInstruction: (inst: unknown) => ipcRenderer.invoke('db:agent:saveInstruction', inst),
  dbAgentDeleteInstruction: (id: string) => ipcRenderer.invoke('db:agent:deleteInstruction', id),
  dbAgentLogAction: (log: unknown) => ipcRenderer.invoke('db:agent:logAction', log),
  dbAgentGetActionLog: (limit: number, offset: number) =>
    ipcRenderer.invoke('db:agent:getActionLog', limit, offset),
  dbAgentPruneLog: (olderThanMs: number) => ipcRenderer.invoke('db:agent:pruneLog', olderThanMs),

  // ── Chat DB ──
  dbChatGetMessages: (limit: number, beforeTimestamp?: number) =>
    ipcRenderer.invoke('db:chat:getMessages', limit, beforeTimestamp),
  dbChatSaveMessage: (msg: unknown) => ipcRenderer.invoke('db:chat:saveMessage', msg),

  // ── Crypto ──
  cryptoEncrypt: (plaintext: string): Promise<string> =>
    ipcRenderer.invoke('crypto:encrypt', plaintext),
  cryptoDecrypt: (ciphertext: string): Promise<string> =>
    ipcRenderer.invoke('crypto:decrypt', ciphertext),

  // ── Keyboard Shortcuts DB ──
  dbShortcutsGetAll: () => ipcRenderer.invoke('db:shortcuts:getAll'),
  dbShortcutsSave: (shortcut: unknown) => ipcRenderer.invoke('db:shortcuts:save', shortcut),
  dbShortcutsReset: (action: string) => ipcRenderer.invoke('db:shortcuts:reset', action),

  // ── Menu Events (main→renderer push channels) ──
  onMenuEvent: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const handler = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('dax', daxBridge);
