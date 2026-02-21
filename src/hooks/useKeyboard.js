import { useEffect } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAgentStore } from '@/stores/agentStore';
export function useKeyboard() {
    useEffect(() => {
        const handleKeyDown = (e) => {
            const state = useSelectionStore.getState();
            const settingsState = useSettingsStore.getState();
            // Cmd/Ctrl+, opens settings
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                if (settingsState.isSettingsOpen) {
                    settingsState.closeSettings();
                }
                else {
                    settingsState.openSettings();
                }
                return;
            }
            if (e.key === 'Escape') {
                const agentState = useAgentStore.getState();
                if (agentState.isCommandBarOpen) {
                    agentState.closeCommandBar();
                    return;
                }
                if (settingsState.isSettingsOpen) {
                    settingsState.closeSettings();
                    return;
                }
                if (state.isContextMenuOpen) {
                    state.closeContextMenu();
                }
                else if (state.isDetailPanelOpen) {
                    state.closeDetailPanel();
                }
                else if (state.selectedIds.size > 0) {
                    state.clearSelection();
                }
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                useAgentStore.getState().toggleCommandBar();
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Don't intercept if typing in an input
                if (e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement) {
                    return;
                }
                if (state.selectedIds.size > 0) {
                    e.preventDefault();
                    const fileTreeState = useFileTreeStore.getState();
                    const selectedNodes = [];
                    for (const id of state.selectedIds) {
                        const node = fileTreeState.nodes.get(id);
                        if (node)
                            selectedNodes.push(node);
                    }
                    if (selectedNodes.length === 0)
                        return;
                    const msg = selectedNodes.length === 1
                        ? `Delete "${selectedNodes[0].name}"?`
                        : `Delete ${selectedNodes.length} files?`;
                    if (window.confirm(msg)) {
                        for (const node of selectedNodes) {
                            window.electronAPI
                                .deleteFile(node.path)
                                .catch((err) => {
                                console.error('Failed to delete:', err);
                            });
                        }
                        state.clearSelection();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
