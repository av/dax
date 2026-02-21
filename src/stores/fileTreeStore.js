import { create } from 'zustand';
function getParentPath(filePath) {
    const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSep > 0 ? filePath.substring(0, lastSep) : '';
}
function flattenTree(nodes) {
    const map = new Map();
    function recurse(list) {
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
export const useFileTreeStore = create((set, get) => ({
    rootPath: null,
    nodes: new Map(),
    rootChildren: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    positionOverrides: new Map(),
    openFolder: async () => {
        set({ isLoading: true, error: null });
        try {
            const folderPath = await window.electronAPI.openFolder();
            if (!folderPath) {
                set({ isLoading: false });
                return;
            }
            let tree;
            try {
                tree = await window.electronAPI.readDirectory(folderPath);
            }
            catch (readErr) {
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
            if (nodeMap.size > LARGE_DIR_THRESHOLD) {
                console.warn(`[Dax] Large directory detected (${nodeMap.size} nodes). Performance may be affected.`);
            }
            set({ rootPath: folderPath, nodes: nodeMap, rootChildren, isLoading: false });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to open folder';
            set({ error: message, isLoading: false });
        }
    },
    setRootPath: (path) => set({ rootPath: path }),
    setNodes: (nodes) => {
        const nodeMap = flattenTree(nodes);
        const rootChildren = nodes.map((node) => node.id);
        set({ nodes: nodeMap, rootChildren });
    },
    addNode: (node) => set((state) => {
        const nodes = new Map(state.nodes);
        nodes.set(node.id, node);
        return { nodes };
    }),
    removeNode: (id) => set((state) => {
        const nodes = new Map(state.nodes);
        nodes.delete(id);
        return {
            nodes,
            rootChildren: state.rootChildren.filter((childId) => childId !== id),
        };
    }),
    updateNode: (id, partial) => set((state) => {
        const existing = state.nodes.get(id);
        if (!existing)
            return state;
        const nodes = new Map(state.nodes);
        nodes.set(id, { ...existing, ...partial });
        return { nodes };
    }),
    insertNode: (node) => set((state) => {
        const nodes = new Map(state.nodes);
        if (nodes.has(node.id))
            return state;
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
    removeNodeFromTree: (id) => set((state) => {
        const target = state.nodes.get(id);
        if (!target)
            return state;
        const nodes = new Map(state.nodes);
        const idsToRemove = new Set([id]);
        if (target.type === 'directory') {
            const collectDescendants = (node) => {
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
        for (const removeId of idsToRemove) {
            positionOverrides.delete(removeId);
        }
        return { nodes, rootChildren, positionOverrides };
    }),
    getNodeByPath: (filePath) => {
        const { nodes } = get();
        for (const node of nodes.values()) {
            if (node.path === filePath)
                return node;
        }
        return undefined;
    },
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    getSearchResults: () => {
        const { nodes, searchQuery } = get();
        if (!searchQuery.trim())
            return [];
        const q = searchQuery.toLowerCase();
        const results = [];
        for (const node of nodes.values()) {
            if (node.type !== 'file')
                continue;
            const nameMatch = node.name.toLowerCase().includes(q);
            const extMatch = node.extension ? node.extension.toLowerCase().includes(q) : false;
            const pathMatch = node.path.toLowerCase().includes(q);
            if (nameMatch || extMatch || pathMatch) {
                results.push(node.id);
            }
        }
        return results;
    },
    setPositionOverride: (fileId, pos) => set((state) => {
        const overrides = new Map(state.positionOverrides);
        overrides.set(fileId, pos);
        return { positionOverrides: overrides };
    }),
    clearPositionOverride: (fileId) => set((state) => {
        const overrides = new Map(state.positionOverrides);
        overrides.delete(fileId);
        return { positionOverrides: overrides };
    }),
    reset: () => set({
        rootPath: null,
        nodes: new Map(),
        rootChildren: [],
        isLoading: false,
        error: null,
        searchQuery: '',
        positionOverrides: new Map(),
    }),
}));
// Subscribe to file change events from the main process
function initFileChangeListener() {
    if (typeof window === 'undefined' || !window.electronAPI)
        return;
    window.electronAPI.onFileChange((event) => {
        const state = useFileTreeStore.getState();
        if (!state.rootPath)
            return;
        switch (event.type) {
            case 'add':
            case 'addDir': {
                if (!event.fileInfo)
                    break;
                const isDir = event.type === 'addDir';
                const newNode = {
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
                if (!event.fileInfo)
                    break;
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
