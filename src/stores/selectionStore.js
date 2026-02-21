import { create } from 'zustand';
export const useSelectionStore = create((set) => ({
    selectedIds: new Set(),
    hoveredId: null,
    focusedId: null,
    isDetailPanelOpen: false,
    isContextMenuOpen: false,
    contextMenuPosition: null,
    contextMenuTargetId: null,
    renameTarget: null,
    moveTargets: [],
    select: (id) => set({
        selectedIds: new Set([id]),
        isDetailPanelOpen: true,
        isContextMenuOpen: false,
        contextMenuPosition: null,
        contextMenuTargetId: null,
    }),
    toggleSelect: (id) => set((state) => {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        return {
            selectedIds: next,
            isDetailPanelOpen: next.size > 0,
        };
    }),
    addToSelection: (id) => set((state) => {
        const next = new Set(state.selectedIds);
        next.add(id);
        return {
            selectedIds: next,
            isDetailPanelOpen: true,
        };
    }),
    removeFromSelection: (id) => set((state) => {
        const next = new Set(state.selectedIds);
        next.delete(id);
        return {
            selectedIds: next,
            isDetailPanelOpen: next.size > 0,
        };
    }),
    selectMultiple: (ids) => set({
        selectedIds: new Set(ids),
        isDetailPanelOpen: ids.length > 0,
    }),
    clearSelection: () => set({
        selectedIds: new Set(),
        focusedId: null,
        isDetailPanelOpen: false,
        isContextMenuOpen: false,
        contextMenuPosition: null,
        contextMenuTargetId: null,
    }),
    setHovered: (id) => set({ hoveredId: id }),
    setFocused: (id) => set({ focusedId: id }),
    openDetailPanel: () => set({ isDetailPanelOpen: true }),
    closeDetailPanel: () => set({ isDetailPanelOpen: false }),
    openContextMenu: (x, y, targetId) => set({
        isContextMenuOpen: true,
        contextMenuPosition: { x, y },
        contextMenuTargetId: targetId,
    }),
    closeContextMenu: () => set({
        isContextMenuOpen: false,
        contextMenuPosition: null,
        contextMenuTargetId: null,
    }),
    openRenameDialog: (targetPath) => set({ renameTarget: targetPath }),
    closeRenameDialog: () => set({ renameTarget: null }),
    openMoveDialog: (paths) => set({ moveTargets: paths }),
    closeMoveDialog: () => set({ moveTargets: [] }),
}));
