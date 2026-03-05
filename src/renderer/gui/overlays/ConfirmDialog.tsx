/**
 * Confirm dialog overlay — generic confirmation with customizable labels.
 *
 * Used for destructive actions like delete.
 */
import { type Component, Show, createEffect, onCleanup } from 'solid-js';
import { confirmDialog, closeConfirmDialog } from '../../state/ui';
import { Button } from '../shared/Button';

export const ConfirmDialog: Component = () => {
  const state = confirmDialog;

  // Escape key to cancel, Enter to confirm
  createEffect(() => {
    if (!state().open) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  function handleConfirm(): void {
    const cb = state().onConfirm;
    closeConfirmDialog();
    cb?.();
  }

  function handleCancel(): void {
    const cb = state().onCancel;
    closeConfirmDialog();
    cb?.();
  }

  return (
    <Show when={state().open}>
      <div style={backdropStyle} onClick={handleCancel}>
        <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
          <h3 style={titleStyle}>{state().title}</h3>
          <p style={messageStyle}>{state().message}</p>
          <div style={actionsStyle}>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant={state().confirmVariant === 'danger' ? 'danger' : 'primary'}
              onClick={handleConfirm}
            >
              {state().confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};

// ── Styles ──

const backdropStyle: Record<string, string> = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.5)',
  'z-index': '950',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'pointer-events': 'auto',
};

const dialogStyle: Record<string, string> = {
  background: 'rgba(28, 28, 38, 0.98)',
  'backdrop-filter': 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '12px',
  padding: '28px',
  'min-width': '360px',
  'max-width': '460px',
  'box-shadow': '0 12px 48px rgba(0, 0, 0, 0.5)',
};

const titleStyle: Record<string, string> = {
  margin: '0 0 12px 0',
  'font-size': '16px',
  'font-weight': '600',
  color: '#e0e0e8',
};

const messageStyle: Record<string, string> = {
  margin: '0 0 24px 0',
  'font-size': '14px',
  color: '#a0a0b0',
  'line-height': '1.5',
};

const actionsStyle: Record<string, string> = {
  display: 'flex',
  'justify-content': 'flex-end',
  gap: '10px',
};
