# File Watcher Migration: chokidar → @parcel/watcher

## 1. Problem Summary

- **Auto-restore blind:** `loadFolder` never starts the file watcher — sessions restored from `lastOpenedFolder` are file-blind.
- **Depth cap:** Initial load capped at depth 2; chokidar `ignoreInitial: true` means deep files are permanently invisible.
- **No error handler:** No chokidar `error` listener — permission errors crash the watcher silently.
- **Init race:** Race between `readDirectory` and first watcher events (watcher starts before `readDirectory` returns).
- **Stale cross-session events:** Events from a previous root bleed into new sessions — no session ID, no path validation.
- **Orphaned inserts:** `insertNode` orphans nodes when the parent directory isn't in the store yet (O(n) parent scan, silent failure on miss).
- **Stale children snapshots:** `removeNodeFromTree` misses grandchildren because it traverses stale embedded `children` snapshot arrays.
- **Silent stat drops:** `stat` failures on `add`/`change` events silently drop the file forever — no retry.
- **Dotfile inconsistency:** Initial scan skips all `.*` entries; chokidar ignored list only skips `.git`.

## 2. Architecture Overview

```
┌─────────── Renderer ───────────┐       ┌─────────── Main ──────────────┐
│                                │       │                               │
│  openFolder() / loadFolder()   │       │                               │
│        │                       │       │                               │
│        ▼                       │       │                               │
│  invoke('fs:watchFolder', path)│──IPC──▶  fs:watchFolder handler       │
│                                │       │    │                          │
│                                │       │    ├─ ++sessionId             │
│                                │       │    ├─ writeSnapshot(root)     │
│                                │       │    ├─ subscribe(root, cb)     │
│                                │       │    ├─ getEventsSince(snap)    │
│                                │       │    └─ return { sessionId,     │
│                                │◀─IPC──│         tree, gapEvents }    │
│  initWatcher():                │       │                               │
│    knownSessionId = sessionId  │       │  Live events:                 │
│    buildStore(tree)            │       │    cb(err, events) →          │
│    applyGapEvents(gapEvents)   │       │      tag each with sessionId  │
│        │                       │       │      send('fs:fileChange',    │
│        ▼                       │       │        { sessionId, events }) │
│  onFileChange(event):          │◀─push─│                               │
│    if event.sessionId !==      │       │                               │
│       knownSessionId → discard │       │                               │
│    else applyPatch(event)      │       │                               │
└────────────────────────────────┘       └───────────────────────────────┘
```

Key invariants:

1. **Atomic init.** The renderer never processes live events until it has the full tree and gap events. No more race between `readDirectory` and watcher startup.
2. **Session-gated events.** Both main (tags) and renderer (guards) use `sessionId`. Opening a new folder increments the counter; stale callbacks become no-ops.
3. **Single entry point.** Both `openFolder` and `loadFolder` converge on `initWatcher` — identical code path, identical guarantees.

## 3. Changes by File

### `electron/services/fileWatcher.ts`

- Replace chokidar import with `@parcel/watcher` (`subscribe`, `writeSnapshot`, `getEventsSince`).
- `watch(rootPath, win)` becomes `async watch(rootPath: string, win: BrowserWindow): Promise<WatcherInitPayload>`:
  1. If a subscription exists, call `subscription.unsubscribe()` first.
  2. Increment `this.sessionId`.
  3. `await writeSnapshot(rootPath, snapshotPath)`.
  4. `this.subscription = await subscribe(rootPath, callback, { ignore })`.
  5. `const gapEvents = await getEventsSince(rootPath, snapshotPath)`.
  6. Build `tree` via the existing recursive read (now called internally, not via separate IPC).
  7. Return `{ sessionId: this.sessionId, tree, gapEvents }`.
- Event callback:
  ```ts
  async (err, events) => {
    if (win.isDestroyed()) return;
    if (err) { win.webContents.send('fs:watcherError', { sessionId, error: err.message }); return; }
    const enriched = await Promise.all(events.map(e => enrichEvent(e, sessionId, rootPath)));
    win.webContents.send('fs:fileChange', { sessionId, events: enriched });

    // Directory rename re-scan: if a directory was created, it may be a rename target
    // whose children need to be re-discovered
    for (const event of enriched) {
      if (event.type === 'addDir') {
        setImmediate(async () => {
          if (win.isDestroyed()) return;
          const children = await readDirectoryRecursiveFlat(event.path, rootPath);
          if (children.length > 0) {
            win.webContents.send('fs:fileChange', {
              sessionId,
              events: children.map(node => ({
                type: node.type === 'directory' ? 'addDir' as const : 'add' as const,
                path: node.path,
                sessionId,
                fileInfo: { sizeBytes: node.sizeBytes, modifiedAt: node.modifiedAt },
              })),
            });
          }
        });
      }
    }
  }
  ```
