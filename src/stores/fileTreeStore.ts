import { create } from 'zustand';
import type { FileNode } from '@/types';
import type { WorkspaceBounds, LayoutEntry } from '@/scene/layout/spatialLayout';

// ── Helpers ──────────────────────────────────────────

function getParentPath(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep > 0 ? filePath.substring(0, lastSep) : '';
}

// ── Types ────────────────────────────────────────────

interface FileTreeState {
  rootPath: string | null;
  nodes: Map<string, FileNode>;
  rootChildren: string[];
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
  setRootPath: (path: string) => void;
  setNodes: (nodes: FileNode[]) => void;
  addNode: (node: FileNode) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, partial: Partial<FileNode>) => void;
  insertNode: (node: FileNode) => void;
  removeNodeFromTree: (id: string) => void;
  getNodeByPath: (filePath: string) => FileNode | undefined;
  getParentDirectory: (fileId: string) => FileNode | null;
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

function flattenTree(nodes: FileNode[]): Map<string, FileNode> {
  const map = new Map<string, FileNode>();
  function recurse(list: FileNode[]): void {
    for (const node of list) {
      map.set(node.id, node);
      if (node.children) {
        recurse(node.children);
      }
    }
  }
  recurse(nodes);
  return map;
}

// ── Store ────────────────────────────────────────────

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  nodes: new Map<string, FileNode>(),
  rootChildren: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  positionOverrides: new Map<string, [number, number, number]>(),
  sizeOverrides: new Map<string, [number, number]>(),
  layoutGeneration: 0,
  workspaceBounds: null,
  layoutMap: new Map<string, LayoutEntry>(),

  openFolder: async () => {
    set({ isLoading: true, error: null });
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) {
        set({ isLoading: false });
        return;
      }

      let tree: FileNode[];
      try {
        tree = await window.electronAPI.readDirectory(folderPath);
      } catch (readErr: unknown) {
        const msg = readErr instanceof Error ? readErr.message : String(readErr);
        const isPermission = /EACCES|EPERM|permission denied/i.test(msg);
        set({
          error: isPermission
            ? 'Permission denied — cannot read this folder.'
            : `Failed to read folder: ${msg}`,
          isLoading: false,
        });
        return;
      }

      const nodeMap = flattenTree(tree);
      const rootChildren = tree.map((node) => node.id);

      // Warn about very large directories (> 5 000 files)
      const LARGE_DIR_THRESHOLD = 5000;
      if (import.meta.env.DEV && nodeMap.size > LARGE_DIR_THRESHOLD) {
        console.warn(
          `[Dax] Large directory detected (${nodeMap.size} nodes). Performance may be affected.`,
        );
      }

      set({ rootPath: folderPath, nodes: nodeMap, rootChildren, isLoading: false });
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
    let tree: FileNode[];
    try {
      tree = await window.electronAPI.readDirectory(folderPath);
    } catch (readErr: unknown) {
      const msg = readErr instanceof Error ? readErr.message : String(readErr);
      set({ error: `Failed to read folder: ${msg}`, isLoading: false });
      return;
    }
    const nodeMap = flattenTree(tree);
    const rootChildren = tree.map((node) => node.id);
    set({ rootPath: folderPath, nodes: nodeMap, rootChildren, isLoading: false });
    // Persist last opened folder
    window.electronAPI.getSettings()
      .then((s) => window.electronAPI.saveSettings({ ...s, lastOpenedFolder: folderPath }))
      .catch(() => { /* non-critical */ });
  },

  setRootPath: (path: string) => set({ rootPath: path }),

  setNodes: (nodes: FileNode[]) => {
    const nodeMap = flattenTree(nodes);
    const rootChildren = nodes.map((node) => node.id);
    set({ nodes: nodeMap, rootChildren });
  },

  addNode: (node: FileNode) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(node.id, node);
      return { nodes };
    }),

  removeNode: (id: string) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.delete(id);
      return {
        nodes,
        rootChildren: state.rootChildren.filter((childId) => childId !== id),
      };
    }),

  updateNode: (id: string, partial: Partial<FileNode>) =>
    set((state) => {
      const existing = state.nodes.get(id);
      if (!existing) return state;
      const nodes = new Map(state.nodes);
      nodes.set(id, { ...existing, ...partial });
      return { nodes };
    }),

  insertNode: (node: FileNode) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      if (nodes.has(node.id)) return state;

      nodes.set(node.id, node);

      const parentPath = getParentPath(node.path);
      let rootChildren = state.rootChildren;
      let parentFound = false;

      for (const [id, existing] of nodes) {
        if (existing.type === 'directory' && existing.path === parentPath) {
          nodes.set(id, {
            ...existing,
            children: [...(existing.children ?? []), node],
          });
          parentFound = true;
          break;
        }
      }

      if (!parentFound && parentPath === state.rootPath) {
        rootChildren = [...state.rootChildren, node.id];
      }

      return { nodes, rootChildren };
    }),

  removeNodeFromTree: (id: string) =>
    set((state) => {
      const target = state.nodes.get(id);
      if (!target) return state;

      const nodes = new Map(state.nodes);
      const idsToRemove = new Set<string>([id]);

      if (target.type === 'directory') {
        const collectDescendants = (node: FileNode): void => {
          if (node.children) {
            for (const child of node.children) {
              idsToRemove.add(child.id);
              collectDescendants(child);
            }
          }
        };
        collectDescendants(target);
      }

      for (const removeId of idsToRemove) {
        nodes.delete(removeId);
      }

      const parentPath = getParentPath(target.path);
      for (const [nodeId, existing] of nodes) {
        if (existing.type === 'directory' && existing.path === parentPath) {
          nodes.set(nodeId, {
            ...existing,
            children: (existing.children ?? []).filter((c) => c.id !== id),
          });
          break;
        }
      }

      const rootChildren = state.rootChildren.filter((childId) => !idsToRemove.has(childId));

      const positionOverrides = new Map(state.positionOverrides);
      const sizeOverrides = new Map(state.sizeOverrides);
      for (const removeId of idsToRemove) {
        positionOverrides.delete(removeId);
        sizeOverrides.delete(removeId);
      }

      return { nodes, rootChildren, positionOverrides, sizeOverrides };
    }),

  getNodeByPath: (filePath: string) => {
    const { nodes } = get();
    for (const node of nodes.values()) {
      if (node.path === filePath) return node;
    }
    return undefined;
  },

  getParentDirectory: (fileId: string) => {
    const { nodes } = get();
    const target = nodes.get(fileId);
    if (!target) return null;

    const parentPath = getParentPath(target.path);
    if (!parentPath) return null;

    for (const node of nodes.values()) {
      if (node.type === 'directory' && node.path === parentPath) return node;
    }
    return null;
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

  reset: () =>
    set({
      rootPath: null,
      nodes: new Map<string, FileNode>(),
      rootChildren: [],
      isLoading: false,
      error: null,
      searchQuery: '',
      positionOverrides: new Map<string, [number, number, number]>(),
      sizeOverrides: new Map<string, [number, number]>(),
      layoutGeneration: 0,
      workspaceBounds: null,
      layoutMap: new Map<string, LayoutEntry>(),
    }),
}));

