import { ipcMain, dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { FileNode } from '../../src/types/index';
import { FileWatcherService, readDirectoryRecursiveFlat, hashPath } from '../services/fileWatcher';

export function registerFilesystemHandlers(
  getMainWindow: () => BrowserWindow | null,
  fileWatcher: FileWatcherService,
): void {
  // ── Watch folder (new atomic init) ──────────────────
  ipcMain.handle('fs:watchFolder', async (_event, folderPath: string) => {
    const win = getMainWindow();
    if (!win) throw new Error('No main window available');
    return fileWatcher.watch(folderPath, win);
  });

  // ── Open folder dialog ──────────────────────────────
  // Now only opens the dialog and returns the path — renderer calls watchFolder separately
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // ── Read directory (flat) ───────────────────────────
  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    return readDirectoryRecursiveFlat(dirPath, dirPath);
  });

  // ── Stat file ───────────────────────────────────────
  ipcMain.handle('fs:statFile', async (_event, filePath: string): Promise<FileNode | null> => {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) return null;
    const isDirectory = stat.isDirectory();
    const name = path.basename(filePath);
    const extension = isDirectory ? null : path.extname(name) || null;
    const parentDir = path.dirname(filePath);
    return {
      id: hashPath(filePath),
      name,
      path: filePath,
      type: isDirectory ? 'directory' : 'file',
      extension,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      parentId: hashPath(parentDir),
    };
  });

  // ── File operations ─────────────────────────────────
  ipcMain.handle('fs:readFileContent', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:readBinaryFile', async (_event, filePath: string) => {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  });

  ipcMain.handle('fs:writeFileContent', async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('fs:moveFile', async (_event, src: string, dest: string) => {
    await fs.rename(src, dest);
  });

  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    await shell.trashItem(filePath);
  });

  ipcMain.handle('fs:renameFile', async (_event, filePath: string, newName: string) => {
    const dir = path.dirname(filePath);
    const newPath = path.join(dir, newName);
    await fs.rename(filePath, newPath);
  });
}