- Add `statWithRetry(absPath, retries = 3, backoff = 50)` — exponential backoff; used for `create` events since @parcel/watcher only provides path + type, not stat data. Returns `null` after exhausting retries (caller marks the event as failed, does not silently drop).

**Event type mapping:**

@parcel/watcher emits `{ type: 'create' | 'update' | 'delete', path: string }`. The app's `FileChangeEvent` uses `'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'`. The `enrichEvent` function maps between them:

```ts
async function enrichEvent(
  raw: { type: 'create' | 'update' | 'delete'; path: string },
  sessionId: number,
  rootPath: string,
): Promise<FileChangeEvent> {
  if (raw.type === 'delete') {
    // Cannot stat a deleted path — infer file vs directory from pathIndex or trailing separator
    // Default to 'unlink'; renderer can check its own store to disambiguate
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
      fileInfo: { sizeBytes: stat.size, modifiedAt: stat.mtimeMs },
    };
  }

  // raw.type === 'update'
  return {
    type: 'change',
    path: raw.path,
    sessionId,
    fileInfo: { sizeBytes: stat.size, modifiedAt: stat.mtimeMs },
  };
}
```

For `delete` events, the renderer checks its own `nodes` map to determine whether the deleted path was a file or directory and takes the appropriate action (remove node + descendants).

**Directory rename handling:**

@parcel/watcher reports directory renames as a `delete` + `create` pair for the directory itself — it does NOT emit events for the directory's children. After a directory rename:

1. The `delete` event removes the old directory and all its descendants from the renderer store (via prefix scan in `removeNodeFromTree`).
2. The `create` event adds the new directory as an empty node.

To repopulate the children, the `subscribe` callback (where `win` is in scope) checks for directory `create` events after enrichment and triggers a re-scan. This logic lives in the outer event callback — not inside `enrichEvent`, which is a pure mapping function without access to `win`. See the event callback code block above for the full implementation.

This ensures directory renames don't leave orphaned subtrees.

- Remove `debouncedSend`, `debounceTimers`, and debounce-related maps — @parcel/watcher coalesces natively in C++.
- `stop()` calls `this.subscription?.unsubscribe()` instead of `this.watcher?.close()`.
- Snapshot path: `` `${app.getPath('userData')}/watcher-snapshot-${hash(rootPath)}.txt` `` where `hash` is the same SHA-256-to-hex-16 used for `FileNode.id`.
- Ignore patterns passed to `subscribe`: `['.git', 'node_modules', '.DS_Store']`. Dotfiles beyond `.git` are **not** ignored at the watcher level — filtering happens at tree-build time to stay consistent with the initial scan.

### `electron/ipc/filesystem.ts`

- **Add** `fs:watchFolder` handler:
  ```ts
  ipcMain.handle('fs:watchFolder', async (_event, folderPath: string) => {
    return fileWatcher.watch(folderPath, mainWindow);
  });
  ```
  Returns `WatcherInitPayload`.
- **Modify** `dialog:openFolder`: strip the watcher-start call. It now only opens the dialog and returns the selected path (or `null`). The renderer is responsible for calling `fs:watchFolder` after receiving the path.
- **Modify** `readDirectoryRecursive`: raise `maxDepth` from 2 to 10 (or remove the cap). This function is still used inside `fileWatcher.watch()` to build the initial tree for the atomic payload.
- **Unify dotfile filtering:** Remove the `entry.name.startsWith('.')` check from the directory walker. Instead, apply a single shared `shouldIgnore(name)` predicate that skips `.git`, `node_modules`, and `.DS_Store` — no blanket dotfile exclusion. This matches the watcher ignore list.
- **Add** `readDirectoryRecursiveFlat(dirPath, rootPath, maxDepth = 10)`: New variant that returns a flat `FileNode[]` array with `parentId` links instead of nested `children`. Used by `fileWatcher.watch()` to build the initial tree payload and by the directory-rename re-scan. The existing nested `readDirectoryRecursive` is removed.

```ts
async function readDirectoryRecursiveFlat(
  dirPath: string,
  rootPath: string,
  maxDepth: number = 10,
  depth: number = 0,
): Promise<FileNode[]> {
  const result: FileNode[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const parentId = dirPath === rootPath ? null : hashPath(dirPath);

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    const absolutePath = path.join(dirPath, entry.name);
    const stat = await fs.stat(absolutePath);
    const isDir = entry.isDirectory();
    const node: FileNode = {
      id: hashPath(absolutePath),
      name: entry.name,
      path: absolutePath,
      type: isDir ? 'directory' : 'file',
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
      extension: isDir ? null : path.extname(entry.name) || null,
      parentId,
      position: [0, 0, 0],
    };
    result.push(node);
    if (isDir && depth < maxDepth) {
      const children = await readDirectoryRecursiveFlat(absolutePath, rootPath, maxDepth, depth + 1);
      result.push(...children);
    }
  }
  return result;
}
```
- **Modify** `fs:readDirectory`: Now calls `readDirectoryRecursiveFlat` and returns a flat `FileNode[]` array. Callers (e.g., `listDirectoryTool`) that need nested trees reconstruct them on the renderer side via `buildNestedTree`.
- **Modify** `fs:statFile`: Remove `children: []` from directory responses. Add `parentId` field — computed by hashing the parent directory path, or `null` if the file is directly under the root.

