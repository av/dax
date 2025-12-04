import { useCallback, useEffect, useState } from 'react';
import { sceneEvents } from '@/engine/events';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogBase({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'rgba(24, 24, 27, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '320px',
          maxWidth: '480px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          style={{
            margin: '0 0 12px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ef4444';
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteDialogState {
  isOpen: boolean;
  objectIds: string[];
}

export function DeleteConfirmDialog({ objectManager }: { objectManager: { removeObject: (id: string) => void } | null }) {
  const [state, setState] = useState<DeleteDialogState>({
    isOpen: false,
    objectIds: [],
  });

  useEffect(() => {
    const handleDelete = (payload: { objectIds: string[] }) => {
      setState({
        isOpen: true,
        objectIds: payload.objectIds,
      });
    };

    sceneEvents.on('input:delete', handleDelete);
    return () => {
      sceneEvents.off('input:delete', handleDelete);
    };
  }, []);

  const handleConfirm = useCallback(() => {
    if (objectManager) {
      state.objectIds.forEach((id) => {
        objectManager.removeObject(id);
      });
    }
    setState({ isOpen: false, objectIds: [] });
  }, [state.objectIds, objectManager]);

  const handleCancel = useCallback(() => {
    setState({ isOpen: false, objectIds: [] });
  }, []);

  const count = state.objectIds.length;
  const title = count === 1 ? 'Delete Object?' : `Delete ${count} Objects?`;
  const message =
    count === 1
      ? 'This object will be removed from the workspace. This action cannot be undone.'
      : `${count} objects will be removed from the workspace. This action cannot be undone.`;

  return (
    <ConfirmDialogBase
      isOpen={state.isOpen}
      title={title}
      message={message}
      confirmLabel={count === 1 ? 'Delete' : `Delete ${count}`}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

export { ConfirmDialogBase as ConfirmDialog };
