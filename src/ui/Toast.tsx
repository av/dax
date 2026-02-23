import { create } from 'zustand';
import { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from '@/theme';

// ── Types ──────────────────────────────────────────────

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  /** Unix timestamp when the toast was created */
  createdAt: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = `toast-${++nextId}`;
    const toast: ToastItem = { id, message, type, duration, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, toast] }));
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),
}));

// ── Convenience hook ───────────────────────────────────

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  return {
    showToast: addToast,
  };
}

// ── Single Toast ───────────────────────────────────────

const TYPE_COLORS: Record<ToastType, string> = {
  info: theme.colors.accentPrimary,
  success: theme.colors.statusSuccess,
  warning: theme.colors.statusWarning,
  error: theme.colors.statusError,
};

function SingleToast({ toast, index }: { toast: ToastItem; index: number }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => removeToast(toast.id), 300);
  }, [removeToast, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, toast.duration]);

  const color = TYPE_COLORS[toast.type];

  return (
    <div
      style={{
        padding: '10px 20px',
        background: `${theme.colors.bgSurface}F2`,
        color: theme.colors.textPrimary,
        border: `1px solid ${color}`,
        borderRadius: '8px',
        fontSize: '13px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: `0 4px 20px ${theme.colors.textPrimary}33, 0 0 8px ${color}33`,
          cursor: 'pointer',
        maxWidth: '420px',
        textAlign: 'center',
        animation: exiting
          ? 'daxToastExit 0.3s ease-in forwards'
          : 'daxToastEnter 0.3s ease-out forwards',
        transform: `translateY(${index * -4}px)`,
        transition: 'transform 0.2s ease',
      }}
      onClick={dismiss}
    >
      <span style={{ color, marginRight: '8px', fontWeight: 600 }}>
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'}
      </span>
      {toast.message}
    </div>
  );
}

// ── Toast Container ────────────────────────────────────

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '8px',
        zIndex: 200,
        pointerEvents: 'auto',
      }}
    >
      {toasts.map((toast, i) => (
        <SingleToast key={toast.id} toast={toast} index={i} />
      ))}

      <style>{`
        @keyframes daxToastEnter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes daxToastExit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(16px); }
        }
      `}</style>
    </div>
  );
}
