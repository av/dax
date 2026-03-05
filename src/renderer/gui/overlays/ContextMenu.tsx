/**
 * Context menu overlay component.
 *
 * Variants:
 * - file: Open, Rename, Copy Path, Delete
 * - folder: Open in Explorer, New File, New Folder, Rename, Delete
 * - empty: New File, New Folder
 */
import { type Component, Show, For } from 'solid-js';
import {
  contextMenu,
  closeContextMenu,
  openTextInput,
} from '../../state/ui';
import type { ContextMenuTarget } from '../../state/ui';

interface MenuItem {
  label: string;
  shortcut?: string;
  danger?: boolean;
  action: () => void;
}

function getMenuItems(
  target: ContextMenuTarget,
  callbacks: ContextMenuCallbacks,
): MenuItem[] {
  if (target.type === 'file') {
    return [
      {
        label: 'Open',
        shortcut: 'Enter',
        action: () => callbacks.onOpenFile(target.path),
      },
      {
        label: 'View',
        shortcut: 'Space',
        action: () => callbacks.onViewFile(target.path),
      },
      {
        label: 'Rename',
        shortcut: 'F2',
        action: () => {
          const name = target.path.split('/').pop() ?? '';
          openTextInput({
            mode: 'rename',
            targetPath: target.path,
            initialValue: name,
            x: contextMenu().x,
            y: contextMenu().y,
          });
        },
      },
      {
        label: 'Copy Path',
        action: () => callbacks.onCopyPath(target.path),
      },
      {
        label: 'Properties',
        action: () => callbacks.onShowMetadata(target.path),
      },
      {
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        action: () => callbacks.onDelete(target.path),
      },
    ];
  }

  if (target.type === 'folder') {
    return [
      {
        label: 'New File',
        shortcut: 'Ctrl+N',
        action: () => {
          openTextInput({
            mode: 'create-file',
            parentAbsPath: target.absPath,
            x: contextMenu().x,
            y: contextMenu().y,
          });
        },
      },
      {
        label: 'New Folder',
        shortcut: 'Ctrl+Shift+N',
        action: () => {
          openTextInput({
            mode: 'create-folder',
            parentAbsPath: target.absPath,
            x: contextMenu().x,
            y: contextMenu().y,
          });
        },
      },
      {
        label: 'Rename',
        shortcut: 'F2',
        action: () => {
          const name = target.path.split('/').pop() ?? '';
          openTextInput({
            mode: 'rename',
            targetPath: target.path,
            initialValue: name,
            x: contextMenu().x,
            y: contextMenu().y,
          });
        },
      },
      {
        label: 'Copy Path',
        action: () => callbacks.onCopyPath(target.path),
      },
      {
        label: 'Properties',
        action: () => callbacks.onShowMetadata(target.path),
      },
      {
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        action: () => callbacks.onDelete(target.path),
      },
    ];
  }

  // Empty space
  return [
    {
      label: 'New File',
      shortcut: 'Ctrl+N',
      action: () => {
        openTextInput({
          mode: 'create-file',
          x: contextMenu().x,
          y: contextMenu().y,
        });
      },
    },
    {
      label: 'New Folder',
      shortcut: 'Ctrl+Shift+N',
      action: () => {
        openTextInput({
          mode: 'create-folder',
          x: contextMenu().x,
          y: contextMenu().y,
        });
      },
    },
  ];
}

export interface ContextMenuCallbacks {
  onOpenFile: (path: string) => void;
  onViewFile: (path: string) => void;
  onDelete: (path: string) => void;
  onCopyPath: (path: string) => void;
  onShowMetadata: (path: string) => void;
}

export const ContextMenu: Component<{ callbacks: ContextMenuCallbacks }> = (props) => {
  const state = contextMenu;

  function handleItemClick(action: () => void): void {
    action();
    closeContextMenu();
  }

  // Close on outside click
  function handleBackdropClick(e: MouseEvent): void {
    e.stopPropagation();
    closeContextMenu();
  }

  return (
    <Show when={state().open && state().target}>
      <div style={backdropStyle} onClick={handleBackdropClick} onContextMenu={handleBackdropClick}>
        <div
          style={{
            ...menuStyle,
            left: `${state().x}px`,
            top: `${state().y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={getMenuItems(state().target!, props.callbacks)}>
            {(item) => (
              <button
                style={item.danger ? { ...itemStyle, ...dangerItemStyle } : itemStyle}
                onClick={() => handleItemClick(item.action)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = item.danger
                    ? 'rgba(233, 69, 96, 0.2)'
                    : 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span>{item.label}</span>
                <Show when={item.shortcut}>
                  <span style={shortcutStyle}>{item.shortcut}</span>
                </Show>
              </button>
            )}
          </For>
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
  'z-index': '1000',
  'pointer-events': 'auto',
};

const menuStyle: Record<string, string> = {
  position: 'absolute',
  'min-width': '180px',
  background: 'rgba(28, 28, 38, 0.95)',
  'backdrop-filter': 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  'border-radius': '8px',
  padding: '4px 0',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
  'z-index': '1001',
};

const itemStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  width: '100%',
  padding: '8px 14px',
  border: 'none',
  background: 'transparent',
  color: '#e0e0e8',
  'font-size': '13px',
  'font-family': "'Inter', system-ui, sans-serif",
  cursor: 'pointer',
  'text-align': 'left',
  transition: 'background 0.15s',
};

const dangerItemStyle: Record<string, string> = {
  color: '#e94560',
};

const shortcutStyle: Record<string, string> = {
  'font-size': '11px',
  color: '#6a6a7a',
  'margin-left': '24px',
  'font-family': 'monospace',
};
