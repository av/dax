import { create } from 'zustand';
import { sha256Hex } from '@/utils/sha256';
import type { FileNode, FileChangeEvent } from '@/types';
import type { WorkspaceBounds, LayoutEntry } from '@/scene/layout/spatialLayout';

// ── Helpers ──────────────────────────────────────────

function hashPath(absolutePath: string): string {
  return sha256Hex(absolutePath).slice(0, 16);
}

// ── Types ────────────────────────────────────────────

interface FileTreeState {
  rootPath: string | null;
  nodes: Map<string, FileNode>;
  rootChildren: string[];
  pathIndex: Map<string, string>;
  childrenIndex: Map<string, string[]>;
  knownSessionId: number | null;
  unsubFileChange: (() => void) | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  positionOverrides: Map<string, [number, number, number]>;
  sizeOverrides: Map<string, [number, number]>;
  layoutGeneration: number;
  workspaceBounds: WorkspaceBounds | null;
  layoutMap: Map<string, LayoutEntry>;

  openFolder: () => Promise<void>;
  loadFolder: (folderPath: string) => Promise<void>;
  initWatcher: (folderPath: string) => Promise<void>;
  applyFileChange: (event: FileChangeEvent) => void;
  setRootPath: (path: string) => void;
  setNodes: (nodes: FileNode[]) => void;
  addNode: (node: FileNode) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, partial: Partial<FileNode>) => void;
  insertNode: (node: FileNode) => void;
  removeNodeFromTree: (targetPath: string) => void;
  getNodeByPath: (filePath: string) => FileNode | undefined;
  getParentDirectory: (fileId: string) => FileNode | null;
  getChildrenOf: (parentId: string | null) => FileNode[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  getSearchResults: () => string[];
  setPositionOverride: (fileId: string, pos: [number, number, number]) => void;
  clearPositionOverride: (fileId: string) => void;
  setSizeOverride: (dirId: string, size: [number, number]) => void;
  clearSizeOverride: (dirId: string) => void;
  setWorkspaceBounds: (bounds: WorkspaceBounds) => void;
  setLayoutMap: (layoutMap: Map<string, LayoutEntry>) => void;
  resetLayout: () => void;
  reset: () => void;
}

