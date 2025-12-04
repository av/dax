import { useState, useEffect, useCallback } from 'react';
import { sceneEvents } from '@/engine/events';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationToastState {
  notifications: Notification[];
}

// Global notification state
let notificationState: NotificationToastState = { notifications: [] };
const listeners: Set<(state: NotificationToastState) => void> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(notificationState));
};

// Public API to show notifications
export function showNotification(notification: Omit<Notification, 'id'>): string {
  const id = crypto.randomUUID();
  const fullNotification: Notification = {
    id,
    duration: 5000,
    ...notification,
  };

  notificationState = {
    notifications: [...notificationState.notifications, fullNotification],
  };
  notifyListeners();

  return id;
}

export function hideNotification(id: string): void {
  notificationState = {
    notifications: notificationState.notifications.filter((n) => n.id !== id),
  };
  notifyListeners();
}

export function clearAllNotifications(): void {
  notificationState = { notifications: [] };
  notifyListeners();
}

// Convenience methods
export function showSuccess(title: string, message?: string): string {
  return showNotification({ type: 'success', title, message });
}

export function showError(title: string, message?: string): string {
  return showNotification({ type: 'error', title, message, duration: 8000 });
}

export function showInfo(title: string, message?: string): string {
  return showNotification({ type: 'info', title, message });
}

export function showWarning(title: string, message?: string): string {
  return showNotification({ type: 'warning', title, message });
}

// Component
export function NotificationToast() {
  const [state, setState] = useState<NotificationToastState>({ notifications: [] });

  useEffect(() => {
    // Subscribe to state changes
    const listener = (newState: NotificationToastState) => setState(newState);
    listeners.add(listener);

    // Listen for scene events that should trigger notifications
    const handleGoalComplete = (data: { goalId: string; title: string; success: boolean }) => {
      if (data.success) {
        showSuccess('Goal Completed', data.title);
      } else {
        showError('Goal Failed', data.title);
      }
    };

    sceneEvents.on('goal:completed' as 'scene:ready', handleGoalComplete as () => void);

    return () => {
      listeners.delete(listener);
      sceneEvents.off('goal:completed' as 'scene:ready', handleGoalComplete as () => void);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    hideNotification(id);
  }, []);

  useEffect(() => {
    // Auto-dismiss notifications after their duration
    const timers: NodeJS.Timeout[] = [];

    state.notifications.forEach((notification) => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          hideNotification(notification.id);
        }, notification.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [state.notifications]);

  if (state.notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {state.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          role="alert"
        >
          <div className="notification-icon">
            {notification.type === 'success' && '✓'}
            {notification.type === 'error' && '✕'}
            {notification.type === 'warning' && '⚠'}
            {notification.type === 'info' && 'ℹ'}
          </div>
          <div className="notification-content">
            <div className="notification-title">{notification.title}</div>
            {notification.message && (
              <div className="notification-message">{notification.message}</div>
            )}
            {notification.action && (
              <button
                className="notification-action"
                onClick={() => {
                  notification.action?.onClick();
                  handleDismiss(notification.id);
                }}
              >
                {notification.action.label}
              </button>
            )}
          </div>
          <button
            className="notification-dismiss"
            onClick={() => handleDismiss(notification.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default NotificationToast;
