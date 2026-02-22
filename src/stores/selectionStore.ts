import { create } from 'zustand';

interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionState {
  selectedIds: Set<string>;
  hoveredId: string | null;
  focusedId: string | null;
  isDetailPanelOpen: boolean;
  isContextMenuOpen: boolean;
  contextMenuPosition: ContextMenuPosition | null;
  contextMenuTargetId: string | null;
  renameTarget: string | null;
  moveTargets: string[];
  selectionRect: ScreenRect | null;

  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setFocused: (id: string | null) => void;
  openDetailPanel: () => void;
  closeDetailPanel: () => void;
  openContextMenu: (x: number, y: number, targetId: string) => void;
  closeContextMenu: () => void;
  openRenameDialog: (targetPath: string) => void;
  closeRenameDialog: () => void;
  openMoveDialog: (paths: string[]) => void;
  closeMoveDialog: () => void;
  setSelectionRect: (rect: ScreenRect | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set<string>(),
  hoveredId: null,
  focusedId: null,
  isDetailPanelOpen: false,
  isContextMenuOpen: false,
  contextMenuPosition: null,
  contextMenuTargetId: null,
  renameTarget: null,
  moveTargets: [],
  selectionRect: null,

  select: (id: string) =>
    set({
      selectedIds: new Set([id]),
      isDetailPanelOpen: true,
      isContextMenuOpen: false,
      contextMenuPosition: null,
      contextMenuTargetId: null,
    }),

  toggleSelect: (id: string) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return {
        selectedIds: next,
        isDetailPanelOpen: next.size > 0,
      };
    }),

  addToSelection: (id: string) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.add(id);
      return {
        selectedIds: next,
        isDetailPanelOpen: true,
      };
    }),

  removeFromSelection: (id: string) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.delete(id);
      return {
        selectedIds: next,
        isDetailPanelOpen: next.size > 0,
      };
    }),

  selectMultiple: (ids: string[]) =>
    set({
      selectedIds: new Set(ids),
      isDetailPanelOpen: ids.length > 0,
    }),

  clearSelection: () =>
    set({
      selectedIds: new Set<string>(),
      focusedId: null,
      isDetailPanelOpen: false,
      isContextMenuOpen: false,
      contextMenuPosition: null,
      contextMenuTargetId: null,
    }),

  setHovered: (id: string | null) => set({ hoveredId: id }),

  setFocused: (id: string | null) => set({ focusedId: id }),

  openDetailPanel: () => set({ isDetailPanelOpen: true }),

  closeDetailPanel: () => set({ isDetailPanelOpen: false }),

  openContextMenu: (x: number, y: number, targetId: string) =>
    set({
      isContextMenuOpen: true,
      contextMenuPosition: { x, y },
      contextMenuTargetId: targetId,
    }),

  closeContextMenu: () =>
    set({
      isContextMenuOpen: false,
      contextMenuPosition: null,
      contextMenuTargetId: null,
    }),

  openRenameDialog: (targetPath: string) =>
    set({ renameTarget: targetPath }),

  closeRenameDialog: () =>
    set({ renameTarget: null }),

  openMoveDialog: (paths: string[]) =>
    set({ moveTargets: paths }),

  closeMoveDialog: () =>
    set({ moveTargets: [] }),

  setSelectionRect: (rect: ScreenRect | null) =>
    set({ selectionRect: rect }),
}));