// ── Store ────────────────────────────────────────────

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
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

  // ── initWatcher ────────────────────────────────────

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

    set({
      nodes,
      pathIndex,
      childrenIndex,
      rootChildren,
      rootPath: folderPath,
      knownSessionId: sessionId,
      unsubFileChange: unsub,
      isLoading: false,
    });

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
  },

  // ── applyFileChange ────────────────────────────────

  applyFileChange: (event: FileChangeEvent) => {
    switch (event.type) {
      case 'add':
      case 'addDir': {
        const existingId = get().pathIndex.get(event.path);
        if (existingId && event.fileInfo) {
          get().updateNode(existingId, event.fileInfo);
          break;
        }
        if (existingId) break;
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
        get().removeNodeFromTree(event.path);
        break;
      }
    }
  },

  // ── Folder operations ──────────────────────────────

  openFolder: async () => {
    set({ isLoading: true, error: null });
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) {
        set({ isLoading: false });
        return;
      }

      await get().initWatcher(folderPath);

      // Warn about very large directories (> 5 000 files)
      const LARGE_DIR_THRESHOLD = 5000;
      if (import.meta.env.DEV && get().nodes.size > LARGE_DIR_THRESHOLD) {
        console.warn(
          `[Dax] Large directory detected (${get().nodes.size} nodes). Performance may be affected.`,
        );
      }

      // Persist last opened folder
      window.electronAPI.getSettings()
        .then((s) => window.electronAPI.saveSettings({ ...s, lastOpenedFolder: folderPath }))
        .catch(() => { /* non-critical */ });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open folder';
      set({ error: message, isLoading: false });
    }
  },

  loadFolder: async (folderPath: string) => {
    set({ isLoading: true, error: null });
    try {
      await get().initWatcher(folderPath);

      // Persist last opened folder
      window.electronAPI.getSettings()
        .then((s) => window.electronAPI.saveSettings({ ...s, lastOpenedFolder: folderPath }))
        .catch(() => { /* non-critical */ });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: `Failed to read folder: ${msg}`, isLoading: false });
    }
  },

  setRootPath: (path: string) => set({ rootPath: path }),

  setNodes: (nodeList: FileNode[]) => {
    const nodes = new Map<string, FileNode>();
    const pathIndex = new Map<string, string>();
    const childrenIndex = new Map<string, string[]>();
    const rootChildren: string[] = [];

    childrenIndex.set('__root__', []);

    for (const node of nodeList) {
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

    set({ nodes, pathIndex, childrenIndex, rootChildren });
  },

  addNode: (node: FileNode) => {
    get().insertNode(node);
  },

  removeNode: (id: string) => {
    const node = get().nodes.get(id);
    if (node) {
      get().removeNodeFromTree(node.path);
    }
  },

  updateNode: (id: string, partial: Partial<FileNode>) =>
    set((state) => {
      const existing = state.nodes.get(id);
      if (!existing) return state;
      const updated = { ...existing, ...partial };
      const nodes = new Map(state.nodes);
      nodes.set(id, updated);

      // If the path changed, update pathIndex
      const pathIndex = new Map(state.pathIndex);
      if (partial.path && partial.path !== existing.path) {
        pathIndex.delete(existing.path);
        pathIndex.set(partial.path, id);
      }

      return { nodes, pathIndex };
    }),

  insertNode: (node: FileNode) =>
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

      node = { ...node, parentId };
      nodes.set(node.id, node);
      pathIndex.set(node.path, node.id);

      // Update childrenIndex
      const parentKey = parentId ?? '__root__';
      const siblings = [...(childrenIndex.get(parentKey) ?? [])];
      siblings.push(node.id);
      childrenIndex.set(parentKey, siblings);

      // Init empty children list for new directories
      if (node.type === 'directory' && !childrenIndex.has(node.id)) {
        childrenIndex.set(node.id, []);
      }

      if (parentId === null) {
        rootChildren.push(node.id);
      }

      return { nodes, pathIndex, childrenIndex, rootChildren };
    }),

  removeNodeFromTree: (targetPath: string) =>
    set((state) => {
      const targetId = state.pathIndex.get(targetPath);
      if (!targetId) return state;

      const nodes = new Map(state.nodes);
      const pathIndex = new Map(state.pathIndex);
      const childrenIndex = new Map(state.childrenIndex);
      const rootChildren = [...state.rootChildren];

      // Collect target + all descendants via childrenIndex
      const toRemove: string[] = [];
      const collect = (id: string): void => {
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
        }
        childrenIndex.delete(id);
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
    }),

  getNodeByPath: (filePath: string) => {
    const { pathIndex, nodes } = get();
    const id = pathIndex.get(filePath);
    return id ? nodes.get(id) : undefined;
  },

  getParentDirectory: (fileId: string) => {
    const { nodes } = get();
    const node = nodes.get(fileId);
    if (!node || !node.parentId) return null;
    return nodes.get(node.parentId) ?? null;
  },

  getChildrenOf: (parentId: string | null) => {
    const { childrenIndex, nodes } = get();
    const key = parentId ?? '__root__';
    const childIds = childrenIndex.get(key) ?? [];
    return childIds.map(id => nodes.get(id)).filter((n): n is FileNode => n !== undefined);
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  getSearchResults: () => {
    const { nodes, searchQuery } = get();
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: string[] = [];
    for (const node of nodes.values()) {
      if (node.type !== 'file') continue;
      const nameMatch = node.name.toLowerCase().includes(q);
      const extMatch = node.extension ? node.extension.toLowerCase().includes(q) : false;
      const pathMatch = node.path.toLowerCase().includes(q);
      if (nameMatch || extMatch || pathMatch) {
        results.push(node.id);
      }
    }
    return results;
  },

  setPositionOverride: (fileId, pos) =>
    set((state) => {
      const overrides = new Map(state.positionOverrides);
      overrides.set(fileId, pos);
      return { positionOverrides: overrides };
    }),

  clearPositionOverride: (fileId) =>
    set((state) => {
      const overrides = new Map(state.positionOverrides);
      overrides.delete(fileId);
      return { positionOverrides: overrides };
    }),

  setSizeOverride: (dirId, size) =>
    set((state) => {
      const overrides = new Map(state.sizeOverrides);
      overrides.set(dirId, size);
      return { sizeOverrides: overrides };
    }),

  clearSizeOverride: (dirId) =>
    set((state) => {
      const overrides = new Map(state.sizeOverrides);
      overrides.delete(dirId);
      return { sizeOverrides: overrides };
    }),

  setWorkspaceBounds: (bounds) => set({ workspaceBounds: bounds }),

  setLayoutMap: (layoutMap) => set({ layoutMap }),

  resetLayout: () =>
    set((state) => ({
      positionOverrides: new Map(),
      sizeOverrides: new Map(),
      layoutGeneration: state.layoutGeneration + 1,
    })),

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
  },
}));
