import { type Component, For, createSignal, onCleanup } from 'solid-js';

// ── Toast Types ──

export type ToastVariant = 'info' | 'warning' | 'error' | 'success';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

// ── Toast State (module-level singleton) ──

let _nextId = 1;
const [toasts, setToasts] = createSignal<Toast[]>([]);

/** Show a toast notification. */
export function showToast(
  message: string,
  variant: ToastVariant = 'info',
  duration: number = 4000,
): void {
  const id = _nextId++;
  const toast: Toast = { id, message, variant, duration };
  setToasts((prev) => [...prev, toast]);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
}

/** Dismiss a specific toast. */
export function dismissToast(id: number): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

/** Convenience helpers */
export const toast = {
  info: (msg: string, duration?: number) => showToast(msg, 'info', duration),
  warning: (msg: string, duration?: number) => showToast(msg, 'warning', duration),
  error: (msg: string, duration?: number) => showToast(msg, 'error', duration),
  success: (msg: string, duration?: number) => showToast(msg, 'success', duration),
};

// ── Toast Colors ──

const variantColors: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  info: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', icon: 'ℹ' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', icon: '⚠' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', icon: '✖' },
  success: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', icon: '✓' },
};

// ── Toast Component ──

const ToastContainer: Component = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        'z-index': '10000',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px',
        'pointer-events': 'none',
        'max-width': '400px',
      }}
    >
      <For each={toasts()}>
        {(t) => <ToastItem toast={t} />}
      </For>
    </div>
  );
};

const ToastItem: Component<{ toast: Toast }> = (props) => {
  const colors = () => variantColors[props.toast.variant];

  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'flex-start',
        gap: '10px',
        padding: '12px 16px',
        background: colors().bg,
        'border-left': `3px solid ${colors().border}`,
        'border-radius': '8px',
        'backdrop-filter': 'blur(12px)',
        color: '#e0e0e0',
        'font-size': '13px',
        'line-height': '1.4',
        'pointer-events': 'auto',
        animation: 'dax-slide-in 0.3s ease',
        'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span style={{ 'font-size': '16px', 'flex-shrink': '0' }}>
        {colors().icon}
      </span>
      <span style={{ flex: '1' }}>{props.toast.message}</span>
      <button
        style={{
          background: 'none',
          border: 'none',
          color: '#8a8a9a',
          cursor: 'pointer',
          'font-size': '14px',
          padding: '0',
          'line-height': '1',
          'flex-shrink': '0',
        }}
        onClick={() => dismissToast(props.toast.id)}
      >
        ×
      </button>
    </div>
  );
};

export { ToastContainer };
