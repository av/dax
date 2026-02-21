import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useAgentStore } from '@/stores/agentStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useCameraFocusStore } from '@/scene/CameraController';
import { AgentState } from '@/types';
import DetailPanel from '@/ui/DetailPanel';
import ContextMenu from '@/ui/ContextMenu';
import BulkActionsBar from '@/ui/BulkActionsBar';
import Settings from '@/ui/Settings';
import RenameDialog from '@/ui/RenameDialog';
import MoveDialog from '@/ui/MoveDialog';
import CommandBar from '@/ui/CommandBar';
import AgentPlanPanel from '@/ui/AgentPlanPanel';
import Minimap from '@/ui/Minimap';
import { useKeyboard } from '@/hooks/useKeyboard';
import { usePerformanceStore } from '@/scene/PerformanceMonitor';
// ── SearchBar ──────────────────────────────────────────
function SearchBar() {
    const [localQuery, setLocalQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const containerRef = useRef(null);
    const setSearchQuery = useFileTreeStore((s) => s.setSearchQuery);
    const searchQuery = useFileTreeStore((s) => s.searchQuery);
    const nodes = useFileTreeStore((s) => s.nodes);
    const select = useSelectionStore((s) => s.select);
    const setFocusTarget = useCameraFocusStore((s) => s.setFocusTarget);
    // Compute search results from store
    const searchResults = useMemo(() => {
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
    }, [searchQuery, nodes]);
    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setLocalQuery(value);
        setShowDropdown(true);
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(value);
        }, 150);
    }, [setSearchQuery]);
    const handleClear = useCallback(() => {
        setLocalQuery('');
        setSearchQuery('');
        setShowDropdown(false);
        inputRef.current?.focus();
    }, [setSearchQuery]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            setLocalQuery('');
            setSearchQuery('');
            setShowDropdown(false);
            inputRef.current?.blur();
        }
    }, [setSearchQuery]);
    const handleResultClick = useCallback((id) => {
        const node = nodes.get(id);
        if (!node)
            return;
        select(id);
        setFocusTarget(node.position);
        setShowDropdown(false);
    }, [nodes, select, setFocusTarget]);
    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const visibleResults = searchResults.slice(0, 10);
    const hasQuery = localQuery.length > 0;
    return (_jsxs("div", { ref: containerRef, style: { position: 'relative', pointerEvents: 'auto' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(26, 27, 38, 0.9)',
                    border: '1px solid #292e42',
                    borderRadius: '4px',
                    padding: '0 8px',
                    gap: '6px',
                    height: '28px',
                }, children: [_jsx("span", { style: { fontSize: '13px', lineHeight: 1, color: '#565f89', flexShrink: 0 }, children: "\uD83D\uDD0D" }), _jsx("input", { ref: inputRef, type: "text", value: localQuery, onChange: handleChange, onKeyDown: handleKeyDown, onFocus: () => { if (hasQuery)
                            setShowDropdown(true); }, placeholder: "Search files\u2026", style: {
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#c0caf5',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            width: '160px',
                            padding: '0',
                        } }), hasQuery && (_jsxs(_Fragment, { children: [_jsxs("span", { style: {
                                    fontSize: '11px',
                                    color: '#565f89',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }, children: [searchResults.length, " result", searchResults.length !== 1 ? 's' : ''] }), _jsx("button", { onClick: handleClear, style: {
                                    background: 'none',
                                    border: 'none',
                                    color: '#565f89',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    lineHeight: 1,
                                    padding: '0 2px',
                                    flexShrink: 0,
                                }, title: "Clear search", children: "\u00D7" })] }))] }), showDropdown && hasQuery && visibleResults.length > 0 && (_jsxs("div", { style: {
                    position: 'absolute',
                    top: '32px',
                    left: 0,
                    right: 0,
                    minWidth: '260px',
                    background: 'rgba(26, 27, 38, 0.96)',
                    border: '1px solid #292e42',
                    borderRadius: '4px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                }, children: [visibleResults.map((id) => {
                        const node = nodes.get(id);
                        if (!node)
                            return null;
                        return (_jsxs("button", { onClick: () => handleResultClick(id), style: {
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px solid #1a1b26',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                color: '#c0caf5',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.background = 'rgba(122, 162, 247, 0.12)';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.background = 'transparent';
                            }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: '1px' }, children: node.name }), _jsx("div", { style: {
                                        fontSize: '10px',
                                        color: '#565f89',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }, children: node.path })] }, id));
                    }), searchResults.length > 10 && (_jsxs("div", { style: {
                            padding: '4px 10px',
                            fontSize: '11px',
                            color: '#565f89',
                            fontFamily: 'monospace',
                            textAlign: 'center',
                        }, children: ["+", searchResults.length - 10, " more"] }))] }))] }));
}
function getAgentStateLabel(state) {
    switch (state) {
        case AgentState.Idle:
            return 'Idle';
        case AgentState.Thinking:
            return 'Thinking\u2026';
        case AgentState.Acting:
            return 'Acting\u2026';
        case AgentState.Error:
            return 'Error';
        case AgentState.WaitingApproval:
            return 'Awaiting Approval';
    }
}
function formatCount(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
function PerformanceStats() {
    const fps = usePerformanceStore((s) => s.fps);
    const drawCalls = usePerformanceStore((s) => s.drawCalls);
    const triangles = usePerformanceStore((s) => s.triangles);
    const geometries = usePerformanceStore((s) => s.geometries);
    const textures = usePerformanceStore((s) => s.textures);
    return (_jsxs("span", { style: {
            fontSize: '11px',
            color: '#444b6a',
            fontFamily: 'monospace',
            background: 'rgba(10, 10, 15, 0.7)',
            padding: '4px 10px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
        }, children: [fps, " FPS | ", drawCalls, " draws | ", formatCount(triangles), " tris | ", geometries, " geo | ", textures, " tex"] }));
}
export default function HUD() {
    const rootPath = useFileTreeStore((s) => s.rootPath);
    const nodes = useFileTreeStore((s) => s.nodes);
    const isLoading = useFileTreeStore((s) => s.isLoading);
    const error = useFileTreeStore((s) => s.error);
    const openFolder = useFileTreeStore((s) => s.openFolder);
    const agentState = useAgentStore((s) => s.status);
    const openSettings = useSettingsStore((s) => s.openSettings);
    const onboardingStep = useOnboardingStore((s) => s.currentStep);
    const toggleCommandBar = useAgentStore((s) => s.toggleCommandBar);
    useKeyboard();
    const fileCount = useMemo(() => {
        let count = 0;
        for (const n of nodes.values()) {
            if (n.type === 'file')
                count++;
        }
        return count;
    }, [nodes]);
    const folderName = rootPath?.split('/').pop() ?? 'root';
    return (_jsxs("div", { style: {
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
        }, children: [_jsxs("div", { style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            pointerEvents: 'auto',
                        }, children: [_jsx("span", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#7aa2f7',
                                    fontFamily: 'monospace',
                                    background: 'rgba(10, 10, 15, 0.7)',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                }, children: folderName }), _jsx("span", { style: {
                                    fontSize: '12px',
                                    color: '#565f89',
                                    fontFamily: 'monospace',
                                    background: 'rgba(10, 10, 15, 0.7)',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                }, children: rootPath })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(SearchBar, {}), _jsx("button", { onClick: () => void openFolder(), style: {
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    background: 'rgba(26, 27, 38, 0.9)',
                                    color: '#7aa2f7',
                                    border: '1px solid #292e42',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                    pointerEvents: 'auto',
                                }, children: "Change Folder" }), _jsx("button", { onClick: openSettings, title: "Settings (Ctrl+,)", style: {
                                    padding: '4px 10px',
                                    fontSize: '16px',
                                    background: 'rgba(26, 27, 38, 0.9)',
                                    color: '#565f89',
                                    border: '1px solid #292e42',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    lineHeight: 1,
                                }, children: "\u2699" })] })] }), _jsxs("div", { style: {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                }, children: [_jsxs("span", { style: {
                            fontSize: '12px',
                            color: '#565f89',
                            fontFamily: 'monospace',
                            background: 'rgba(10, 10, 15, 0.7)',
                            padding: '4px 10px',
                            borderRadius: '4px',
                        }, children: [fileCount, " files"] }), import.meta.env.DEV && _jsx(PerformanceStats, {}), _jsxs("span", { style: {
                            fontSize: '12px',
                            color: agentState === AgentState.Error ? '#f7768e' : '#565f89',
                            fontFamily: 'monospace',
                            background: 'rgba(10, 10, 15, 0.7)',
                            padding: '4px 10px',
                            borderRadius: '4px',
                        }, children: ["Agent: ", getAgentStateLabel(agentState)] })] }), isLoading && (_jsx("div", { style: {
                    position: 'absolute',
                    bottom: 40,
                    left: 16,
                    color: '#565f89',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    background: 'rgba(10, 10, 15, 0.7)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                }, children: "Loading\\u2026" })), error && (_jsx("div", { style: {
                    position: 'absolute',
                    bottom: 40,
                    left: 16,
                    color: '#f7768e',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    background: 'rgba(10, 10, 15, 0.7)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                }, children: error })), _jsx(BulkActionsBar, {}), _jsx(DetailPanel, {}), _jsx(ContextMenu, {}), _jsx(Minimap, {}), _jsx(CommandBar, {}), _jsx(AgentPlanPanel, {}), _jsx(RenameDialog, {}), _jsx(MoveDialog, {}), _jsx(Settings, {}), onboardingStep === 'commandHint' && (_jsxs("div", { style: {
                    position: 'fixed',
                    bottom: '56px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 120,
                    pointerEvents: 'auto',
                    animation: 'daxCmdHintIn 0.4s ease-out both',
                }, children: [_jsxs("button", { onClick: toggleCommandBar, style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 24px',
                            background: 'rgba(26, 27, 38, 0.95)',
                            border: '1px solid #7aa2f7',
                            borderRadius: '10px',
                            color: '#9aa5ce',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            cursor: 'pointer',
                            animation: 'daxCmdHintPulse 2s ease-in-out infinite',
                            boxShadow: '0 0 20px rgba(122, 162, 247, 0.15)',
                        }, children: [_jsx("span", { style: { color: '#565f89', fontSize: '12px', fontFamily: 'monospace' }, children: "\u2318K" }), _jsx("span", { style: { color: '#565f89' }, children: "Try: \"Summarize the largest files\"" })] }), _jsx("style", { children: `
            @keyframes daxCmdHintPulse {
              0%, 100% { border-color: #7aa2f7; box-shadow: 0 0 20px rgba(122, 162, 247, 0.15); }
              50% { border-color: #9aa5ce; box-shadow: 0 0 30px rgba(122, 162, 247, 0.3); }
            }
            @keyframes daxCmdHintIn {
              from { opacity: 0; transform: translateX(-50%) translateY(8px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          ` })] }))] }));
}
