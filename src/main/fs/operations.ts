/**
 * File operations — create, rename, move, delete, open, stat, readText.
 *
 * All file operations go through this module. Operations are validated
 * before execution and use shell.trashItem for safe deletion.
 *
 * Internal operations are tagged to prevent chokidar feedback loops.
 */
import { shell } from 'electron';
import { writeFile, mkdir, rename, stat, readFile, access } from 'fs/promises';
import { join, basename, dirname, extname, resolve, relative } from 'path';
import { validateFilename, validatePathTraversal } from './validators';
import type { FileStat } from '@shared/file-types';
import { getFileCategory } from '@shared/file-types';

/**
 * Set of paths with pending internal operations.
 * The watcher should check this set to avoid feedback loops.
 */
const pendingOperations = new Set<string>();

/** Returns whether a path has a pending internal operation. */
export function hasPendingOperation(relPath: string): boolean {
  return pendingOperations.has(relPath);
}

/** Clear a pending operation tag. */
export function clearPendingOperation(relPath: string): void {
  pendingOperations.delete(relPath);
}

/** Tag a path as having a pending internal operation. Auto-clears after timeout. */
function tagPending(relPath: string, timeoutMs: number = 2000): void {
  pendingOperations.add(relPath);
  setTimeout(() => pendingOperations.delete(relPath), timeoutMs);
}

/**
 * Create a new file or folder on disk.
 */
export async function createFileOrFolder(
  filePath: string,
  type: 'file' | 'folder',
  rootDir: string,
): Promise<void> {
  // Validate the filename
  const name = basename(filePath);
  const validation = validateFilename(name);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error ?? 'Invalid filename'), {
      code: 'FS_INVALID_NAME',
    });
  }

  // Validate path traversal
  const traversal = validatePathTraversal(rootDir, filePath);
  if (!traversal.valid) {
    throw Object.assign(new Error(traversal.error ?? 'Path traversal detected'), {
      code: 'FS_TRAVERSAL',
    });
  }

  // Check if already exists
  try {
    await access(filePath);
    throw Object.assign(
      new Error(`A ${type} named "${name}" already exists`),
      { code: 'FS_ALREADY_EXISTS' },
    );
  } catch (err: unknown) {
    // ENOENT = doesn't exist = good
    if ((err as NodeJS.ErrnoException).code === 'FS_ALREADY_EXISTS') throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  // Tag as pending to prevent watcher feedback loop
  const relPath = relative(rootDir, filePath);
  tagPending(relPath);

  try {
    if (type === 'folder') {
      await mkdir(filePath, { recursive: true });
    } else {
      // Ensure parent directory exists
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, '');
    }
  } catch (err: unknown) {
    pendingOperations.delete(relPath);
    throw mapFSError(err);
  }
}

/**
 * Rename a file or folder.
 */