### `electron/preload.ts`

- Add to `DaxAPI`:
  ```ts
  watchFolder(path: string): Promise<WatcherInitPayload>
  // → ipcRenderer.invoke('fs:watchFolder', path)

  onWatcherError(callback: (event: WatcherErrorEvent) => void): () => void
  // → ipcRenderer.on('fs:watcherError', ...), returns unsubscribe
  ```
- Modify `onFileChange`: callback signature becomes `(event: { sessionId: number; events: FileChangeEvent[] }) => void`. The outer wrapper is unchanged (still returns an unsubscribe function).

### `vite.config.ts`

- Replace `'chokidar'` with `'@parcel/watcher'` in the main process Rollup `external` array (line 19):
  ```ts
  external: ['electron', 'electron-store', '@parcel/watcher', 'ws'],
  ```

### `electron-builder.yml`

- Add `asarUnpack` for @parcel/watcher's native binaries:
  ```yaml
  asarUnpack:
    - "node_modules/@parcel/watcher/**"
    - "node_modules/@parcel/watcher-*/**"
  ```
  Without this, the native `.node` addon cannot be loaded from inside an asar archive.

### `src/utils/treeUtils.ts` (new file)

Contains `buildNestedTree()` — the shared utility for reconstructing nested `FileNode[]` trees from the flat store. See the `buildNestedTree` section above for the full implementation.

### `src/types/index.ts`

- **`FileNode`**: Keep `children?: FileNode[]` as an optional field. Add `parentId: string | null` — set to `null` for root-level entries, otherwise the `id` of the parent directory node. Make `position` optional: `position?: [number, number, number]` — it is computed by the layout engine, not stored at rest.

  The flat store (`nodes` Map) never populates `children` — it is always `undefined` in stored nodes. Only `buildNestedTree()` creates shallow copies with `children` populated for consumers that need a nested tree. This preserves type compatibility with `spatialLayout.ts`, `tools.ts`, and `planner.ts` without code changes.

  Updated type:
  ```ts
  interface FileNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'directory';
    sizeBytes: number;
    modifiedAt: number;
    extension: string | null;
    parentId: string | null;
    children?: FileNode[];  // Only populated by buildNestedTree(); never stored in the flat store
    position?: [number, number, number]; // Computed by layout engine; not persisted
    metadata?: Record<string, unknown>;
  }
  ```
- **`FileChangeEvent`**: Add `sessionId: number`.
- **Add** `WatcherInitPayload`:
  ```ts
  interface WatcherInitPayload {
    sessionId: number;
    tree: FileNode[];       // flat list, parentId links
    gapEvents: FileChangeEvent[];
  }
  ```
- **Add** `WatcherErrorEvent`:
  ```ts
  interface WatcherErrorEvent {
    sessionId: number;
    error: string;
  }
  ```
