import { ipcMain, app, dialog, BrowserWindow, clipboard } from 'electron';
import { join } from 'path';
import { access } from 'fs/promises';
import { initDatabase } from './db/index';
import { ConfigRepo } from './db/config-repo';
import { SceneRepo } from './db/scene-repo';
import { scanDirectory } from './fs/scanner';
import { startWatcher, stopWatcher } from './fs/watcher';
import { validateFilename } from './fs/validators';
import {
  createFileOrFolder,
  renameFileOrFolder,
  moveFileOrFolder,
  deleteFileOrFolder,
  openFile,
  getFileStat,
  readTextFile,
  calculateFolderSize,
} from './fs/operations';
import { searchContent, searchByName } from './fs/search';
import { initAgentService, registerAgentIPCHandlers } from './agent/index';
import type { TursoDB } from './db/index';

let _db: TursoDB | null = null;
let _configRepo: ConfigRepo | null = null;
let _sceneRepo: SceneRepo | null = null;

/**
 * Initialize the database and create repository instances.
 * Called once during app startup.
 */
async function ensureDB(): Promise<{ db: TursoDB; configRepo: ConfigRepo; sceneRepo: SceneRepo }> {
  if (_db && _configRepo && _sceneRepo) {
    return { db: _db, configRepo: _configRepo, sceneRepo: _sceneRepo };
  }
  const dataPath = app.getPath('userData');
  const dbPath = join(dataPath, 'dax.db');
  _db = await initDatabase(dbPath);
  _configRepo = new ConfigRepo(_db);
  _sceneRepo = new SceneRepo(_db);
  // Initialize agent service with the same DB connection
  initAgentService(_db);
  return { db: _db, configRepo: _configRepo, sceneRepo: _sceneRepo };
}

/**
 * Registers all IPC handlers for the main process.
 * Each handler corresponds to a channel defined in shared/ipc-api.ts.
 */
export function registerIPCHandlers(): void {
  // ── App Info ──
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('app:getDataPath', () => {
    return app.getPath('userData');
  });

  // ── Directory Selection ──
  ipcMain.handle('dialog:selectDirectory', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Workspace Directory',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // ── Config ──
  ipcMain.handle('config:get', async (_event, key: string) => {
    const { configRepo } = await ensureDB();
    return configRepo.get(key);
  });

  ipcMain.handle('config:set', async (_event, key: string, value: string) => {
    const { configRepo } = await ensureDB();
    await configRepo.set(key, value);
  });

  // ── Filesystem Access Check ──
  ipcMain.handle('fs:access', async (_event, dirPath: string) => {
    try {
      await access(dirPath);
      return true;
    } catch {
      return false;
    }
  });

  // ── Filesystem Scan ──
  ipcMain.handle('fs:scan', async (_event, dirPath: string, maxDepth: number) => {
    return scanDirectory(dirPath, { maxDepth });
  });

  // ── Filesystem Validate Name ──
  ipcMain.handle('fs:validateName', async (_event, name: string) => {
    return validateFilename(name);
  });

  // ── Watcher ──
  ipcMain.handle('watcher:start', async (_event, dirPath: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      throw new Error('No focused window to attach watcher');
    }
    startWatcher(dirPath, win);
  });

  ipcMain.handle('watcher:stop', async () => {
    stopWatcher();
  });

  // ── Scene DB ──
  ipcMain.handle('db:scene:getAll', async () => {
    const { sceneRepo } = await ensureDB();
    return sceneRepo.getAll();
  });

  ipcMain.handle('db:scene:upsert', async (_event, obj) => {
    const { sceneRepo } = await ensureDB();
    await sceneRepo.upsert(obj);
  });

  ipcMain.handle('db:scene:upsertBatch', async (_event, objs) => {
    const { sceneRepo } = await ensureDB();
    await sceneRepo.upsertBatch(objs);
  });

  ipcMain.handle('db:scene:delete', async (_event, path: string) => {
    const { sceneRepo } = await ensureDB();
    await sceneRepo.deleteByPath(path);
  });

  ipcMain.handle('db:scene:deleteOrphans', async (_event, validPaths: string[]) => {
    const { sceneRepo } = await ensureDB();
    return sceneRepo.deleteOrphans(validPaths);
  });

  // ── File Operations ──
  ipcMain.handle('fs:create', async (_event, filePath: string, type: 'file' | 'folder') => {
    const { configRepo } = await ensureDB();
    const rootDir = await configRepo.get('workspace_path');
    if (!rootDir) throw new Error('No workspace configured');
    await createFileOrFolder(filePath, type, rootDir);
  });

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
    const { configRepo } = await ensureDB();
    const rootDir = await configRepo.get('workspace_path');
    if (!rootDir) throw new Error('No workspace configured');
    await renameFileOrFolder(oldPath, newPath, rootDir);
  });

  ipcMain.handle('fs:move', async (_event, sourcePath: string, targetDir: string) => {
    const { configRepo } = await ensureDB();
    const rootDir = await configRepo.get('workspace_path');
    if (!rootDir) throw new Error('No workspace configured');
    await moveFileOrFolder(sourcePath, targetDir, rootDir);
  });

  ipcMain.handle('fs:delete', async (_event, filePath: string) => {
    await deleteFileOrFolder(filePath);
  });

  ipcMain.handle('fs:open', async (_event, filePath: string) => {
    await openFile(filePath);
  });

  ipcMain.handle('fs:stat', async (_event, filePath: string) => {
    return getFileStat(filePath);
  });

  ipcMain.handle('fs:readText', async (_event, filePath: string, maxBytes: number) => {
    return readTextFile(filePath, maxBytes);
  });

  ipcMain.handle('fs:folderSize', async (_event, dirPath: string) => {
    return calculateFolderSize(dirPath);
  });

  // ── Search ──
  ipcMain.handle(
    'fs:search',
    async (_event, query: string, dir: string, mode: 'name' | 'content') => {
      if (mode === 'content') {
        return searchContent(query, dir);
      }
      // For name search, we need to get the file list first
      const { configRepo } = await ensureDB();
      const rootDir = await configRepo.get('workspace_path');
      if (!rootDir) throw new Error('No workspace configured');
      const entries = await scanDirectory(rootDir, { maxDepth: 10 });
      return searchByName(query, entries);
    },
  );

  // ── Clipboard ──
  ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
    clipboard.writeText(text);
  });

  // ── Agent ──
  registerAgentIPCHandlers();
}
