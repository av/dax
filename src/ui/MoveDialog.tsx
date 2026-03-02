import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useToast } from '@/ui/Toast';
import type { FileNode } from '@/types';
import { theme } from '@/theme';

// ── Helpers ────────────────────────────────────────────

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? '';
}

/**
 * Collect all directory nodes from rootChildren, recursively.
 */
function collectDirs(
  rootChildIds: string[],
  nodes: Map<string, FileNode>,
): FileNode[] {
  const dirs: FileNode[] = [];
  for (const id of rootChildIds) {
    const node = nodes.get(id);
    if (node && node.type === 'directory') {
      dirs.push(node);
    }
  }
  return dirs;
}

// ── DirTreeItem ────────────────────────────────────────

interface DirTreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function DirTreeItem({ node, depth, selectedPath, onSelect }: DirTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedPath === node.path;
  const nodes = useFileTreeStore((s) => s.nodes);

  const childDirs = useMemo(() => {
    return useFileTreeStore.getState().getChildrenOf(node.id).filter((c) => c.type === 'directory');
  }, [node.id, nodes]);

  const hasChildren = childDirs.length > 0;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    [],
  );

  const handleSelect = useCallback(() => {
    onSelect(node.path);
  }, [node.path, onSelect]);

  return (
    <div>
      <div
        onClick={handleSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          paddingLeft: `${8 + depth * 16}px`,
          cursor: 'pointer',
          borderRadius: '4px',
          background: isSelected ? `${theme.colors.accentPrimary}33` : 'transparent',
          color: isSelected ? theme.colors.accentPrimary : theme.colors.textSecondary,
          fontSize: '13px',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLDivElement).style.background =
              `${theme.colors.accentPrimary}14`;
        }}
        onMouseLeave={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        {/* Expand / collapse toggle */}
        <span
          onClick={hasChildren ? handleToggle : undefined}
          style={{
            display: 'inline-block',
            width: '16px',
            textAlign: 'center',
            fontSize: '10px',
            color: theme.colors.textSecondary,
            cursor: hasChildren ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : ' '}
        </span>
        <span style={{ flexShrink: 0 }}>📁</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </span>
      </div>

      {expanded &&
        childDirs.map((child) => (
          <DirTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
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

  const backdropRef = useRef<HTMLDivElement>(null);

  const [selectedDir, setSelectedDir] = useState<string | null>(null);
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
    if (moveTargets.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [moveTargets, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleMove = useCallback(async () => {
    if (!selectedDir || moveTargets.length === 0) return;

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
      } catch (err: unknown) {
        failCount++;
        const message = err instanceof Error ? err.message : 'Move failed';
        console.error(`Failed to move ${fileName}:`, message);
      }
    }

    if (failCount === 0) {
      const label =
        successCount === 1
          ? `Moved "${getFileName(moveTargets[0])}" successfully`
          : `Moved ${successCount} files successfully`;
      showToast(label, 'success');
    } else if (successCount === 0) {
      showToast(`Failed to move ${failCount} file(s)`, 'error');
    } else {
      showToast(
        `Moved ${successCount} file(s), ${failCount} failed`,
        'warning',
      );
    }

    clearSelection();
    handleClose();
  }, [selectedDir, moveTargets, showToast, clearSelection, handleClose]);

  // Build directory list from rootChildren
  const topDirs = useMemo(
    () => collectDirs(rootChildren, nodes),
    [rootChildren, nodes],
  );

  if (moveTargets.length === 0) return null;

  const fileLabel =
    moveTargets.length === 1
      ? getFileName(moveTargets[0])
      : `${moveTargets.length} files`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${theme.colors.textPrimary}66`,
        backdropFilter: 'blur(4px)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: theme.colors.bgBase,
          border: `1px solid ${theme.colors.borderDefault}`,
          borderRadius: '12px',
          width: '480px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          color: theme.colors.textPrimary,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: theme.shadows.lg,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.accentPrimary,
            }}
          >
            Move
          </h2>
          <button onClick={handleClose} style={closeButtonStyle}>
            ✕
          </button>
        </div>

        {/* What is being moved */}
        <div
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            marginBottom: '12px',
            flexShrink: 0,
          }}
        >
          Moving: <span style={{ color: theme.colors.textSecondary }}>{fileLabel}</span>
        </div>

        {/* Selected destination */}
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            color: theme.colors.textSecondary,
            marginBottom: '4px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          Destination
        </label>
        <div
          style={{
            padding: '8px 10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            background: theme.colors.bgSurface,
            color: selectedDir ? theme.colors.textPrimary : theme.colors.textSecondary,
            border: `1px solid ${theme.colors.borderDefault}`,
            borderRadius: '6px',
            marginBottom: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {selectedDir ?? 'Select a directory below'}
        </div>

        {/* Directory tree */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: theme.colors.bgSurface,
            border: `1px solid ${theme.colors.borderDefault}`,
            borderRadius: '6px',
            padding: '6px 0',
            marginBottom: '16px',
          }}
        >
          {/* Root directory entry */}
          <div
            onClick={() => setSelectedDir(rootPath)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: '4px',
              background:
                selectedDir === rootPath
                  ? `${theme.colors.accentPrimary}33`
                  : 'transparent',
              color: selectedDir === rootPath ? theme.colors.accentPrimary : theme.colors.textSecondary,
              fontSize: '13px',
              fontFamily: 'monospace',
              fontWeight: 600,
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (selectedDir !== rootPath)
                (e.currentTarget as HTMLDivElement).style.background =
                  `${theme.colors.accentPrimary}14`;
            }}
            onMouseLeave={(e) => {
              if (selectedDir !== rootPath)
                (e.currentTarget as HTMLDivElement).style.background =
                  'transparent';
            }}
          >
            <span style={{ width: '16px' }} />
            <span>📁</span>
            <span>{rootPath?.split('/').pop() ?? 'root'} (root)</span>
          </div>

          {topDirs.map((dir) => (
            <DirTreeItem
              key={dir.id}
              node={dir}
              depth={1}
              selectedPath={selectedDir}
              onSelect={setSelectedDir}
            />
          ))}

          {topDirs.length === 0 && (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '13px',
              }}
            >
              No subdirectories found
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            paddingTop: '16px',
            borderTop: `1px solid ${theme.colors.borderDefault}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleClose}
            disabled={isMoving}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleMove()}
            disabled={isMoving || !selectedDir}
            style={{
              ...moveButtonStyle,
              opacity: isMoving || !selectedDir ? 0.5 : 1,
              cursor: isMoving || !selectedDir ? 'not-allowed' : 'pointer',
            }}
          >
            {isMoving ? 'Moving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared styles ──────────────────────────────── */

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: theme.colors.textSecondary,
  fontSize: '18px',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  lineHeight: 1,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: '13px',
  background: 'transparent',
  color: theme.colors.textSecondary,
  border: `1px solid ${theme.colors.borderDefault}`,
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const moveButtonStyle: React.CSSProperties = {
  padding: '8px 24px',
  fontSize: '13px',
  background: theme.colors.accentPrimary,
  color: theme.colors.bgBase,
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
};
