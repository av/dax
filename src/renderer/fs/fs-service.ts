/**
 * Filesystem service — renderer-side async wrappers over IPC.
 * All filesystem operations go through the IPC client to the main process.
 */
import { ipcClient } from '../core/ipc-client';
import { MAX_SCAN_DEPTH } from '@shared/constants';
import type { FileEntry, FileStat, SearchResult, ValidationResult } from '@shared/file-types';
import type { FSEventBatch } from '@shared/events';

/**
 * Scan a directory recursively and return all file entries.
 */
export async function scanDirectory(
  dirPath: string,
  maxDepth: number = MAX_SCAN_DEPTH,
): Promise<FileEntry[]> {
  return ipcClient.fsScan(dirPath, maxDepth);
}

/**
 * Start the filesystem watcher on a directory.
 */
export async function startWatcher(dirPath: string): Promise<void> {
  return ipcClient.watcherStart(dirPath);
}

/**
 * Stop the filesystem watcher.
 */
export async function stopWatcher(): Promise<void> {
  return ipcClient.watcherStop();
}

/**
 * Subscribe to filesystem watcher events.
 * Returns an unsubscribe function.
 */
export function onWatcherEvents(callback: (batch: FSEventBatch) => void): () => void {
  return ipcClient.onWatcherEvents(callback);
}

/**
 * Validate a filename.
 */
export async function validateFileName(name: string): Promise<ValidationResult> {
  return ipcClient.fsValidateName(name);
}

/**
 * Create a new file or folder on disk.
 */
export async function createFile(filePath: string, type: 'file' | 'folder'): Promise<void> {
  return ipcClient.fsCreate(filePath, type);
}

/**
 * Rename a file or folder.
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  return ipcClient.fsRename(oldPath, newPath);
}

/**
 * Move a file/folder to a target directory.
 */
export async function moveFile(sourcePath: string, targetDir: string): Promise<void> {
  return ipcClient.fsMove(sourcePath, targetDir);
}

/**
 * Delete a file/folder (send to OS trash).
 */
export async function deleteFile(filePath: string): Promise<void> {
  return ipcClient.fsDelete(filePath);
}

/**
 * Open a file in the OS default application.
 */
export async function openFile(filePath: string): Promise<void> {
  return ipcClient.fsOpen(filePath);
}

/**
 * Get file/folder metadata.
 */
export async function getFileStat(filePath: string): Promise<FileStat> {
  return ipcClient.fsStat(filePath);
}

/**
 * Read a text file (limited to maxBytes).
 */
export async function readTextFile(filePath: string, maxBytes: number = 1024 * 1024): Promise<string> {
  return ipcClient.fsReadText(filePath, maxBytes);
}

/**
 * Calculate folder total size.
 */
export async function getFolderSize(dirPath: string): Promise<number> {
  return ipcClient.fsFolderSize(dirPath);
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
  return ipcClient.clipboardWriteText(text);
}

/**
 * Search files by name or content.
 * Name search filters in-memory; content search uses ripgrep/grep via IPC.
 */
export async function searchFiles(
  query: string,
  dir: string,
  mode: 'name' | 'content',
): Promise<SearchResult[]> {
  return ipcClient.fsSearch(query, dir, mode);
}