export async function renameFileOrFolder(
  oldPath: string,
  newPath: string,
  rootDir: string,
): Promise<void> {
  // Validate new filename
  const newName = basename(newPath);
  const validation = validateFilename(newName);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error ?? 'Invalid filename'), {
      code: 'FS_INVALID_NAME',
    });
  }

  // Validate path traversal
  const traversal = validatePathTraversal(rootDir, newPath);
  if (!traversal.valid) {
    throw Object.assign(new Error(traversal.error ?? 'Path traversal detected'), {
      code: 'FS_TRAVERSAL',
    });
  }

  // No-op if same path
  if (resolve(oldPath) === resolve(newPath)) return;

  // Check source exists
  try {
    await access(oldPath);
  } catch {
    throw Object.assign(
      new Error(`Cannot rename: "${basename(oldPath)}" not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  // Check target doesn't already exist
  try {
    await access(newPath);
    throw Object.assign(
      new Error(`Cannot rename: "${newName}" already exists`),
      { code: 'FS_ALREADY_EXISTS' },
    );
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'FS_ALREADY_EXISTS') throw err;
    // ENOENT = good
  }

  const oldRel = relative(rootDir, oldPath);
  const newRel = relative(rootDir, newPath);
  tagPending(oldRel);
  tagPending(newRel);

  try {
    await rename(oldPath, newPath);
  } catch (err: unknown) {
    pendingOperations.delete(oldRel);
    pendingOperations.delete(newRel);
    throw mapFSError(err);
  }
}

/**
 * Move a file/folder to a target directory.
 */
export async function moveFileOrFolder(
  sourcePath: string,
  targetDir: string,
  rootDir: string,
): Promise<void> {
  const name = basename(sourcePath);
  const destPath = join(targetDir, name);

  // Circular move detection: check if target is inside source
  const resolvedSource = resolve(sourcePath);
  const resolvedTarget = resolve(targetDir);
  if (resolvedTarget.startsWith(resolvedSource + '/') || resolvedTarget === resolvedSource) {
    throw Object.assign(
      new Error('Cannot move a folder into itself'),
      { code: 'FS_CIRCULAR_MOVE' },
    );
  }

  // No-op if source dir = target dir
  if (resolve(dirname(sourcePath)) === resolvedTarget) return;

  // Validate path traversal
  const traversal = validatePathTraversal(rootDir, destPath);
  if (!traversal.valid) {
    throw Object.assign(new Error(traversal.error ?? 'Path traversal detected'), {
      code: 'FS_TRAVERSAL',
    });
  }

  // Check source exists
  try {
    await access(sourcePath);
  } catch {
    throw Object.assign(
      new Error(`Cannot move: "${name}" not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  // Check target dir exists
  try {
    await access(targetDir);
  } catch {
    throw Object.assign(
      new Error(`Cannot move: target directory not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  // Check no name collision at target
  try {
    await access(destPath);
    throw Object.assign(
      new Error(`Cannot move: "${name}" already exists in target folder`),
      { code: 'FS_ALREADY_EXISTS' },
    );
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'FS_ALREADY_EXISTS') throw err;
    // ENOENT = good
  }

  const srcRel = relative(rootDir, sourcePath);
  const dstRel = relative(rootDir, destPath);
  tagPending(srcRel);
  tagPending(dstRel);

  try {
    await rename(sourcePath, destPath);
  } catch (err: unknown) {
    pendingOperations.delete(srcRel);
    pendingOperations.delete(dstRel);
    throw mapFSError(err);
  }
}

/**
 * Delete a file/folder by moving it to the OS trash.
 * Uses shell.trashItem for recoverable deletion.
 */
export async function deleteFileOrFolder(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw Object.assign(
      new Error(`Cannot delete: "${basename(filePath)}" not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  try {
    await shell.trashItem(filePath);
  } catch (err: unknown) {
    throw Object.assign(
      new Error(`Cannot delete "${basename(filePath)}": ${(err as Error).message}`),
      { code: 'FS_PERMISSION' },
    );
  }
}

/**
 * Open a file in the OS default application.
 */
export async function openFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw Object.assign(
      new Error(`Cannot open "${basename(filePath)}": file not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) {
    throw new Error(`Cannot open "${basename(filePath)}": ${errorMessage}`);
  }
}

/**
 * Get file/folder metadata via fs.stat().
 */
export async function getFileStat(filePath: string): Promise<FileStat> {
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    throw Object.assign(
      new Error(`Cannot stat "${basename(filePath)}": file not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  const name = basename(filePath);
  const ext = extname(name).slice(1); // remove leading dot
  const isFolder = stats.isDirectory();

  const result: FileStat = {
    path: filePath,
    name,
    extension: ext,
    type: isFolder ? 'folder' : 'file',
    sizeBytes: stats.size,
    sizeHuman: formatBytes(stats.size),
    createdAt: stats.birthtimeMs,
    modifiedAt: stats.mtimeMs,
    permissions: formatPermissions(stats.mode),
  };

  // For folders, count immediate children
  if (isFolder) {
    const { readdir } = await import('fs/promises');
    try {
      const children = await readdir(filePath);
      result.childCount = children.length;
    } catch {
      result.childCount = 0;
    }
  }

  return result;
}

/**
 * Read a text file (with size limit).
 */
export async function readTextFile(filePath: string, maxBytes: number = 1024 * 1024): Promise<string> {
  try {
    await access(filePath);
  } catch {
    throw Object.assign(
      new Error(`Cannot read "${basename(filePath)}": file not found`),
      { code: 'FS_NOT_FOUND' },
    );
  }

  const stats = await stat(filePath);
  if (stats.size > maxBytes) {
    // Read only up to maxBytes
    const { open } = await import('fs/promises');
    const fh = await open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      await fh.read(buffer, 0, maxBytes, 0);
      return buffer.toString('utf-8');
    } finally {
      await fh.close();
    }
  }

  return readFile(filePath, 'utf-8');
}

/**
 * Calculate total folder size (recursive).
 */
export async function calculateFolderSize(dirPath: string): Promise<number> {
  const { readdir, stat: fsStat } = await import('fs/promises');
  let total = 0;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // Skip directories we can't read
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        try {
          const s = await fsStat(fullPath);
          total += s.size;
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(dirPath);
  return total;
}

// ── Utility Functions ──

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatPermissions(mode: number): string {
  const chars = 'rwxrwxrwx';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += mode & (1 << (8 - i)) ? chars[i] : '-';
  }
  return result;
}

function mapFSError(err: unknown): Error {
  const e = err as NodeJS.ErrnoException;
  switch (e.code) {
    case 'EACCES':
    case 'EPERM':
      return Object.assign(new Error(`Permission denied: ${e.message}`), { code: 'FS_PERMISSION' });
    case 'ENOSPC':
      return Object.assign(new Error('Disk full'), { code: 'FS_DISK_FULL' });
    case 'ENAMETOOLONG':
      return Object.assign(new Error('Path too long'), { code: 'FS_NAME_TOO_LONG' });
    case 'EBUSY':
      return Object.assign(new Error('File is in use by another application'), { code: 'FS_FILE_IN_USE' });
    case 'EXDEV':
      return Object.assign(new Error('Cannot move across volumes. Use copy instead.'), { code: 'FS_CROSS_DEVICE' });
    case 'ENOENT':
      return Object.assign(new Error(`File not found: ${e.message}`), { code: 'FS_NOT_FOUND' });
    case 'EEXIST':
      return Object.assign(new Error('File already exists'), { code: 'FS_ALREADY_EXISTS' });
    default:
      return Object.assign(new Error(e.message ?? 'Unknown filesystem error'), { code: 'UNKNOWN' });
  }
}
