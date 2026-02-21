import { ipcMain, dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { FileNode } from '../../src/types/index';
import type { FileWatcherService } from '../services/fileWatcher';

function hashPath(absolutePath: string): string {
  return crypto.createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
}

async function readDirectoryRecursive(
  dirPath: string,
  depth: number = 0,
  maxDepth: number = 2,
): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat) continue;

    const isDirectory = entry.isDirectory();
    const extension = isDirectory ? null : path.extname(entry.name) || null;

    const node: FileNode = {
      id: hashPath(absolutePath),
      name: entry.name,
      path: absolutePath,
      type: isDirectory ? 'directory' : 'file',
      extension,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      position: [0, 0, 0],
    };

    if (isDirectory && depth < maxDepth) {
      node.children = await readDirectoryRecursive(absolutePath, depth + 1, maxDepth);
    } else if (isDirectory) {
      node.children = [];
    }

    nodes.push(node);
  }

  return nodes;
}

export function registerFilesystemHandlers(
  getMainWindow: () => BrowserWindow | null,
  fileWatcher: FileWatcherService,
): void {
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const folderPath = result.filePaths[0];
    const win = getMainWindow();
    if (win) {
      fileWatcher.watch(folderPath, win);
    }
    return folderPath;
  });

  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    return readDirectoryRecursive(dirPath);
  });

  ipcMain.handle('fs:statFile', async (_event, filePath: string): Promise<FileNode | null> => {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) return null;
    const isDirectory = stat.isDirectory();
    const name = path.basename(filePath);
    const extension = isDirectory ? null : path.extname(name) || null;
    return {
      id: hashPath(filePath),
      name,
      path: filePath,
      type: isDirectory ? 'directory' : 'file',
      extension,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      position: [0, 0, 0],
      ...(isDirectory ? { children: [] } : {}),
    };
  });

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
