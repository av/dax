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
import { theme } from '@/theme';

// ── SearchBar ──────────────────────────────────────────

function SearchBar() {
  const [localQuery, setLocalQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setSearchQuery = useFileTreeStore((s) => s.setSearchQuery);
  const searchQuery = useFileTreeStore((s) => s.searchQuery);
  const nodes = useFileTreeStore((s) => s.nodes);
  const select = useSelectionStore((s) => s.select);
  const setFocusTarget = useCameraFocusStore((s) => s.setFocusTarget);

  // Compute search results from store
  const searchResults = useMemo(() => {
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
  }, [searchQuery, nodes]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalQuery(value);
      setShowDropdown(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 150);
    },
    [setSearchQuery],
  );

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [setSearchQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setLocalQuery('');
        setSearchQuery('');
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    },
    [setSearchQuery],
  );

  const handleResultClick = useCallback(
    (id: string) => {
      const node = nodes.get(id);
      if (!node) return;
      select(id);
      setFocusTarget(node.position);
      setShowDropdown(false);
    },
    [nodes, select, setFocusTarget],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleResults = searchResults.slice(0, 10);
  const hasQuery = localQuery.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', pointerEvents: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: `${theme.colors.bgSurface}E6`,
          border: `1px solid ${theme.colors.borderDefault}`,
          borderRadius: '4px',
          padding: '0 8px',
          gap: '6px',
          height: '28px',
        }}
      >
        <span style={{ fontSize: '13px', lineHeight: 1, color: theme.colors.textSecondary, flexShrink: 0 }}>
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (hasQuery) setShowDropdown(true); }}
          placeholder="Search files…"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.colors.textPrimary,
            fontSize: '12px',
            fontFamily: 'monospace',
            width: '160px',
            padding: '0',
          }}
        />
        {hasQuery && (
          <>
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
              }}
              title="Clear search"
            >
              ×
            </button>
          </>
        )}
      </div>
      {showDropdown && hasQuery && visibleResults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            left: 0,
            right: 0,
            minWidth: '260px',
            background: `${theme.colors.bgSurface}F5`,
            border: `1px solid ${theme.colors.borderDefault}`,
            borderRadius: '4px',
            maxHeight: '320px',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: theme.shadows.md,
          }}
        >
          {visibleResults.map((id) => {
            const node = nodes.get(id);
            if (!node) return null;
            return (
              <button
                key={id}
                onClick={() => handleResultClick(id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${theme.colors.bgBase}`,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  color: theme.colors.textPrimary,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${theme.colors.accentPrimary}1F`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '1px' }}>{node.name}</div>
                <div
                  style={{
                    fontSize: '10px',
                    color: theme.colors.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {node.path}
                </div>
              </button>
            );
          })}
          {searchResults.length > 10 && (
            <div
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                textAlign: 'center',
              }}
            >
              +{searchResults.length - 10} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getAgentStateLabel(state: AgentState): string {
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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function PerformanceStats() {
  const fps = usePerformanceStore((s) => s.fps);
  const drawCalls = usePerformanceStore((s) => s.drawCalls);
  const triangles = usePerformanceStore((s) => s.triangles);
  const geometries = usePerformanceStore((s) => s.geometries);
  const textures = usePerformanceStore((s) => s.textures);

  return (
    <span
      style={{
        fontSize: '11px',
        color: theme.colors.textSecondary,
        fontFamily: 'monospace',
        background: `${theme.colors.bgBase}B3`,
        padding: '4px 10px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      {fps} FPS | {drawCalls} draws | {formatCount(triangles)} tris | {geometries} geo | {textures} tex
    </span>
  );
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
  const isDetailPanelOpen = useSelectionStore((s) => s.isDetailPanelOpen);
  const selectionRect = useSelectionStore((s) => s.selectionRect);

  useKeyboard();

  const fileCount = useMemo(() => {
    let count = 0;
    for (const n of nodes.values()) {
      if (n.type === 'file') count++;
    }
    return count;
  }, [nodes]);

  const folderName = rootPath?.split('/').pop() ?? 'root';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* ── Top bar ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          paddingRight: isDetailPanelOpen ? '336px' : '16px',
          transition: 'padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.accentPrimary,
              fontFamily: 'monospace',
              background: `${theme.colors.bgBase}B3`,
              padding: '4px 10px',
              borderRadius: '4px',
            }}
          >
            {folderName}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              fontFamily: 'monospace',
              background: `${theme.colors.bgBase}B3`,
              padding: '4px 10px',
              borderRadius: '4px',
            }}
          >
            {rootPath}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SearchBar />
          <button
            onClick={() => void openFolder()}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: `${theme.colors.bgSurface}E6`,
              color: theme.colors.accentPrimary,
              border: `1px solid ${theme.colors.borderDefault}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              pointerEvents: 'auto',
            }}
          >
            Change Folder
          </button>
          <button
            onClick={openSettings}
            title="Settings (Ctrl+,)"
            style={{
              padding: '4px 10px',
              fontSize: '16px',
              background: `${theme.colors.bgSurface}E6`,
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.borderDefault}`,
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              lineHeight: 1,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              fontFamily: 'monospace',
              background: `${theme.colors.bgBase}B3`,
              padding: '4px 10px',
              borderRadius: '4px',
            }}
          >
            {fileCount} files
          </span>
          <button
            onClick={() => useFileTreeStore.getState().resetLayout()}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              background: `${theme.colors.bgSurface}E6`,
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.borderDefault}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
            title="Reset all files to computed layout positions"
          >
            Reset Layout
          </button>
        </div>
        {import.meta.env.DEV && <PerformanceStats />}
        <span
          style={{
            fontSize: '12px',
            color:
              agentState === AgentState.Error ? theme.colors.statusError : theme.colors.textSecondary,
            fontFamily: 'monospace',
            background: `${theme.colors.bgBase}B3`,
            padding: '4px 10px',
            borderRadius: '4px',
          }}
        >
          Agent: {getAgentStateLabel(agentState)}
        </span>
      </div>

      {/* ── Loading / Error indicators ──────────────── */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 16,
            color: theme.colors.textSecondary,
            fontSize: '13px',
            fontFamily: 'monospace',
            background: `${theme.colors.bgBase}B3`,
            padding: '4px 10px',
            borderRadius: '4px',
          }}
        >
          Loading\u2026
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 16,
            color: theme.colors.statusError,
            fontSize: '13px',
            fontFamily: 'monospace',
            background: `${theme.colors.bgBase}B3`,
            padding: '4px 10px',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Selection UI overlays ──────────────────── */}
      {selectionRect && (
        <div
          style={{
            position: 'fixed',
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            border: `1.5px dashed ${theme.colors.accentPrimary}CC`,
            backgroundColor: `${theme.colors.accentPrimary}1F`,
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}
      <BulkActionsBar />
      <DetailPanel />
      <ContextMenu />

      {/* ── Minimap ────────────────────────────────── */}
      <Minimap />

      {/* ── Agent UI ───────────────────────────────── */}
      <CommandBar />
      <AgentPlanPanel />

      {/* ── Rename dialog ─────────────────────────── */}
      <RenameDialog />

      {/* ── Move dialog ───────────────────────────── */}
      <MoveDialog />

      {/* ── Settings panel ─────────────────────────── */}
      <Settings />

      {/* ── Onboarding command hint ────────────────── */}
      {onboardingStep === 'commandHint' && (
        <div
          style={{
            position: 'fixed',
            bottom: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 120,
            pointerEvents: 'auto',
            animation: 'daxCmdHintIn 0.4s ease-out both',
          }}
        >
          <button
            onClick={toggleCommandBar}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 24px',
              background: `${theme.colors.bgSurface}F2`,
              border: `1px solid ${theme.colors.accentPrimary}`,
              borderRadius: '10px',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              cursor: 'pointer',
              animation: 'daxCmdHintPulse 2s ease-in-out infinite',
              boxShadow: `0 0 20px ${theme.colors.accentPrimary}26`,
            }}
          >
            <span style={{ color: theme.colors.textSecondary, fontSize: '12px', fontFamily: 'monospace' }}>⌘K</span>
            <span style={{ color: theme.colors.textSecondary }}>Try: &quot;Summarize the largest files&quot;</span>
          </button>
          <style>{`
            @keyframes daxCmdHintPulse {
              0%, 100% { border-color: ${theme.colors.accentPrimary}; box-shadow: 0 0 20px ${theme.colors.accentPrimary}26; }
              50% { border-color: ${theme.colors.textSecondary}; box-shadow: 0 0 30px ${theme.colors.accentPrimary}4D; }
            }
            @keyframes daxCmdHintIn {
              from { opacity: 0; transform: translateX(-50%) translateY(8px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
