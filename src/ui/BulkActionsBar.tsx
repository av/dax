import type { CSSProperties } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { theme } from '@/theme';

const buttonBase: CSSProperties = {
  padding: '6px 14px',
  fontSize: '12px',
  background: `${theme.colors.accentPrimary}26`,
  color: theme.colors.accentPrimary,
  border: `1px solid ${theme.colors.accentPrimary}33`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const dangerButton: CSSProperties = {
  ...buttonBase,
  background: `${theme.colors.statusError}26`,
  color: theme.colors.statusError,
  border: `1px solid ${theme.colors.statusError}33`,
};

export default function BulkActionsBar() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const nodes = useFileTreeStore((s) => s.nodes);

  if (selectedIds.size < 2) return null;

  const handleDeleteAll = (): void => {
    if (window.confirm(`Delete ${selectedIds.size} files?`)) {
      for (const id of selectedIds) {
        const node = nodes.get(id);
        if (node) {
          window.electronAPI.deleteFile(node.path).catch((err: unknown) => {
            console.error('Failed to delete:', err);
          });
        }
      }
      clearSelection();
    }
  };

  const handleMoveAll = (): void => {
    const paths: string[] = [];
    for (const id of selectedIds) {
      const node = nodes.get(id);
      if (node) paths.push(node.path);
    }
    useSelectionStore.getState().openMoveDialog(paths);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: `${theme.colors.bgSurface}F2`,
        border: `1px solid ${theme.colors.borderDefault}`,
        borderRadius: '8px',
        padding: '8px 16px',
        boxShadow: `0 4px 24px ${theme.colors.textPrimary}4D`,
        zIndex: 150,
        pointerEvents: 'auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span
        style={{ fontSize: '13px', color: theme.colors.textSecondary, fontWeight: 500 }}
      >
        {selectedIds.size} files selected
      </span>
      <button style={dangerButton} onClick={handleDeleteAll}>
        Delete All
      </button>
      <button style={buttonBase} onClick={handleMoveAll}>
        Move All
      </button>
      <button style={buttonBase} onClick={clearSelection}>
        Clear Selection
      </button>
    </div>
  );
}
