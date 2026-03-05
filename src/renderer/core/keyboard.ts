/**
 * Keyboard shortcuts handler for M5/M9.
 *
 * Default shortcuts (customizable via Settings → Keyboard tab):
 * - Delete / Backspace → delete selected items (with confirm dialog)
 * - F2 → rename selected item
 * - Enter → open selected file
 * - Space → view selected file (inline viewer) / toggle Agent Mind (no selection)
 * - Ctrl+N → create new file
 * - Ctrl+Shift+N → create new folder
 * - Ctrl+A → select all
 * - Escape → cancel / close overlays
 * - Tab → cycle selection through objects
 * - Home → reset camera
 * - Ctrl+F → open search
 * - Ctrl+, → open settings
 *
 * Does NOT capture shortcuts when a text input has focus.
 */
import { getScene } from '../engine/scene';
import { selectAll, cycleSelection } from '../engine/interaction';
import { resetCameraToDefault } from '../engine/camera';
import { selectedIds } from '../state/selection';
import {
  isTextInputFocused,
  closeContextMenu,
  closeFileViewer,
  closeTextInput,
  closeConfirmDialog,
  openTextInput,
  fileViewer,
  contextMenu,
  textInput,
  confirmDialog,
  showSearch,
  setShowSearch,
  showAgentMind,
  setShowAgentMind,
  showChat,
  setShowChat,
  showSettings,
  setShowSettings,
} from '../state/ui';
import { DEFAULT_SHORTCUTS } from '@shared/constants';
import type { ShortcutRow } from '../db/types';

export interface KeyboardShortcutCallbacks {
  onDelete: (paths: string[]) => void;
  onRename: (path: string) => void;
  onOpenFile: (path: string) => void;
  onViewFile: (path: string) => void;
}

let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

/** Currently active shortcut map (action → keyCombo) */
let shortcutMap: Record<string, string> = { ...DEFAULT_SHORTCUTS };

/**
 * Load custom shortcuts from DB rows and merge with defaults.
 */
export function applyCustomShortcuts(rows: ShortcutRow[]): void {
  shortcutMap = { ...DEFAULT_SHORTCUTS };
  for (const row of rows) {
    shortcutMap[row.action] = row.keyCombo;
  }
}

/** Get the current shortcut map (for testing). */
export function getShortcutMap(): Record<string, string> {
  return { ...shortcutMap };
}

/**
 * Build a normalized key string from a KeyboardEvent for matching.
 */
function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

/** Check if a combo matches an action's configured binding */
function comboMatchesAction(combo: string, action: string): boolean {
  const bound = shortcutMap[action];
  if (!bound) return false;
  return combo === bound;
}

/**
 * Initialize keyboard shortcuts.
 */
export function initKeyboardShortcuts(callbacks: KeyboardShortcutCallbacks): void {
  if (keyboardHandler) {
    window.removeEventListener('keydown', keyboardHandler);
  }

  keyboardHandler = (e: KeyboardEvent) => {
    // Skip if text input is focused
    if (isTextInputFocused()) return;

    // Skip if target is an input/textarea (unless it's the shortcut capture in settings)
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return;
    }

    const combo = eventToCombo(e);

    // ── Ctrl+, → open settings ──
    if (comboMatchesAction(combo, 'settings') || (combo === 'Ctrl+,' || combo === 'Ctrl+<')) {
      e.preventDefault();
      setShowSettings(!showSettings());
      return;
    }

    // ── Escape ── close overlays in priority order
    if (e.key === 'Escape') {
      if (showSettings()) {
        setShowSettings(false);
      } else if (textInput().open) {
        closeTextInput();
      } else if (confirmDialog().open) {
        closeConfirmDialog();
      } else if (contextMenu().open) {
        closeContextMenu();
      } else if (fileViewer().open) {
        closeFileViewer();
      } else if (showSearch()) {
        setShowSearch(false);
      }
      e.preventDefault();
      return;
    }

    // Don't process other shortcuts while settings panel is open
    if (showSettings()) return;

    // ── Ctrl+A → select all ──
    if (comboMatchesAction(combo, 'select-all')) {
      e.preventDefault();
      const scene = getScene();
      if (scene) selectAll(scene);
      return;
    }

    // ── Ctrl+N → new file ──
    if (comboMatchesAction(combo, 'new-file')) {
      e.preventDefault();
      openTextInput({ mode: 'create-file' });
      return;
    }

    // ── Ctrl+Shift+N → new folder ──
    if (comboMatchesAction(combo, 'new-folder')) {
      e.preventDefault();
      openTextInput({ mode: 'create-folder' });
      return;
    }

    // ── Ctrl+F → search ──
    if (comboMatchesAction(combo, 'search')) {
      e.preventDefault();
      setShowSearch(!showSearch());
      return;
    }

    // ── `/` → focus chat input ──
    if (e.key === '/' || comboMatchesAction(combo, 'chat')) {
      e.preventDefault();
      setShowChat(true);
      window.dispatchEvent(new CustomEvent('dax:focus-chat'));
      return;
    }

    // ── Home → reset camera ──
    if (e.key === 'Home' || comboMatchesAction(combo, 'reset-camera')) {
      e.preventDefault();
      resetCameraToDefault();
      return;
    }

    // ── Tab → cycle selection ──
    if (e.key === 'Tab' || comboMatchesAction(combo, 'cycle-selection')) {
      e.preventDefault();
      const scene = getScene();
      if (scene) cycleSelection(scene);
      return;
    }

    // Selection-dependent shortcuts
    const ids = selectedIds();

    // ── Space → toggle Agent Mind (no selection) or view file (with selection) ──
    if (e.key === ' ') {
      e.preventDefault();
      if (ids.size === 0) {
        setShowAgentMind(!showAgentMind());
      } else if (ids.size === 1) {
        const firstPath = Array.from(ids)[0];
        callbacks.onViewFile(firstPath);
      }
      return;
    }

    if (ids.size === 0) return;

    const firstPath = Array.from(ids)[0];

    // ── Delete / Backspace → delete ──
    if (e.key === 'Delete' || e.key === 'Backspace' || comboMatchesAction(combo, 'delete')) {
      e.preventDefault();
      callbacks.onDelete(Array.from(ids));
      return;
    }

    // ── F2 → rename ──
    if (e.key === 'F2' || comboMatchesAction(combo, 'rename')) {
      e.preventDefault();
      if (ids.size === 1) {
        callbacks.onRename(firstPath);
      }
      return;
    }

    // ── Enter → open file ──
    if (e.key === 'Enter' || comboMatchesAction(combo, 'open-file')) {
      e.preventDefault();
      if (ids.size === 1) {
        callbacks.onOpenFile(firstPath);
      }
      return;
    }
  };

  window.addEventListener('keydown', keyboardHandler);
}

/**
 * Dispose keyboard shortcuts.
 */
export function disposeKeyboardShortcuts(): void {
  if (keyboardHandler) {
    window.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
}
