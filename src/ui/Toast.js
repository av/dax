import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { create } from 'zustand';
import { useCallback, useEffect, useRef, useState } from 'react';
let nextId = 0;
export const useToastStore = create((set) => ({
    toasts: [],
    addToast: (message, type = 'info', duration = 4000) => {
        const id = `toast-${++nextId}`;
        const toast = { id, message, type, duration, createdAt: Date.now() };
        set((s) => ({ toasts: [...s.toasts, toast] }));
    },
    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
const TYPE_COLORS = {
    info: '#7aa2f7',
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
};
function SingleToast({ toast, index }) {
    const removeToast = useToastStore((s) => s.removeToast);
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef(null);
    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => removeToast(toast.id), 300);
    }, [removeToast, toast.id]);
    useEffect(() => {
        timerRef.current = setTimeout(dismiss, toast.duration);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, [dismiss, toast.duration]);
    const color = TYPE_COLORS[toast.type];
    return (_jsxs("div", { style: {
            padding: '10px 20px',
            background: 'rgba(26, 27, 38, 0.95)',
            color: '#c0caf5',
            border: `1px solid ${color}`,
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 8px ${color}33`,
            cursor: 'pointer',
            maxWidth: '420px',
            textAlign: 'center',
            animation: exiting
                ? 'daxToastExit 0.3s ease-in forwards'
                : 'daxToastEnter 0.3s ease-out forwards',
            transform: `translateY(${index * -4}px)`,
            transition: 'transform 0.2s ease',
        }, onClick: dismiss, children: [_jsx("span", { style: { color, marginRight: '8px', fontWeight: 600 }, children: toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ' }), toast.message] }));
}
// ── Toast Container ────────────────────────────────────
export default function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    if (toasts.length === 0)
        return null;
    return (_jsxs("div", { style: {
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '8px',
            zIndex: 200,
            pointerEvents: 'auto',
        }, children: [toasts.map((toast, i) => (_jsx(SingleToast, { toast: toast, index: i }, toast.id))), _jsx("style", { children: `
        @keyframes daxToastEnter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes daxToastExit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(16px); }
        }
      ` })] }));
}
