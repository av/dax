/**
 * Inline text input overlay — floating input for create/rename operations.
 *
 * Modes: create-file, create-folder, rename
 * - Auto-focuses on mount
 * - Enter to confirm, Escape to cancel
 * - Positions near the context menu or center of screen
 */
import { type Component, Show, createEffect, onCleanup, onMount } from 'solid-js';
import {
  textInput,
  closeTextInput,
  setIsTextInputFocused,
} from '../../state/ui';

export interface TextInputCallbacks {
  onCreateFile: (name: string, parentAbsPath: string | null) => void;
  onCreateFolder: (name: string, parentAbsPath: string | null) => void;
  onRename: (targetPath: string, newName: string) => void;
}

export const TextInputOverlay: Component<{ callbacks: TextInputCallbacks }> = (
  props,
) => {
  let inputRef: HTMLInputElement | undefined;
  const state = textInput;

  function getPlaceholder(): string {
    const s = state();
    switch (s.mode) {
      case 'create-file':
        return 'New file name...';
      case 'create-folder':
        return 'New folder name...';
      case 'rename':
        return 'New name...';
      default:
        return 'Enter name...';
    }
  }

  function handleSubmit(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      closeTextInput();
      return;
    }

    const s = state();
    switch (s.mode) {
      case 'create-file':
        props.callbacks.onCreateFile(trimmed, s.parentAbsPath);
        break;
      case 'create-folder':
        props.callbacks.onCreateFolder(trimmed, s.parentAbsPath);
        break;
      case 'rename':
        if (s.targetPath) {
          props.callbacks.onRename(s.targetPath, trimmed);
        }
        break;
    }

    closeTextInput();
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit((e.target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeTextInput();
    }
    e.stopPropagation();
  }

  // Focus management
  createEffect(() => {
    if (state().open && inputRef) {
      setIsTextInputFocused(true);
      // requestAnimationFrame so the element is mounted
      requestAnimationFrame(() => {
        inputRef?.focus();
        // Select text for rename mode
        if (state().mode === 'rename' && inputRef) {
          // Select filename without extension
          const val = inputRef.value;
          const dotIdx = val.lastIndexOf('.');
          if (dotIdx > 0) {
            inputRef.setSelectionRange(0, dotIdx);
          } else {
            inputRef.select();
          }
        }
      });
    } else {
      setIsTextInputFocused(false);
    }
  });

  return (
    <Show when={state().open}>
      <div style={backdropStyle} onClick={() => closeTextInput()}>
        <div
          style={{
            ...containerStyle,
            left: `${state().x}px`,
            top: `${state().y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <label style={labelStyle}>
            {state().mode === 'create-file'
              ? 'Create File'
              : state().mode === 'create-folder'
                ? 'Create Folder'
                : 'Rename'}
          </label>
          <input
            ref={inputRef}
            type="text"
            style={inputStyle}
            value={state().initialValue}
            placeholder={getPlaceholder()}
            onKeyDown={handleKeyDown}
            onBlur={() => closeTextInput()}
          />
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
  'z-index': '1100',
  'pointer-events': 'auto',
};

const containerStyle: Record<string, string> = {
  position: 'absolute',
  background: 'rgba(28, 28, 38, 0.98)',
  'backdrop-filter': 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  'border-radius': '8px',
  padding: '10px 14px',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
  'min-width': '240px',
};

const labelStyle: Record<string, string> = {
  display: 'block',
  'font-size': '11px',
  color: '#8a8a9a',
  'margin-bottom': '6px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
  'font-weight': '600',
};

const inputStyle: Record<string, string> = {
  width: '100%',
  background: 'rgba(0, 0, 0, 0.3)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  'border-radius': '6px',
  padding: '8px 12px',
  color: '#e0e0e8',
  'font-size': '14px',
  'font-family': "'JetBrains Mono', 'Fira Code', monospace",
  outline: 'none',
  'box-sizing': 'border-box',
};