- **Update** `FileChangeEvent`:
  ```ts
  interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
    path: string;
    sessionId: number;
    fileInfo?: FileChangeEventStat;
  }
  ```
  The `sessionId` field is added. The event type vocabulary is preserved (not changed to @parcel/watcher's `create`/`update`/`delete`) — the mapping happens in `enrichEvent` on the main process side.

- **Simplify** `FileChangeEventStat`: The current type carries `id`, `name`, `extension`, `sizeBytes`, and `modifiedAt`. Since the renderer can derive `id` (SHA-256 hash of path), `name` (last path segment), and `extension` (from name) from the event's `path` field, simplify the type to only the fields `enrichEvent` actually returns:
  ```ts
  interface FileChangeEventStat {
    sizeBytes: number;
    modifiedAt: number;
  }
  ```
  This matches the `fileInfo` payload produced by `enrichEvent` and avoids redundant data on the wire.

- **Update** `onFileChange` in `DaxAPI`:
  ```ts
  onFileChange(callback: (event: { sessionId: number; events: FileChangeEvent[] }) => void): () => void;
  ```
  Now receives a batch of events with a session ID wrapper.

### `src/stores/fileTreeStore.ts`

**State additions:**

- `pathIndex: Map<string, string>` — absolute path → node id. Maintained in lockstep with `nodes`.
- `knownSessionId: number | null` — set on init, checked on every incoming event.
- `childrenIndex: Map<string, string[]>` — parent id → ordered child ids. Maintained in lockstep with `nodes` and `pathIndex`. Provides O(1) children lookup for any directory, enabling efficient tree reconstruction, `MoveDialog` subdirectory listing, and O(k) subtree removal (where k = number of descendants).
- `unsubFileChange: (() => void) | null` — stores the cleanup function for the current `onFileChange` listener. Called on `reset()` and before re-init.

**`flattenTree` removal / replacement:**

`flattenTree` currently recurses into `node.children` to build a flat map. With the migration to a flat tree payload (array with `parentId` links), flattening is no longer needed — just iterate the array and insert into `nodes` + `pathIndex`. The `children` field remains on the type but is never populated in stored nodes, so `flattenTree` is removed.

**`insertNode` rewrite:**

```ts
insertNode: (node: FileNode) => {
  set((state) => {
    const nodes = new Map(state.nodes);
    const pathIndex = new Map(state.pathIndex);
    const childrenIndex = new Map(state.childrenIndex);
    const rootChildren = [...state.rootChildren];
    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
    const parentId = parentPath === state.rootPath
      ? null
      : pathIndex.get(parentPath) ?? null;

    if (parentId === null && parentPath !== state.rootPath) {
      console.warn(`insertNode: parent missing for ${node.path}`);
      return state;
    }

    node.parentId = parentId;
    nodes.set(node.id, node);
    pathIndex.set(node.path, node.id);

    // Update childrenIndex
    const parentKey = parentId ?? '__root__';
    const siblings = childrenIndex.get(parentKey) ?? [];
    childrenIndex.set(parentKey, [...siblings, node.id]);

    // Init empty children list for new directories
    if (node.type === 'directory') {
      childrenIndex.set(node.id, []);
    }

    if (parentId === null) {
      rootChildren.push(node.id);
    }

    return { nodes, pathIndex, childrenIndex, rootChildren };
  });
}
```

Uses `set(state => ...)` to preserve Zustand's immutability guarantee for concurrent updates.

**`removeNodeFromTree` rewrite:**

**Signature change:** parameter changes from `id: string` to `targetPath: string` — all callers updated to pass the absolute path.

```ts
removeNodeFromTree: (targetPath: string) => {
  set((state) => {
    const nodes = new Map(state.nodes);
    const pathIndex = new Map(state.pathIndex);
    const childrenIndex = new Map(state.childrenIndex);
    const rootChildren = [...state.rootChildren];
    const targetId = pathIndex.get(targetPath);
    if (!targetId) return state;

    // Collect target + all descendants via childrenIndex (O(k) where k = subtree size)
    const toRemove: string[] = [];
    const collect = (id: string) => {
      toRemove.push(id);
      const childIds = childrenIndex.get(id) ?? [];
      for (const childId of childIds) collect(childId);
    };
    collect(targetId);

    // Remove all collected nodes + associated overrides
    const positionOverrides = new Map(state.positionOverrides);
    const sizeOverrides = new Map(state.sizeOverrides);
    for (const id of toRemove) {
      const node = nodes.get(id);
      if (node) {
        pathIndex.delete(node.path);
        childrenIndex.delete(id);
      }
      nodes.delete(id);
      positionOverrides.delete(id);
      sizeOverrides.delete(id);
    }

    // Remove target from its parent's children list
    const target = state.nodes.get(targetId);
    if (target) {
      const parentKey = target.parentId ?? '__root__';
      const siblings = childrenIndex.get(parentKey);
      if (siblings) {
        childrenIndex.set(parentKey, siblings.filter(id => id !== targetId));
      }
    }

    return {
      nodes,
      pathIndex,
      childrenIndex,
      rootChildren: rootChildren.filter(id => id !== targetId),
      positionOverrides,
      sizeOverrides,
    };
  });
}
```

Uses `childrenIndex` for O(k) subtree removal where k = number of descendants. No prefix scan needed.

**`getNodeByPath`:**

```ts
getNodeByPath: (absPath: string) => {
  const { pathIndex, nodes } = get();
  const id = pathIndex.get(absPath);
  return id ? nodes.get(id) ?? null : null;
}
```

O(1).

**`getChildrenOf`:**

```ts
getChildrenOf: (parentId: string | null) => {
  const { childrenIndex, nodes } = get();
  const key = parentId ?? '__root__';
  const childIds = childrenIndex.get(key) ?? [];
  return childIds.map(id => nodes.get(id)).filter((n): n is FileNode => n !== undefined);
}
```

O(k) where k = number of children. Used by layout tree reconstruction, `MoveDialog`, and agent tree formatting.

**`getParentDirectory` rewrite:**

```ts
getParentDirectory: (fileId: string) => {
  const { nodes } = get();
  const node = nodes.get(fileId);
  if (!node || !node.parentId) return null;
  return nodes.get(node.parentId) ?? null;
}
```

O(1). Uses `parentId` directly instead of scanning all nodes by path.

**New `initWatcher` action:**

```ts
initWatcher: async (folderPath: string) => {
  const { unsubFileChange } = get();
  if (unsubFileChange) unsubFileChange();

  const pendingPayloads: Array<{ sessionId: number; events: FileChangeEvent[] }> = [];
  let initialized = false;

  const unsub = window.electronAPI.onFileChange((payload) => {
    if (!initialized) {
      pendingPayloads.push(payload);
      return;
    }
    if (payload.sessionId !== get().knownSessionId) return;
    for (const event of payload.events) {
      get().applyFileChange(event);
    }
  });

  const { sessionId, tree, gapEvents } = await window.electronAPI.watchFolder(folderPath);

  const nodes = new Map<string, FileNode>();
  const pathIndex = new Map<string, string>();
  const childrenIndex = new Map<string, string[]>();
  const rootChildren: string[] = [];

  childrenIndex.set('__root__', []);

  for (const node of tree) {
    nodes.set(node.id, node);
    pathIndex.set(node.path, node.id);

    if (node.parentId === null) {
      rootChildren.push(node.id);
      childrenIndex.get('__root__')!.push(node.id);
    } else {
      const siblings = childrenIndex.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenIndex.set(node.parentId, siblings);
    }

    if (node.type === 'directory' && !childrenIndex.has(node.id)) {
      childrenIndex.set(node.id, []);
    }
  }

  set({ nodes, pathIndex, childrenIndex, rootChildren, rootPath: folderPath, knownSessionId: sessionId, unsubFileChange: unsub });

  for (const event of gapEvents) {
    get().applyFileChange(event);
  }

  // Replay buffered live events, filtering to the correct session
  initialized = true;
  for (const payload of pendingPayloads) {
    if (payload.sessionId !== sessionId) continue;
    for (const event of payload.events) {
      get().applyFileChange(event);
    }
  }
}
```

**`applyFileChange`:**

Replaces the switch block from the old `initFileChangeListener`. Handles all event types with the new data structures:

```ts
applyFileChange: (event: FileChangeEvent) => {
  const { nodes, pathIndex } = get();
  const hashPath = (p: string): string => {
    // Same SHA-256-to-hex-16 as FileNode.id
    // (imported from a shared util)
  };

  switch (event.type) {
    case 'add':
    case 'addDir': {
      const existingId = pathIndex.get(event.path);
      if (existingId && event.fileInfo) {
        get().updateNode(existingId, event.fileInfo);
        break;
      }
      if (existingId) break; // exists but no new fileInfo
      const name = event.path.substring(event.path.lastIndexOf('/') + 1);
      const isDir = event.type === 'addDir';
      const newNode: FileNode = {
        id: hashPath(event.path),
        name,
        path: event.path,
        type: isDir ? 'directory' : 'file',
        sizeBytes: event.fileInfo?.sizeBytes ?? 0,
        modifiedAt: event.fileInfo?.modifiedAt ?? Date.now(),
        extension: isDir ? null : (name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.')) : null),
        parentId: null, // set by insertNode
        position: [0, 0, 0],
      };
      get().insertNode(newNode);
      break;
    }
    case 'change': {
      const nodeId = get().pathIndex.get(event.path);
      if (nodeId && event.fileInfo) get().updateNode(nodeId, event.fileInfo);
      break;
    }
    case 'unlink':
    case 'unlinkDir': {
      // Note: enrichEvent always emits 'unlink' for deletes (cannot stat a deleted path to
      // distinguish file vs directory). 'unlinkDir' is retained in the type for backward
      // compatibility but is never emitted by the new watcher. The renderer uses its own
      // nodes map (via removeNodeFromTree) to handle both files and directories uniformly.
      get().removeNodeFromTree(event.path);
      break;
    }
  }
}
```

**`buildNestedTree` — tree reconstruction utility:**

Consumers that need a nested tree (layout engine, agent planner, agent tools, `MoveDialog`) call this utility. It reconstructs a `FileNode[]` with `children` populated from the flat store. Lives in `src/utils/treeUtils.ts`.

```ts
import type { FileNode } from '@/types';
import { useFileTreeStore } from '@/stores/fileTreeStore';

/**
 * Reconstruct a nested FileNode[] tree from the flat store.
 * Each returned node gets a `children` array populated from childrenIndex.
 * Optionally limited to a subtree rooted at a specific node id.
 */
export function buildNestedTree(rootId?: string): FileNode[] {
  const { nodes, childrenIndex } = useFileTreeStore.getState();

  function buildNode(id: string): FileNode & { children?: FileNode[] } {
    const node = nodes.get(id)!;
    const childIds = childrenIndex.get(id) ?? [];
    if (node.type === 'directory' && childIds.length > 0) {
      return { ...node, children: childIds.map(buildNode) };
    }
    return { ...node };
  }

  const parentKey = rootId ?? '__root__';
  const topIds = childrenIndex.get(parentKey) ?? [];
  return topIds.map(buildNode);
}
```

Performance: O(n) where n is the subtree size. Called inside `useMemo` so it only recomputes when `nodes` changes.

### Consumers of `.children` — migration details

The `children` field is retained as optional on `FileNode` but is never populated in the flat store. Consumers that need nested trees call `buildNestedTree()`, which creates shallow copies with `children` populated. The following files need updates to use `buildNestedTree()` or `getChildrenOf()` instead of relying on the store's nodes having `children` pre-populated:

**`src/scene/layout/spatialLayout.ts`** — `calculateLayout`, `countLeafFiles`, `computeTotalLogArea`, `computeTotalSize`, `buildTree`

No changes needed. The `FileNode` type retains the optional `children` field. `calculateLayout` receives nodes with `children` populated by `buildNestedTree()`, identical to the current behavior. The layout engine's interface and implementation are unchanged.

**`src/scene/Workspace.tsx`** — `buildRootTree`

Replace `buildRootTree` with a call to `buildNestedTree`:

```ts
import { buildNestedTree } from '@/utils/treeUtils';

// Inside Workspace component:
const rootTree = useMemo(() => buildNestedTree(), [nodes, childrenIndex]);
const { entries, bounds } = useMemo(
  () => calculateLayout(rootTree, rootPath),
  [rootTree, rootPath],
);
```

The `buildRootTree` function is removed.

**`src/agent/tools.ts`** — `getFileTreeSnapshot`, `flattenNodes`, `formatFileTree`

- `getFileTreeSnapshot`: Returns `buildNestedTree()` instead of manually collecting root nodes. The returned tree has `children` populated by `buildNestedTree()`.
- `flattenNodes`: No changes needed — it recurses into `.children` which is populated by `buildNestedTree()`, identical to the current behavior.
- `formatFileTree`: No changes needed — it recurses into `.children` which is populated by `buildNestedTree()`, identical to the current behavior.
- `listDirectoryTool`: Change from calling `readDirectory` IPC to using `buildNestedTree(dirNodeId)`:
  ```ts
  execute: async (args) => {
    const { getNodeByPath } = useFileTreeStore.getState();
    const dirNode = getNodeByPath(args['path']);
    if (!dirNode) return `Directory not found: ${args['path']}`;
    const subtree = buildNestedTree(dirNode.id);
    return formatFileTree(subtree);
  }
  ```

**`src/agent/planner.ts`** — `buildFileTreeSummary`

No changes needed. `buildFileTreeSummary` recurses into `.children` which is populated by `buildNestedTree()` via `getFileTreeSnapshot`. The `FileNode` type retains the optional `children` field, so the function signature and implementation are unchanged.

**`src/ui/MoveDialog.tsx`** — `DirTreeItem`

Replace `node.children` access with store selector:
```ts
const childDirs = useMemo(() => {
  const { getChildrenOf } = useFileTreeStore.getState();
  return getChildrenOf(node.id).filter(c => c.type === 'directory');
}, [node.id, nodes]);
```

**`src/ui/CommandBar.tsx`** — `collectRootNodes`

Replace with: `return buildNestedTree();`

**`openFolder` / `loadFolder` convergence:**

Both call `get().initWatcher(folderPath)`. `openFolder` gets the path from the dialog first; `loadFolder` gets it from persisted settings. Same downstream path.

**`initFileChangeListener`**: Replaced by the listener setup inside `initWatcher`. The standalone function is removed.

**Other store functions to update:**

- **`setNodes`**: Currently calls `flattenTree()`. Update to accept a flat `FileNode[]` array and build `nodes`, `pathIndex`, `childrenIndex` from it (same indexing logic as `initWatcher`'s tree parsing loop). Rebuild `rootChildren` from nodes with `parentId === null`.
- **`addNode`**: Currently a simple wrapper that inserts into the `nodes` Map. Update to delegate to `insertNode` (which maintains `pathIndex` and `childrenIndex` in lockstep). If the two are functionally equivalent after the rewrite, remove `addNode` and migrate callers to `insertNode`.
- **`removeNode`**: Currently deletes from `nodes` and filters `rootChildren`. Update to delegate to `removeNodeFromTree` (which also cleans up `pathIndex`, `childrenIndex`, `positionOverrides`, and `sizeOverrides`). If functionally equivalent, remove `removeNode` and migrate callers to `removeNodeFromTree`.
- **`reset()`**: Must clear the new state fields in addition to the existing ones:
  ```ts
  reset: () => {
    const { unsubFileChange } = get();
    if (unsubFileChange) unsubFileChange();
    set({
      rootPath: null,
      nodes: new Map<string, FileNode>(),
      rootChildren: [],
      pathIndex: new Map<string, string>(),
      childrenIndex: new Map<string, string[]>(),
      knownSessionId: null,
      unsubFileChange: null,
      isLoading: false,
      error: null,
      searchQuery: '',
      positionOverrides: new Map<string, [number, number, number]>(),
      sizeOverrides: new Map<string, [number, number]>(),
      layoutGeneration: 0,
      workspaceBounds: null,
      layoutMap: new Map<string, LayoutEntry>(),
    });
  }
  ```
  The `reset` action must also call `unsubFileChange()` to tear down the live event listener before clearing state.

## 4. Migration Steps

1. `npm install @parcel/watcher && npm uninstall chokidar`
2. Update `vite.config.ts` — replace `'chokidar'` with `'@parcel/watcher'` in Rollup externals.
3. Update `electron-builder.yml` — add `asarUnpack` for `@parcel/watcher` native binaries.
4. Run `npx electron-rebuild` to rebuild native modules for the project's Electron ABI.
5. Update `FileNode` in `src/types/index.ts` — keep `children` as optional, add `parentId`, make `position` optional. Simplify `FileChangeEventStat` to `{ sizeBytes, modifiedAt }`. Add `WatcherInitPayload`, `WatcherErrorEvent`. Update `FileChangeEvent` with `sessionId`. Update `DaxAPI` interface with `watchFolder`, `onWatcherError`, and the new `onFileChange` batch signature.
6. Create `src/utils/treeUtils.ts` — add `buildNestedTree()` utility.
7. Update `fileTreeStore` — add `pathIndex`, `childrenIndex`, `knownSessionId`, `unsubFileChange` to state. Rewrite `insertNode`, `removeNodeFromTree`, `getNodeByPath`, `getParentDirectory`. Add `getChildrenOf`, `initWatcher`, `applyFileChange` actions. Remove `flattenTree` and `initFileChangeListener`.
8. Rewrite `FileWatcherService` in `electron/services/fileWatcher.ts` — @parcel/watcher subscribe/snapshot/getEventsSince flow, `sessionId` counter, `statWithRetry`, `enrichEvent` with event type mapping, directory rename re-scan, error handling. Remove debounce system. (Note: the directory-rename re-scan calls `readDirectoryRecursiveFlat`, which is created in step 9. Implement steps 8 and 9 together.)
9. Update `electron/ipc/filesystem.ts` — replace `readDirectoryRecursive` with `readDirectoryRecursiveFlat`. Add `fs:watchFolder` handler. Modify `dialog:openFolder` to only return the path. Modify `fs:statFile` to include `parentId` and remove `children`. Unify dotfile filtering with `shouldIgnore` predicate.
10. Update `electron/preload.ts` — add `watchFolder`, `onWatcherError`. Update `onFileChange` signature to receive `{ sessionId, events[] }`.
11. Wire `openFolder` and `loadFolder` in the store to both call `initWatcher`.
12. Migrate `.children` consumers:
    - `src/scene/Workspace.tsx` — replace `buildRootTree` with `buildNestedTree()`.
    - `src/scene/layout/spatialLayout.ts` — no changes needed; receives nested tree from caller.
    - `src/agent/tools.ts` — update `getFileTreeSnapshot` to use `buildNestedTree()`. Update `listDirectoryTool` to use `buildNestedTree(dirNodeId)`.
    - `src/agent/planner.ts` — no changes needed; receives nested tree from caller.
    - `src/ui/MoveDialog.tsx` — replace `node.children` access with `getChildrenOf(node.id)`.
    - `src/ui/CommandBar.tsx` — replace `collectRootNodes` with `buildNestedTree()`.
13. Run `npm run typecheck` to catch any remaining `children` references or type mismatches.
14. Manual test matrix (see Section 6).

## 5. Risks

- **Native compilation.** `@parcel/watcher` ships prebuilt binaries for most platforms, but Electron's Node ABI may not match. Run `npx electron-rebuild` after install; if that fails, add `@parcel/watcher` to `electron-builder.yml` `externals` and configure `prebuild-install` or `node-gyp` in CI. Test on all target platforms.
- **`getEventsSince` on Linux.** Without Watchman installed, `getEventsSince` falls back to a brute-force directory walk + diff against the snapshot. This is correct but slow on large trees. For typical project sizes (<50k files) this is fine; for monorepos, consider shipping with Watchman or documenting it as an optional dependency.
- **`children` field semantics change.** The `children` field is retained as optional on `FileNode` but is never populated in the flat store — only `buildNestedTree()` fills it. Code that accesses `node.children` on nodes retrieved directly from the store (without going through `buildNestedTree()`) will see `undefined`. This won't break at compile time since the field is optional, so dynamic access patterns (e.g., agent tool code building prompts from the tree) must be audited to ensure they use `buildNestedTree()` output. Grep for `\.children` across `src/` and `electron/` to find all usages before starting step 8.
- **Large directory initial load.** Removing the depth-2 cap means the initial `readDirectoryRecursive` may take seconds on large repos. Mitigations: (a) stream the tree in chunks via `webContents.send` if it exceeds a threshold, (b) show a loading indicator in the HUD, (c) keep a high but finite cap (depth 10) as a safety valve.
- **Snapshot file lifecycle.** Snapshot files in `userData` accumulate if the user opens many different folders. Add cleanup: delete snapshot files for roots that are no longer the active folder, either on `watch()` or on app quit.
- **Directory rename orphans.** @parcel/watcher reports directory renames as `delete` + `create` for the directory only — children get no events. Without the re-scan logic in the subscribe callback, a directory rename permanently orphans all descendants. The re-scan adds latency proportional to the subtree size.
- **IPC serialization cost.** Electron's structured clone serialization of a flat `FileNode[]` with 50k entries produces a ~50–100 MB payload, blocking both main and renderer processes. For repos exceeding ~20k files, consider chunked streaming via `webContents.send` with a progress indicator. The threshold and chunking strategy should be determined empirically during testing.
- **Concurrent `initWatcher` calls.** If the user rapidly opens two different folders, two `initWatcher` calls race. The main process handles this (unsubscribes the old watcher first), but the renderer's `knownSessionId` could be overwritten mid-flight. Mitigation: debounce folder-open at the UI level, or add an `initInProgress` lock in the store.
- **Live events during IPC round-trip.** ~~Mitigated.~~ The `initWatcher` action registers the `onFileChange` listener *before* `await watchFolder()` and buffers incoming payloads in a `pendingPayloads` array. After the tree is built and `knownSessionId` is set, buffered payloads matching the session are replayed. No events are lost.
- **`win.isDestroyed()` guard.** The proposed event callback in `fileWatcher.ts` must check `win.isDestroyed()` before calling `send()`, matching the existing guard in the current implementation. Without this, a renderer crash causes the watcher callback to throw.
- **Symlink cycles.** @parcel/watcher follows symlinks by default. A circular symlink (e.g., `ln -s .. loop`) can cause infinite directory traversal in `readDirectoryRecursiveFlat`. Add cycle detection via an `inode` set, or limit `maxDepth` as a safety valve.
- **`dist/` directory inconsistency.** The current initial scan includes `dist/`, `dist-electron/`, and `dist-renderer/` directories, but the watcher ignores them. Unify by adding these to the `shouldIgnore` predicate.

## 6. Test Matrix

Comprehensive manual and automated test scenarios:

### Core functionality
- Open folder → verify full tree at all depths (not capped at depth 2)
- Quit and relaunch → auto-restore shows the same tree, watcher is active, file changes are detected
- Create / delete / rename files at depth > 2
- Create / delete / rename files at depth 1 (root level)

### Session isolation
- Open a new folder while the previous one is active → no stale events from the old folder
- Open folder A → make changes → open folder B → verify folder A's pending events don't appear in B's tree

### Error resilience
- Trigger a permission error (e.g., `chmod 000` a subdirectory) → error surfaces via `onWatcherError`, watcher continues for other paths
- Create a file that immediately gets deleted before `statWithRetry` completes → no crash, no ghost node:

### Edge cases
- **Directory rename** (`mv src/ lib/`) → verify all descendants are correctly re-mapped via re-scan
- **Rapid file churn** (`git checkout` switching branches with hundreds of file changes) → verify store convergence, no orphans, no ghosts
- **Symlink cycle** → verify no infinite loop or hang
- **Non-ASCII filenames** (e.g., `café.txt`, emoji filenames) → verify correct insertion and lookup in `pathIndex`
- **Large binary files** being written slowly → stat during write returns incomplete size, subsequent `change` event corrects it
- **Concurrent folder opens** → rapid sequential "Open Folder" clicks don't corrupt state

### Build and packaging
- `npm run typecheck` passes with zero errors
- `npx electron-rebuild` succeeds for the project's Electron version
- `npm run package` produces a working distributable with @parcel/watcher native binaries
- The packaged app correctly loads @parcel/watcher from the unpacked asar location

### Ghost and orphan detection
- Watch for ghost nodes (present in store but not on disk) — after any file operation, every node in `nodes` should correspond to a real file
- Watch for orphan nodes (on disk but missing from store) — after any file operation, `find` the disk tree and compare with store contents
- After a directory rename re-scan, verify `pathIndex` has no entries for the old path prefix
