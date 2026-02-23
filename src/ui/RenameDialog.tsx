import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { useToast } from '@/ui/Toast';
import { theme } from '@/theme';

// Characters forbidden in file/directory names across platforms
const ILLEGAL_CHARS = /[/\\:*?"<>|]/;

function getFileNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? '';
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Name cannot be empty.';
  if (ILLEGAL_CHARS.test(trimmed))
    return 'Name contains invalid characters: / \\ : * ? " < > |';
  if (trimmed === '.' || trimmed === '..')
    return 'Name cannot be "." or "..".';
  return null;
}

export default function RenameDialog() {
  const renameTarget = useSelectionStore((s) => s.renameTarget);
  const closeRenameDialog = useSelectionStore((s) => s.closeRenameDialog);
  const nodes = useFileTreeStore((s) => s.nodes);
  const { showToast } = useToast();

  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive the current name from the target path
  const currentName = renameTarget ? getFileNameFromPath(renameTarget) : '';

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft when the dialog opens
  useEffect(() => {
    if (renameTarget) {
      const name = getFileNameFromPath(renameTarget);
      setDraft(name);
      setError(null);
      setIsSaving(false);
    }
  }, [renameTarget]);

  // Auto-select the name (without extension) when opened
  useEffect(() => {
    if (renameTarget && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      const dotIndex = draft.lastIndexOf('.');
      if (dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
      } else {
        input.select();
      }
    }
    // Only run when dialog opens, not on every draft change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameTarget]);

  const handleClose = useCallback(() => {
    closeRenameDialog();
  }, [closeRenameDialog]);

  const handleSave = useCallback(async () => {
    if (!renameTarget) return;

    const trimmed = draft.trim();
    const validationError = validateName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    // No change — just close
    if (trimmed === currentName) {
      handleClose();
      return;
    }

    setIsSaving(true);
    try {
      await window.electronAPI.renameFile(renameTarget, trimmed);
      showToast(`Renamed to "${trimmed}"`, 'success');
      handleClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Rename failed';
      showToast(`Rename failed: ${message}`, 'error');
      setIsSaving(false);
    }
  }, [renameTarget, draft, currentName, handleClose, showToast]);

  // Close on Escape, submit on Enter
  useEffect(() => {
    if (!renameTarget) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [renameTarget, handleClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value);
      if (error) setError(null);
    },
    [error],
  );

  const handleKeyDownInput = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isSaving) {
        void handleSave();
      }
    },
    [handleSave, isSaving],
  );

  if (!renameTarget) return null;

  // Look up node info for display
  let nodeLabel = currentName;
  for (const node of nodes.values()) {
    if (node.path === renameTarget) {
      nodeLabel = node.type === 'directory' ? `📁 ${node.name}` : node.name;
      break;
    }
  }

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
          width: '420px',
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
            Rename
          </h2>
          <button onClick={handleClose} style={closeButtonStyle}>
            ✕
          </button>
        </div>

        {/* Current name display */}
        <div
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            marginBottom: '12px',
          }}
        >
          Renaming: <span style={{ color: theme.colors.textSecondary }}>{nodeLabel}</span>
        </div>

        {/* Input field */}
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            color: theme.colors.textSecondary,
            marginBottom: '4px',
            fontWeight: 500,
          }}
        >
          New name
        </label>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInput}
          disabled={isSaving}
          style={{
            ...inputStyle,
            borderColor: error ? theme.colors.statusError : theme.colors.borderDefault,
          }}
        />

        {/* Validation error */}
        {error && (
          <div
            style={{
              color: theme.colors.statusError,
              fontSize: '12px',
              marginTop: '-8px',
              marginBottom: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: `1px solid ${theme.colors.borderDefault}`,
          }}
        >
          <button
            onClick={handleClose}
            disabled={isSaving}
            style={cancelButtonStyle}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{
              ...saveButtonStyle,
              opacity: isSaving ? 0.5 : 1,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? 'Renaming…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared styles ──────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: '13px',
  background: theme.colors.bgSurface,
  color: theme.colors.textPrimary,
  border: `1px solid ${theme.colors.borderDefault}`,
  borderRadius: '6px',
  outline: 'none',
  marginBottom: '12px',
  fontFamily: 'monospace',
};

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

const saveButtonStyle: React.CSSProperties = {
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
