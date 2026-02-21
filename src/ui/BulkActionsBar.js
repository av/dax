import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
const buttonBase = {
    padding: '6px 14px',
    fontSize: '12px',
    background: 'rgba(122, 162, 247, 0.15)',
    color: '#7aa2f7',
    border: '1px solid #7aa2f733',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
};
const dangerButton = {
    ...buttonBase,
    background: 'rgba(247, 118, 142, 0.15)',
    color: '#f7768e',
    border: '1px solid #f7768e33',
};
export default function BulkActionsBar() {
    const selectedIds = useSelectionStore((s) => s.selectedIds);
    const clearSelection = useSelectionStore((s) => s.clearSelection);
    const nodes = useFileTreeStore((s) => s.nodes);
    if (selectedIds.size < 2)
        return null;
    const handleDeleteAll = () => {
        if (window.confirm(`Delete ${selectedIds.size} files?`)) {
            for (const id of selectedIds) {
                const node = nodes.get(id);
                if (node) {
                    window.electronAPI.deleteFile(node.path).catch((err) => {
                        console.error('Failed to delete:', err);
                    });
                }
            }
            clearSelection();
        }
    };
    const handleMoveAll = () => {
        const paths = [];
        for (const id of selectedIds) {
            const node = nodes.get(id);
            if (node)
                paths.push(node.path);
        }
        useSelectionStore.getState().openMoveDialog(paths);
    };
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(20, 20, 32, 0.95)',
            border: '1px solid #292e42',
            borderRadius: '8px',
            padding: '8px 16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            pointerEvents: 'auto',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }, children: [_jsxs("span", { style: { fontSize: '13px', color: '#a9b1d6', fontWeight: 500 }, children: [selectedIds.size, " files selected"] }), _jsx("button", { style: dangerButton, onClick: handleDeleteAll, children: "Delete All" }), _jsx("button", { style: buttonBase, onClick: handleMoveAll, children: "Move All" }), _jsx("button", { style: buttonBase, onClick: clearSelection, children: "Clear Selection" })] }));
}
