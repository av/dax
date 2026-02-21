import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useToast } from '@/ui/Toast';
// ── Helpers ────────────────────────────────────────────
function getFileName(filePath) {
    const parts = filePath.split('/');
    return parts[parts.length - 1] ?? '';
}
/**
 * Collect all directory nodes from rootChildren, recursively.
 */
function collectDirs(rootChildIds, nodes) {
    const dirs = [];
    for (const id of rootChildIds) {
        const node = nodes.get(id);
        if (node && node.type === 'directory') {
            dirs.push(node);
        }
    }
    return dirs;
}
function DirTreeItem({ node, depth, selectedPath, onSelect }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isSelected = selectedPath === node.path;
    const childDirs = useMemo(() => {
        if (!node.children)
            return [];
        return node.children.filter((c) => c.type === 'directory');
    }, [node.children]);
    const hasChildren = childDirs.length > 0;
    const handleToggle = useCallback((e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
    }, []);
    const handleSelect = useCallback(() => {
        onSelect(node.path);
    }, [node.path, onSelect]);
    return (_jsxs("div", { children: [_jsxs("div", { onClick: handleSelect, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    paddingLeft: `${8 + depth * 16}px`,
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(122, 162, 247, 0.2)' : 'transparent',
                    color: isSelected ? '#7aa2f7' : '#a9b1d6',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                }, onMouseEnter: (e) => {
                    if (!isSelected)
                        e.currentTarget.style.background =
                            'rgba(122, 162, 247, 0.08)';
                }, onMouseLeave: (e) => {
                    if (!isSelected)
                        e.currentTarget.style.background = 'transparent';
                }, children: [_jsx("span", { onClick: hasChildren ? handleToggle : undefined, style: {
                            display: 'inline-block',
                            width: '16px',
                            textAlign: 'center',
                            fontSize: '10px',
                            color: '#565f89',
                            cursor: hasChildren ? 'pointer' : 'default',
                            flexShrink: 0,
                        }, children: hasChildren ? (expanded ? '▼' : '▶') : ' ' }), _jsx("span", { style: { flexShrink: 0 }, children: "\uD83D\uDCC1" }), _jsx("span", { style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }, children: node.name })] }), expanded &&
                childDirs.map((child) => (_jsx(DirTreeItem, { node: child, depth: depth + 1, selectedPath: selectedPath, onSelect: onSelect }, child.id)))] }));
}
// ── MoveDialog ─────────────────────────────────────────
export default function MoveDialog() {
    const moveTargets = useSelectionStore((s) => s.moveTargets);
    const closeMoveDialog = useSelectionStore((s) => s.closeMoveDialog);
    const clearSelection = useSelectionStore((s) => s.clearSelection);
    const rootPath = useFileTreeStore((s) => s.rootPath);
    const rootChildren = useFileTreeStore((s) => s.rootChildren);
    const nodes = useFileTreeStore((s) => s.nodes);
    const { showToast } = useToast();
    const backdropRef = useRef(null);
    const [selectedDir, setSelectedDir] = useState(null);
    const [isMoving, setIsMoving] = useState(false);
    // Reset selection when dialog opens
    useEffect(() => {
        if (moveTargets.length > 0) {
            setSelectedDir(rootPath);
            setIsMoving(false);
        }
    }, [moveTargets, rootPath]);
    const handleClose = useCallback(() => {
        closeMoveDialog();
    }, [closeMoveDialog]);
    // Close on Escape
    useEffect(() => {
        if (moveTargets.length === 0)
            return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                handleClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [moveTargets, handleClose]);
    const handleBackdropClick = useCallback((e) => {
        if (e.target === backdropRef.current) {
            handleClose();
        }
    }, [handleClose]);
    const handleMove = useCallback(async () => {
        if (!selectedDir || moveTargets.length === 0)
            return;
        setIsMoving(true);
        let successCount = 0;
        let failCount = 0;
        for (const srcPath of moveTargets) {
            const fileName = getFileName(srcPath);
            const destPath = `${selectedDir}/${fileName}`;
            // Prevent moving a file to its current location
            if (srcPath === destPath) {
                successCount++;
                continue;
            }
            try {
                await window.electronAPI.moveFile(srcPath, destPath);
                successCount++;
            }
            catch (err) {
                failCount++;
                const message = err instanceof Error ? err.message : 'Move failed';
                console.error(`Failed to move ${fileName}:`, message);
            }
        }
        if (failCount === 0) {
            const label = successCount === 1
                ? `Moved "${getFileName(moveTargets[0])}" successfully`
                : `Moved ${successCount} files successfully`;
            showToast(label, 'success');
        }
        else if (successCount === 0) {
            showToast(`Failed to move ${failCount} file(s)`, 'error');
        }
        else {
            showToast(`Moved ${successCount} file(s), ${failCount} failed`, 'warning');
        }
        clearSelection();
        handleClose();
    }, [selectedDir, moveTargets, showToast, clearSelection, handleClose]);
    // Build directory list from rootChildren
    const topDirs = useMemo(() => collectDirs(rootChildren, nodes), [rootChildren, nodes]);
    if (moveTargets.length === 0)
        return null;
    const fileLabel = moveTargets.length === 1
        ? getFileName(moveTargets[0])
        : `${moveTargets.length} files`;
    return (_jsx("div", { ref: backdropRef, onClick: handleBackdropClick, style: {
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto',
        }, children: _jsxs("div", { style: {
                background: '#1a1b26',
                border: '1px solid #292e42',
                borderRadius: '12px',
                width: '480px',
                maxHeight: '70vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                color: '#c0caf5',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }, children: [_jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                        flexShrink: 0,
                    }, children: [_jsx("h2", { style: {
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#7aa2f7',
                            }, children: "Move" }), _jsx("button", { onClick: handleClose, style: closeButtonStyle, children: "\u2715" })] }), _jsxs("div", { style: {
                        fontSize: '13px',
                        color: '#565f89',
                        marginBottom: '12px',
                        flexShrink: 0,
                    }, children: ["Moving: ", _jsx("span", { style: { color: '#a9b1d6' }, children: fileLabel })] }), _jsx("label", { style: {
                        display: 'block',
                        fontSize: '13px',
                        color: '#a9b1d6',
                        marginBottom: '4px',
                        fontWeight: 500,
                        flexShrink: 0,
                    }, children: "Destination" }), _jsx("div", { style: {
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        background: '#16161e',
                        color: selectedDir ? '#c0caf5' : '#565f89',
                        border: '1px solid #292e42',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    }, children: selectedDir ?? 'Select a directory below' }), _jsxs("div", { style: {
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        background: '#16161e',
                        border: '1px solid #292e42',
                        borderRadius: '6px',
                        padding: '6px 0',
                        marginBottom: '16px',
                    }, children: [_jsxs("div", { onClick: () => setSelectedDir(rootPath), style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                background: selectedDir === rootPath
                                    ? 'rgba(122, 162, 247, 0.2)'
                                    : 'transparent',
                                color: selectedDir === rootPath ? '#7aa2f7' : '#a9b1d6',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                userSelect: 'none',
                            }, onMouseEnter: (e) => {
                                if (selectedDir !== rootPath)
                                    e.currentTarget.style.background =
                                        'rgba(122, 162, 247, 0.08)';
                            }, onMouseLeave: (e) => {
                                if (selectedDir !== rootPath)
                                    e.currentTarget.style.background =
                                        'transparent';
                            }, children: [_jsx("span", { style: { width: '16px' } }), _jsx("span", { children: "\uD83D\uDCC1" }), _jsxs("span", { children: [rootPath?.split('/').pop() ?? 'root', " (root)"] })] }), topDirs.map((dir) => (_jsx(DirTreeItem, { node: dir, depth: 1, selectedPath: selectedDir, onSelect: setSelectedDir }, dir.id))), topDirs.length === 0 && (_jsx("div", { style: {
                                padding: '16px',
                                textAlign: 'center',
                                color: '#565f89',
                                fontSize: '13px',
                            }, children: "No subdirectories found" }))] }), _jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px',
                        paddingTop: '16px',
                        borderTop: '1px solid #292e42',
                        flexShrink: 0,
                    }, children: [_jsx("button", { onClick: handleClose, disabled: isMoving, style: cancelButtonStyle, children: "Cancel" }), _jsx("button", { onClick: () => void handleMove(), disabled: isMoving || !selectedDir, style: {
                                ...moveButtonStyle,
                                opacity: isMoving || !selectedDir ? 0.5 : 1,
                                cursor: isMoving || !selectedDir ? 'not-allowed' : 'pointer',
                            }, children: isMoving ? 'Moving…' : 'Move' })] })] }) }));
}
/* ── Shared styles ──────────────────────────────── */
const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#565f89',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: 1,
};
const cancelButtonStyle = {
    padding: '8px 20px',
    fontSize: '13px',
    background: 'transparent',
    color: '#565f89',
    border: '1px solid #292e42',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit',
};
const moveButtonStyle = {
    padding: '8px 24px',
    fontSize: '13px',
    background: '#7aa2f7',
    color: '#1a1b26',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
};
