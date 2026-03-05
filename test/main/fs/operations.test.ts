/**
 * Tests for main/fs/operations.ts — file CRUD operations.
 *
 * Uses real filesystem operations in a temporary directory.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, stat, mkdir, writeFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createFileOrFolder,
  renameFileOrFolder,
  moveFileOrFolder,
  deleteFileOrFolder,
  getFileStat,
  readTextFile,
  calculateFolderSize,
  hasPendingOperation,
} from '../../../src/main/fs/operations';

// Mock electron shell
vi.mock('electron', () => ({
  shell: {
    trashItem: vi.fn(async (path: string) => {
      // Simulate trash by actually deleting (for tests)
      await rm(path, { recursive: true });
    }),
    openPath: vi.fn(async () => ''),
  },
}));

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'dax-ops-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('createFileOrFolder', () => {
  it('creates a new empty file', async () => {
    const filePath = join(tmpDir, 'hello.txt');
    await createFileOrFolder(filePath, 'file', tmpDir);

    const s = await stat(filePath);
    expect(s.isFile()).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('');
  });

  it('creates a new directory', async () => {
    const dirPath = join(tmpDir, 'subdir');
    await createFileOrFolder(dirPath, 'folder', tmpDir);

    const s = await stat(dirPath);
    expect(s.isDirectory()).toBe(true);
  });

  it('throws on invalid filename with dots only', async () => {
    const filePath = join(tmpDir, '..');
    await expect(createFileOrFolder(filePath, 'file', tmpDir)).rejects.toThrow();
  });

  it('tags a pending operation for the created path', async () => {
    const filePath = join(tmpDir, 'pending.txt');
    await createFileOrFolder(filePath, 'file', tmpDir);

    // The relative path is computed from rootDir
    // hasPendingOperation checks relative paths
    expect(hasPendingOperation('pending.txt')).toBe(true);
  });
});

describe('renameFileOrFolder', () => {
  it('renames a file', async () => {
    const oldPath = join(tmpDir, 'old.txt');
    const newPath = join(tmpDir, 'new.txt');
    await writeFile(oldPath, 'content');

    await renameFileOrFolder(oldPath, newPath, tmpDir);

    const s = await stat(newPath);
    expect(s.isFile()).toBe(true);

    const content = await readFile(newPath, 'utf-8');
    expect(content).toBe('content');

    // Old path should no longer exist
    await expect(stat(oldPath)).rejects.toThrow();
  });

  it('renames a directory', async () => {
    const oldPath = join(tmpDir, 'olddir');
    const newPath = join(tmpDir, 'newdir');
    await mkdir(oldPath);
    await writeFile(join(oldPath, 'inside.txt'), 'data');

    await renameFileOrFolder(oldPath, newPath, tmpDir);

    const s = await stat(newPath);
    expect(s.isDirectory()).toBe(true);

    const content = await readFile(join(newPath, 'inside.txt'), 'utf-8');
    expect(content).toBe('data');
  });
});

describe('moveFileOrFolder', () => {
  it('moves a file into a target directory', async () => {
    const filePath = join(tmpDir, 'moveme.txt');
    const targetDir = join(tmpDir, 'dest');
    await writeFile(filePath, 'move content');
    await mkdir(targetDir);

    await moveFileOrFolder(filePath, targetDir, tmpDir);

    const movedPath = join(targetDir, 'moveme.txt');
    const s = await stat(movedPath);
    expect(s.isFile()).toBe(true);

    const content = await readFile(movedPath, 'utf-8');
    expect(content).toBe('move content');

    // Original should no longer exist
    await expect(stat(filePath)).rejects.toThrow();
  });

  it('rejects circular move (folder into itself)', async () => {
    const dir = join(tmpDir, 'parent');
    const subdir = join(dir, 'child');
    await mkdir(dir);
    await mkdir(subdir);

    await expect(moveFileOrFolder(dir, subdir, tmpDir)).rejects.toThrow(/cannot move/i);
  });
});

describe('deleteFileOrFolder', () => {
  it('deletes a file via shell.trashItem mock', async () => {
    const filePath = join(tmpDir, 'deleteme.txt');
    await writeFile(filePath, 'bye');

    await deleteFileOrFolder(filePath);

    await expect(stat(filePath)).rejects.toThrow();
  });

  it('deletes a directory via shell.trashItem mock', async () => {
    const dirPath = join(tmpDir, 'deletedir');
    await mkdir(dirPath);
    await writeFile(join(dirPath, 'file.txt'), 'data');

    await deleteFileOrFolder(dirPath);

    await expect(stat(dirPath)).rejects.toThrow();
  });
});

describe('getFileStat', () => {
  it('returns stat info for a file', async () => {
    const filePath = join(tmpDir, 'info.txt');
    await writeFile(filePath, 'hello world');

    const info = await getFileStat(filePath);

    expect(info.name).toBe('info.txt');
    expect(info.type).toBe('file');
    expect(info.extension).toBe('txt');
    expect(info.sizeBytes).toBe(11);
    expect(info.createdAt).toBeGreaterThan(0);
    expect(info.modifiedAt).toBeGreaterThan(0);
  });

  it('returns stat info for a directory', async () => {
    const dirPath = join(tmpDir, 'statdir');
    await mkdir(dirPath);

    const info = await getFileStat(dirPath);

    expect(info.name).toBe('statdir');
    expect(info.type).toBe('folder');
  });
});

describe('readTextFile', () => {
  it('reads file content as text', async () => {
    const filePath = join(tmpDir, 'read.txt');
    await writeFile(filePath, 'read me please');

    const content = await readTextFile(filePath);
    expect(content).toBe('read me please');
  });

  it('truncates at maxBytes', async () => {
    const filePath = join(tmpDir, 'long.txt');
    const longContent = 'a'.repeat(1000);
    await writeFile(filePath, longContent);

    const content = await readTextFile(filePath, 100);
    expect(content.length).toBe(100);
  });
});

describe('calculateFolderSize', () => {
  it('computes total size of files in a folder', async () => {
    const dir = join(tmpDir, 'sized');
    await mkdir(dir);
    await writeFile(join(dir, 'a.txt'), 'AAAA'); // 4 bytes
    await writeFile(join(dir, 'b.txt'), 'BB');   // 2 bytes

    const size = await calculateFolderSize(dir);
    expect(size).toBe(6);
  });

  it('includes nested folder sizes', async () => {
    const dir = join(tmpDir, 'nested');
    const sub = join(dir, 'sub');
    await mkdir(dir);
    await mkdir(sub);
    await writeFile(join(dir, 'root.txt'), '12345'); // 5 bytes
    await writeFile(join(sub, 'child.txt'), '123');   // 3 bytes

    const size = await calculateFolderSize(dir);
    expect(size).toBe(8);
  });
});
