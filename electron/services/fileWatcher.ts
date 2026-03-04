import * as watcher from '@parcel/watcher';
import fs from 'fs/promises';
import nodePath from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import ignore, { type Ignore } from 'ignore';
import type { FileChangeEvent, FileNode, WatcherInitPayload } from '../../src/types/index';

// ── Helpers ──────────────────────────────────────────

function hashPath(absolutePath: string): string {
  return crypto.createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
}

/** Names that are always ignored regardless of .gitignore */
const ALWAYS_IGNORED = new Set(['.git', '.DS_Store']);

/** Default ignore patterns used when no .gitignore is present */
const DEFAULT_IGNORE_NAMES = new Set([
  ...ALWAYS_IGNORED,
  'node_modules', 'dist', 'dist-electron', 'dist-renderer',
]);

function shouldIgnore(name: string): boolean {
  return DEFAULT_IGNORE_NAMES.has(name);
}

/** Load and parse .gitignore from a root directory, returns an Ignore filter */
async function loadGitignore(rootPath: string): Promise<Ignore | null> {
  try {
    const gitignorePath = nodePath.join(rootPath, '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const ig = ignore();
    ig.add(content);
    // Always ignore .git and .DS_Store even if not in .gitignore
    ig.add(['.git', '.DS_Store']);
    return ig;
  } catch {
    return null; // No .gitignore — fall back to default list
  }
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
  ig?: Ignore | null,
): Promise<FileNode[]> {
  const result: FileNode[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => null);
  if (!entries) return result;

  const parentId = dirPath === rootPath ? null : hashPath(dirPath);

  for (const entry of entries) {
    // Always-ignored names bypass gitignore check
    if (ALWAYS_IGNORED.has(entry.name)) continue;

    const absolutePath = nodePath.join(dirPath, entry.name);
    const isDir = entry.isDirectory();

    // Check against gitignore if available, otherwise use default list
    if (ig) {
      const relativePath = nodePath.relative(rootPath, absolutePath) + (isDir ? '/' : '');
      if (ig.ignores(relativePath)) continue;
    } else {
      if (shouldIgnore(entry.name)) continue;
    }

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat) continue;

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
      const children = await readDirectoryRecursiveFlat(absolutePath, rootPath, maxDepth, depth + 1, ig);
      result.push(...children);
    }
  }
  return result;
}

// ── Service ──────────────────────────────────────────

export class FileWatcherService {
  private subscription: watcher.AsyncSubscription | null = null;
  private sessionId: number = 0;

  private ig: Ignore | null = null;

  async watch(rootPath: string, win: BrowserWindow): Promise<WatcherInitPayload> {
    // Tear down previous subscription
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }

    const sessionId = ++this.sessionId;

    // Load .gitignore if present
    this.ig = await loadGitignore(rootPath);

    // Watcher ignore list: @parcel/watcher uses glob patterns for directories
    const watcherIgnore = ['.git', '.DS_Store'];
    if (!this.ig) {
      // No .gitignore — use conservative defaults for watcher
      watcherIgnore.push('node_modules', 'dist', 'dist-electron', 'dist-renderer');
    }
    // Note: When .gitignore is present, we let the watcher see all events
    // and filter in enrichEvent/readDirectory using the `ignore` library,
    // since @parcel/watcher only supports simple glob patterns.

    // Build snapshot path
    const snapshotDir = app.getPath('userData');
    const rootHash = hashPath(rootPath);
    const snapshotPath = nodePath.join(snapshotDir, `watcher-snapshot-${rootHash}.txt`);

    // Write initial snapshot
    await watcher.writeSnapshot(rootPath, snapshotPath, {
      ignore: watcherIgnore,
    });

    const ig = this.ig;

    // Start subscription (wrapped to catch ENOSPC and other system-level errors)
    try {
    this.subscription = await watcher.subscribe(rootPath, async (err, events) => {
      if (win.isDestroyed()) return;
      if (err) {
        win.webContents.send('fs:watcherError', { sessionId, error: String(err) });
        return;
      }

      // Filter events through .gitignore if available
      const filtered = ig
        ? events.filter((e) => {
            const rel = nodePath.relative(rootPath, e.path);
            return !ig.ignores(rel);
          })
        : events;
      if (filtered.length === 0) return;

      const enriched = await Promise.all(
        filtered.map((e) => enrichEvent(e, sessionId, rootPath)),
      );
      win.webContents.send('fs:fileChange', { sessionId, events: enriched });

      // Directory rename re-scan: if a directory was created, re-discover children
      for (const event of enriched) {
        if (event.type === 'addDir') {
          setImmediate(async () => {
            if (win.isDestroyed()) return;
            try {
              const children = await readDirectoryRecursiveFlat(event.path, rootPath, 10, 0, ig);
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
      ignore: watcherIgnore,
    });
    } catch (subscribeError: unknown) {
      // ENOSPC: system file watcher limit reached — notify user but continue with tree
      const errMsg = subscribeError instanceof Error ? subscribeError.message : String(subscribeError);
      const isEnospc = errMsg.includes('ENOSPC') || errMsg.includes('file watchers');
      win.webContents.send('fs:watcherError', {
        sessionId,
        error: isEnospc
          ? 'File watcher limit reached. Live file updates are disabled. Try closing other apps or increasing fs.inotify.max_user_watches.'
          : `File watcher failed: ${errMsg}`,
      });
      // Continue without live watching — tree will still be loaded below
    }

    // Get gap events (events that occurred between snapshot and subscription start)
    let gapEvents: FileChangeEvent[] = [];
    try {
      const rawGapEvents = await watcher.getEventsSince(rootPath, snapshotPath, {
        ignore: watcherIgnore,
      });
      // Filter gap events through .gitignore
      const filteredGap = ig
        ? rawGapEvents.filter((e) => !ig.ignores(nodePath.relative(rootPath, e.path)))
        : rawGapEvents;
      gapEvents = await Promise.all(
        filteredGap.map((e) => enrichEvent(e, sessionId, rootPath)),
      );
    } catch {
      // getEventsSince may fail if no backend supports it; safe to ignore
    }

    // Build full tree (gitignore-aware)
    const tree = await readDirectoryRecursiveFlat(rootPath, rootPath, 10, 0, ig);

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
