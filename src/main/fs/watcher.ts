/**
 * Filesystem watcher using chokidar.
 * Watches a directory for changes and emits normalized, debounced events.
 *
 * Features:
 * - chokidar-based recursive watching
 * - 100ms debounce window for batching rapid events
 * - Rename detection (unlink+add of same filename within debounce window)
 * - Event normalization to FSEvent/FSEventBatch types
 * - Respects .gitignore patterns (node_modules, .git, etc.)
 * - Sends batched events to renderer via webContents.send
 */
import chokidar, { type FSWatcher } from 'chokidar';
import { relative } from 'path';
import { WATCHER_DEBOUNCE_MS } from '@shared/constants';
import type { FSEvent, FSEventBatch, FSEventType } from '@shared/events';
import type { BrowserWindow } from 'electron';

/** Default ignored paths for the watcher */
const IGNORED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.hg/,
  /\.svn/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /\.idea/,
  /\.vscode/,
  /__pycache__/,
  /\.cache/,
  /\.next/,
  /\.nuxt/,
  /\.turbo/,
];

let watcher: FSWatcher | null = null;
let rootDir: string | null = null;
let pendingEvents: FSEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start watching a directory for filesystem changes.
 * Events are debounced and batch-sent to the renderer via IPC.
 *
 * @param dirPath - Absolute path to watch
 * @param win - BrowserWindow to send events to
 */
export function startWatcher(dirPath: string, win: BrowserWindow): void {
  // Stop any existing watcher first
  stopWatcher();

  rootDir = dirPath;

  watcher = chokidar.watch(dirPath, {
    ignored: IGNORED_PATTERNS,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
    },
    // Don't follow symlinks to avoid cycles
    followSymlinks: false,
    // Depth limit — watch deeply but scanner controls what's visible
    depth: 99,
  });

  const emitEvent = (type: FSEventType, fullPath: string) => {
    const relPath = relative(rootDir!, fullPath);
    // Skip empty relative paths (root directory itself)
    if (!relPath) return;

    const event: FSEvent = {
      type,
      path: relPath,
      timestamp: Date.now(),
    };
    pendingEvents.push(event);
    scheduleBatch(win);
  };

  watcher
    .on('add', (p: string) => emitEvent('add', p))
    .on('addDir', (p: string) => emitEvent('addDir', p))
    .on('unlink', (p: string) => emitEvent('unlink', p))
    .on('unlinkDir', (p: string) => emitEvent('unlinkDir', p))
    .on('change', (p: string) => emitEvent('change', p))
    .on('error', (err: unknown) => {
      console.error('[watcher] Error:', err instanceof Error ? err.message : String(err));
    });
}

/**
 * Schedule a debounced batch flush.
 */
function scheduleBatch(win: BrowserWindow): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    flushBatch(win);
  }, WATCHER_DEBOUNCE_MS);
}

/**
 * Flush pending events as a batch.
 * Performs rename detection: if an unlink and add of the same filename
 * appear in the same batch, treat it as a rename.
 */
function flushBatch(win: BrowserWindow): void {
  if (pendingEvents.length === 0) return;

  const events = [...pendingEvents];
  pendingEvents = [];
  debounceTimer = null;

  // Rename detection: match unlink+add pairs with the same basename
  const unlinkEvents = events.filter(
    (e) => e.type === 'unlink' || e.type === 'unlinkDir',
  );
  const addEvents = events.filter(
    (e) => e.type === 'add' || e.type === 'addDir',
  );

  for (const unlink of unlinkEvents) {
    const unlinkName = unlink.path.split('/').pop() ?? unlink.path;
    const matchingAdd = addEvents.find((add) => {
      const addName = add.path.split('/').pop() ?? add.path;
      // Same filename, different path = likely a move/rename
      return addName === unlinkName && add.path !== unlink.path;
    });

    if (matchingAdd) {
      // Mark the add event as a rename
      matchingAdd.renameFrom = unlink.path;
      // Remove the unlink event from the batch (it's handled by the rename)
      const idx = events.indexOf(unlink);
      if (idx !== -1) events.splice(idx, 1);
    }
  }

  const batch: FSEventBatch = {
    events,
    timestamp: Date.now(),
  };

  // Send to renderer
  try {
    if (!win.isDestroyed()) {
      win.webContents.send('watcher:events', batch);
    }
  } catch {
    // Window might be closing — ignore
  }
}

/**
 * Stop the filesystem watcher.
 */
export function stopWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingEvents = [];

  if (watcher) {
    watcher.close();
    watcher = null;
  }
  rootDir = null;
}

/**
 * Check if the watcher is currently active.
 */
export function isWatching(): boolean {
  return watcher !== null;
}
