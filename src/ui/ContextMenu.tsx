import { useEffect, useRef, useCallback } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useAgentStore } from '@/stores/agentStore';

// ── Menu item component ─────────────────────────────────

interface MenuItemProps {
  label: string;
  onClick: () => void;
  variant?: 'danger' | 'default';
}

function MenuItem({ label, onClick, variant = 'default' }: MenuItemProps) {
  const isDanger = variant === 'danger';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 16px',
        fontSize: '13px',
        background: 'transparent',
        color: isDanger ? '#f7768e' : '#e0e0e0',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(122, 162, 247, 0.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'transparent';
      }}
    >
      {label}
    </button>
  );
}

function Separator() {
  return (
    <div
      style={{ height: '1px', background: '#292e42', margin: '4px 0' }}
    />
  );
}

// ── Main ContextMenu component ──────────────────────────

export default function ContextMenu() {
  const isOpen = useSelectionStore((s) => s.isContextMenuOpen);
  const position = useSelectionStore((s) => s.contextMenuPosition);
  const targetId = useSelectionStore((s) => s.contextMenuTargetId);
  const closeContextMenu = useSelectionStore((s) => s.closeContextMenu);
  const nodes = useFileTreeStore((s) => s.nodes);
  const menuRef = useRef<HTMLDivElement>(null);

  const targetNode = targetId ? nodes.get(targetId) ?? null : null;

  // Close on click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        closeContextMenu();
      }
    },
    [closeContextMenu],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  if (!isOpen || !position || !targetNode) return null;

  // Auto-position to stay within viewport
  const menuWidth = 200;
  const menuHeight = 250;
  const adjustedX =
    position.x + menuWidth > window.innerWidth
      ? window.innerWidth - menuWidth - 8
      : position.x;
  const adjustedY =
    position.y + menuHeight > window.innerHeight
      ? window.innerHeight - menuHeight - 8
      : position.y;

  const handleOpen = (): void => {
    window.electronAPI.openExternal(targetNode.path).catch((err: unknown) => {
      console.error('Failed to open:', err);
    });
    closeContextMenu();
  };

  const handleRename = (): void => {
    useSelectionStore.getState().openRenameDialog(targetNode.path);
    closeContextMenu();
  };

  const handleMove = (): void => {
    useSelectionStore.getState().openMoveDialog([targetNode.path]);
    closeContextMenu();
  };

  const handleDelete = (): void => {
    if (window.confirm(`Delete "${targetNode.name}"?`)) {
      window.electronAPI
        .deleteFile(targetNode.path)
        .catch((err: unknown) => {
          console.error('Failed to delete:', err);
        });
      useSelectionStore.getState().clearSelection();
    }
    closeContextMenu();
  };

  const handleAskAgent = (): void => {
    closeContextMenu();
    useAgentStore.getState().setPrefillCommand(`Tell me about "${targetNode.name}"`);
    useAgentStore.getState().openCommandBar();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: Math.max(8, adjustedY),
        left: Math.max(8, adjustedX),
        minWidth: '180px',
        background: 'rgba(20, 20, 32, 0.98)',
        border: '1px solid #292e42',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        padding: '4px 0',
        zIndex: 200,
        pointerEvents: 'auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <MenuItem label="Open" onClick={handleOpen} />
      <MenuItem label="Rename" onClick={handleRename} />
      <MenuItem label="Move" onClick={handleMove} />
      <MenuItem label="Delete" onClick={handleDelete} variant="danger" />
      <Separator />
      <MenuItem label="Ask Agent About This" onClick={handleAskAgent} />
    </div>
  );
}
