import * as watcher from '@parcel/watcher';
import fs from 'fs/promises';
import nodePath from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import type { FileChangeEvent, FileNode, WatcherInitPayload } from '../../src/types/index';

// ── Helpers ──────────────────────────────────────────

function hashPath(absolutePath: string): string {
  return crypto.createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
}

function shouldIgnore(name: string): boolean {
  return name === '.git' || name === 'node_modules' || name === '.DS_Store'
    || name === 'dist' || name === 'dist-electron' || name === 'dist-renderer';
}

async function statWithRetry(
  absPath: string,
  retries: number = 3,
  backoff: number = 50,
): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fs.stat(absPath);
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, backoff * Math.pow(2, i)));
      }
    }
  }
  return null;
}

async function enrichEvent(
  raw: { type: 'create' | 'update' | 'delete'; path: string },
  sessionId: number,
  _rootPath: string,
): Promise<FileChangeEvent> {
  if (raw.type === 'delete') {
    return { type: 'unlink', path: raw.path, sessionId };
  }

  const stat = await statWithRetry(raw.path);
  if (!stat) {
    return { type: raw.type === 'create' ? 'add' : 'change', path: raw.path, sessionId };
  }

  const isDir = stat.isDirectory();
  if (raw.type === 'create') {
    return {
      type: isDir ? 'addDir' : 'add',
      path: raw.path,
      sessionId,
      fileInfo: { sizeBytes: Number(stat.size), modifiedAt: Number(stat.mtimeMs) },
    };
  }

  // raw.type === 'update'
  return {
    type: 'change',
    path: raw.path,
    sessionId,
    fileInfo: { sizeBytes: Number(stat.size), modifiedAt: Number(stat.mtimeMs) },
  };
}

async function readDirectoryRecursiveFlat(
  dirPath: string,
  rootPath: string,
  maxDepth: number = 10,
  depth: number = 0,
): Promise<FileNode[]> {
  const result: FileNode[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => null);
  if (!entries) return result;

  const parentId = dirPath === rootPath ? null : hashPath(dirPath);

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    const absolutePath = nodePath.join(dirPath, entry.name);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat) continue;

    const isDir = entry.isDirectory();
    const node: FileNode = {
      id: hashPath(absolutePath),
      name: entry.name,
      path: absolutePath,
      type: isDir ? 'directory' : 'file',
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      extension: isDir ? null : nodePath.extname(entry.name) || null,
      parentId,
    };
    result.push(node);

    if (isDir && depth < maxDepth) {
      const children = await readDirectoryRecursiveFlat(absolutePath, rootPath, maxDepth, depth + 1);
      result.push(...children);
    }
  }
  return result;
}

// ── Service ──────────────────────────────────────────

export class FileWatcherService {
  private subscription: watcher.AsyncSubscription | null = null;
  private sessionId: number = 0;

  async watch(rootPath: string, win: BrowserWindow): Promise<WatcherInitPayload> {
    // Tear down previous subscription
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }

    const sessionId = ++this.sessionId;

    // Build snapshot path
    const snapshotDir = app.getPath('userData');
    const rootHash = hashPath(rootPath);
    const snapshotPath = nodePath.join(snapshotDir, `watcher-snapshot-${rootHash}.txt`);

    // Write initial snapshot
    await watcher.writeSnapshot(rootPath, snapshotPath, {
      ignore: ['.git', 'node_modules', '.DS_Store', 'dist', 'dist-electron', 'dist-renderer'],
    });

    // Start subscription
    this.subscription = await watcher.subscribe(rootPath, async (err, events) => {
      if (win.isDestroyed()) return;
      if (err) {
        win.webContents.send('fs:watcherError', { sessionId, error: String(err) });
        return;
      }

      const enriched = await Promise.all(
        events.map((e) => enrichEvent(e, sessionId, rootPath)),
      );
      win.webContents.send('fs:fileChange', { sessionId, events: enriched });

      // Directory rename re-scan: if a directory was created, re-discover children
      for (const event of enriched) {
        if (event.type === 'addDir') {
          setImmediate(async () => {
            if (win.isDestroyed()) return;
            try {
              const children = await readDirectoryRecursiveFlat(event.path, rootPath);
              if (children.length > 0) {
                win.webContents.send('fs:fileChange', {
                  sessionId,
                  events: children.map((node) => ({
                    type: node.type === 'directory' ? 'addDir' as const : 'add' as const,
                    path: node.path,
                    sessionId,
                    fileInfo: { sizeBytes: node.sizeBytes, modifiedAt: node.modifiedAt },
                  })),
                });
              }
            } catch {
              // Non-critical: directory may have been removed
            }
          });
        }
      }
    }, {
      ignore: ['.git', 'node_modules', '.DS_Store', 'dist', 'dist-electron', 'dist-renderer'],
    });

    // Get gap events (events that occurred between snapshot and subscription start)
    let gapEvents: FileChangeEvent[] = [];
    try {
      const rawGapEvents = await watcher.getEventsSince(rootPath, snapshotPath, {
        ignore: ['.git', 'node_modules', '.DS_Store', 'dist', 'dist-electron', 'dist-renderer'],
      });
      gapEvents = await Promise.all(
        rawGapEvents.map((e) => enrichEvent(e, sessionId, rootPath)),
      );
    } catch {
      // getEventsSince may fail if no backend supports it; safe to ignore
    }

    // Build full tree
    const tree = await readDirectoryRecursiveFlat(rootPath, rootPath);

    return { sessionId, tree, gapEvents };
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}

export { readDirectoryRecursiveFlat, hashPath, shouldIgnore };
