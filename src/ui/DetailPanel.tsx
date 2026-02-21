import { useMemo, useState } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import {
  formatFileSize,
  formatModifiedDate,
  getFileColor,
} from '@/utils/fileClassification';
import FilePreview from '@/ui/previews/FilePreview';
import type { FileNode } from '@/types';

const PANEL_WIDTH = 320;

function getFileExtensionLabel(ext: string | null): string {
  if (!ext) return 'Unknown';
  return ext.replace(/^\./, '').toUpperCase();
}

// ── Sub-components ──────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span style={{ color: '#565f89', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: '#a9b1d6',
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  variant?: 'danger' | 'default';
}) {
  const isDanger = variant === 'danger';
  return (
    <button
      onClick={onClick}
      style={{
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
      }}
    >
      {label}
    </button>
  );
}

// ── Single file detail view ─────────────────────────────

function SingleFileDetail({ node }: { node: FileNode }) {
  const color = getFileColor(node.extension);

  const handleOpenExternal = (): void => {
    window.electronAPI.openExternal(node.path).catch((err: unknown) => {
      console.error('Failed to open externally:', err);
    });
  };

  const handleRename = (): void => {
    useSelectionStore.getState().openRenameDialog(node.path);
  };

  const handleDelete = (): void => {
    if (window.confirm(`Delete "${node.name}"?`)) {
      window.electronAPI.deleteFile(node.path).catch((err: unknown) => {
        console.error('Failed to delete:', err);
      });
      useSelectionStore.getState().clearSelection();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Color accent bar */}
      <div
        style={{ height: '3px', background: color, borderRadius: '2px' }}
      />

      {/* File name */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#e0e0e0',
          wordBreak: 'break-word',
        }}
      >
        {node.name}
      </div>

      {/* Info rows */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '13px',
        }}
      >
        <InfoRow label="Path" value={node.path} />
        <InfoRow
          label="Type"
          value={
            node.type === 'file'
              ? getFileExtensionLabel(node.extension) + ' File'
              : 'Directory'
          }
        />
        {node.extension && (
          <InfoRow label="Extension" value={node.extension} />
        )}
        <InfoRow label="Size" value={formatFileSize(node.sizeBytes)} />
        <InfoRow
          label="Modified"
          value={formatModifiedDate(node.modifiedAt)}
        />
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <ActionButton label="Open Externally" onClick={handleOpenExternal} />
        <ActionButton label="Rename" onClick={handleRename} />
        <ActionButton
          label="Move to Trash"
          onClick={handleDelete}
          variant="danger"
        />
      </div>
    </div>
  );
}

// ── Multi file detail view ──────────────────────────────

function MultiFileDetail({ nodes }: { nodes: FileNode[] }) {
  const totalSize = nodes.reduce((sum, n) => sum + n.sizeBytes, 0);

  const handleDeleteAll = (): void => {
    if (window.confirm(`Delete ${nodes.length} files?`)) {
      for (const node of nodes) {
        window.electronAPI.deleteFile(node.path).catch((err: unknown) => {
          console.error('Failed to delete:', err);
        });
      }
      useSelectionStore.getState().clearSelection();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{ fontSize: '16px', fontWeight: 600, color: '#e0e0e0' }}
      >
        {nodes.length} files selected
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '13px',
        }}
      >
        <InfoRow label="Total Size" value={formatFileSize(totalSize)} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontSize: '12px',
        }}
      >
        {nodes.map((n) => (
          <div
            key={n.id}
            style={{
              color: '#a9b1d6',
              padding: '4px 0',
              borderBottom: '1px solid #1a1b2e',
            }}
          >
            {n.name}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <ActionButton
          label="Delete All"
          onClick={handleDeleteAll}
          variant="danger"
        />
        <ActionButton
          label="Clear Selection"
          onClick={() => useSelectionStore.getState().clearSelection()}
        />
      </div>
    </div>
  );
}

// ── Main DetailPanel component ──────────────────────────

export default function DetailPanel() {
  const isOpen = useSelectionStore((s) => s.isDetailPanelOpen);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const nodes = useFileTreeStore((s) => s.nodes);
  const closePanel = useSelectionStore((s) => s.closeDetailPanel);
  const [activeTab, setActiveTab] = useState<'preview' | 'info'>('preview');

  const selectedNodes = useMemo(() => {
    const result: FileNode[] = [];
    for (const id of selectedIds) {
      const node = nodes.get(id);
      if (node) result.push(node);
    }
    return result;
  }, [selectedIds, nodes]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: `${PANEL_WIDTH}px`,
        height: '100vh',
        background: 'rgba(15, 15, 25, 0.95)',
        borderLeft: '1px solid #292e42',
        transform:
          isOpen && selectedNodes.length > 0
            ? 'translateX(0)'
            : `translateX(${PANEL_WIDTH}px)`,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        pointerEvents: 'auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #292e42',
        }}
      >
        <span
          style={{ fontSize: '14px', fontWeight: 600, color: '#7aa2f7' }}
        >
          Details
        </span>
        <button
          onClick={closePanel}
          style={{
            background: 'none',
            border: 'none',
            color: '#565f89',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab toggle (single file only) */}
      {selectedNodes.length === 1 && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #292e42',
            padding: '0 16px',
          }}
        >
          {(['preview', 'info'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
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
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {selectedNodes.length === 1 && activeTab === 'info' && (
          <SingleFileDetail node={selectedNodes[0]} />
        )}
        {selectedNodes.length === 1 && activeTab === 'preview' && (
          <FilePreview node={selectedNodes[0]} />
        )}
        {selectedNodes.length > 1 && (
          <MultiFileDetail nodes={selectedNodes} />
        )}
      </div>
    </div>
  );
}