// ── File-change Listener ─────────────────────────────

// Subscribe to file change events from the main process
function initFileChangeListener(): void {
  if (typeof window === 'undefined' || !window.electronAPI) return;

  window.electronAPI.onFileChange((event) => {
    const state = useFileTreeStore.getState();
    if (!state.rootPath) return;

    switch (event.type) {
      case 'add':
      case 'addDir': {
        if (!event.fileInfo) break;
        const isDir = event.type === 'addDir';
        const newNode: FileNode = {
          id: event.fileInfo.id,
          name: event.fileInfo.name,
          path: event.path,
          type: isDir ? 'directory' : 'file',
          extension: event.fileInfo.extension,
          sizeBytes: event.fileInfo.sizeBytes,
          modifiedAt: event.fileInfo.modifiedAt,
          position: [0, 0, 0],
          ...(isDir ? { children: [] } : {}),
        };
        state.insertNode(newNode);
        break;
      }
      case 'change': {
        if (!event.fileInfo) break;
        const existing = state.getNodeByPath(event.path);
        if (existing) {
          state.updateNode(existing.id, {
            sizeBytes: event.fileInfo.sizeBytes,
            modifiedAt: event.fileInfo.modifiedAt,
          });
        }
        break;
      }
      case 'unlink':
      case 'unlinkDir': {
        const existing = state.getNodeByPath(event.path);
        if (existing) {
          state.removeNodeFromTree(existing.id);
        }
        break;
      }
    }
  });
}

initFileChangeListener();
