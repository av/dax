import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { formatFileSize, formatModifiedDate, getFileColor, } from '@/utils/fileClassification';
import FilePreview from '@/ui/previews/FilePreview';
const PANEL_WIDTH = 320;
function getFileExtensionLabel(ext) {
    if (!ext)
        return 'Unknown';
    return ext.replace(/^\./, '').toUpperCase();
}
// ── Sub-components ──────────────────────────────────────
function InfoRow({ label, value }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
        }, children: [_jsx("span", { style: { color: '#565f89', flexShrink: 0 }, children: label }), _jsx("span", { style: {
                    color: '#a9b1d6',
                    textAlign: 'right',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }, children: value })] }));
}
function ActionButton({ label, onClick, variant = 'default', }) {
    const isDanger = variant === 'danger';
    return (_jsx("button", { onClick: onClick, style: {
            padding: '8px 16px',
            fontSize: '13px',
            background: isDanger
                ? 'rgba(247, 118, 142, 0.1)'
                : 'rgba(122, 162, 247, 0.1)',
            color: isDanger ? '#f7768e' : '#7aa2f7',
            border: `1px solid ${isDanger ? '#f7768e33' : '#7aa2f733'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
        }, children: label }));
}
// ── Single file detail view ─────────────────────────────
function SingleFileDetail({ node }) {
    const color = getFileColor(node.extension);
    const handleOpenExternal = () => {
        window.electronAPI.openExternal(node.path).catch((err) => {
            console.error('Failed to open externally:', err);
        });
    };
    const handleRename = () => {
        useSelectionStore.getState().openRenameDialog(node.path);
    };
    const handleDelete = () => {
        if (window.confirm(`Delete "${node.name}"?`)) {
            window.electronAPI.deleteFile(node.path).catch((err) => {
                console.error('Failed to delete:', err);
            });
            useSelectionStore.getState().clearSelection();
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsx("div", { style: { height: '3px', background: color, borderRadius: '2px' } }), _jsx("div", { style: {
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    wordBreak: 'break-word',
                }, children: node.name }), _jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                }, children: [_jsx(InfoRow, { label: "Path", value: node.path }), _jsx(InfoRow, { label: "Type", value: node.type === 'file'
                            ? getFileExtensionLabel(node.extension) + ' File'
                            : 'Directory' }), node.extension && (_jsx(InfoRow, { label: "Extension", value: node.extension })), _jsx(InfoRow, { label: "Size", value: formatFileSize(node.sizeBytes) }), _jsx(InfoRow, { label: "Modified", value: formatModifiedDate(node.modifiedAt) })] }), _jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '8px',
                }, children: [_jsx(ActionButton, { label: "Open Externally", onClick: handleOpenExternal }), _jsx(ActionButton, { label: "Rename", onClick: handleRename }), _jsx(ActionButton, { label: "Move to Trash", onClick: handleDelete, variant: "danger" })] })] }));
}
// ── Multi file detail view ──────────────────────────────
function MultiFileDetail({ nodes }) {
    const totalSize = nodes.reduce((sum, n) => sum + n.sizeBytes, 0);
    const handleDeleteAll = () => {
        if (window.confirm(`Delete ${nodes.length} files?`)) {
            for (const node of nodes) {
                window.electronAPI.deleteFile(node.path).catch((err) => {
                    console.error('Failed to delete:', err);
                });
            }
            useSelectionStore.getState().clearSelection();
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { style: { fontSize: '16px', fontWeight: 600, color: '#e0e0e0' }, children: [nodes.length, " files selected"] }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                }, children: _jsx(InfoRow, { label: "Total Size", value: formatFileSize(totalSize) }) }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '12px',
                }, children: nodes.map((n) => (_jsx("div", { style: {
                        color: '#a9b1d6',
                        padding: '4px 0',
                        borderBottom: '1px solid #1a1b2e',
                    }, children: n.name }, n.id))) }), _jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '8px',
                }, children: [_jsx(ActionButton, { label: "Delete All", onClick: handleDeleteAll, variant: "danger" }), _jsx(ActionButton, { label: "Clear Selection", onClick: () => useSelectionStore.getState().clearSelection() })] })] }));
}
// ── Main DetailPanel component ──────────────────────────
export default function DetailPanel() {
    const isOpen = useSelectionStore((s) => s.isDetailPanelOpen);
    const selectedIds = useSelectionStore((s) => s.selectedIds);
    const nodes = useFileTreeStore((s) => s.nodes);
    const closePanel = useSelectionStore((s) => s.closeDetailPanel);
    const [activeTab, setActiveTab] = useState('preview');
    const selectedNodes = useMemo(() => {
        const result = [];
        for (const id of selectedIds) {
            const node = nodes.get(id);
            if (node)
                result.push(node);
        }
        return result;
    }, [selectedIds, nodes]);
    return (_jsxs("div", { style: {
            position: 'fixed',
            top: 0,
            right: 0,
            width: `${PANEL_WIDTH}px`,
            height: '100vh',
            background: 'rgba(15, 15, 25, 0.95)',
            borderLeft: '1px solid #292e42',
            transform: isOpen && selectedNodes.length > 0
                ? 'translateX(0)'
                : `translateX(${PANEL_WIDTH}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            pointerEvents: 'auto',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid #292e42',
                }, children: [_jsx("span", { style: { fontSize: '14px', fontWeight: 600, color: '#7aa2f7' }, children: "Details" }), _jsx("button", { onClick: closePanel, style: {
                            background: 'none',
                            border: 'none',
                            color: '#565f89',
                            fontSize: '18px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            lineHeight: 1,
                        }, children: "\u2715" })] }), selectedNodes.length === 1 && (_jsx("div", { style: {
                    display: 'flex',
                    borderBottom: '1px solid #292e42',
                    padding: '0 16px',
                }, children: ['preview', 'info'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), style: {
                        flex: 1,
                        padding: '10px',
                        background: 'none',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === tab ? '#7aa2f7' : 'transparent'}`,
                        color: activeTab === tab ? '#7aa2f7' : '#565f89',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textTransform: 'capitalize',
                    }, children: tab }, tab))) })), _jsxs("div", { style: { padding: '16px', overflowY: 'auto', flex: 1 }, children: [selectedNodes.length === 1 && activeTab === 'info' && (_jsx(SingleFileDetail, { node: selectedNodes[0] })), selectedNodes.length === 1 && activeTab === 'preview' && (_jsx(FilePreview, { node: selectedNodes[0] })), selectedNodes.length > 1 && (_jsx(MultiFileDetail, { nodes: selectedNodes }))] })] }));
}
