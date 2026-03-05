/**
 * UI panel visibility signals.
 * Controls which panels/overlays are shown in the GUI.
 */
import { createSignal } from 'solid-js';

/** Settings panel visibility */
const [showSettings, setShowSettings] = createSignal(false);

/** Agent Mind panel visibility */
const [showAgentMind, setShowAgentMind] = createSignal(false);

/** Search panel visibility */
const [showSearch, setShowSearch] = createSignal(false);

/** Metadata sidebar visibility */
const [showMetadata, setShowMetadata] = createSignal(false);

/** Chat panel visibility */
const [showChat, setShowChat] = createSignal(false);

/** Welcome panel visibility (shown on first launch) */
const [showWelcome, setShowWelcome] = createSignal(false);

// ── Context Menu State ──

export type ContextMenuTarget =
  | { type: 'file'; path: string; absPath: string }
  | { type: 'folder'; path: string; absPath: string }
  | { type: 'empty' };

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget | null;
}

const [contextMenu, setContextMenu] = createSignal<ContextMenuState>({
  open: false,
  x: 0,
  y: 0,
  target: null,
});

export function openContextMenu(x: number, y: number, target: ContextMenuTarget): void {
  setContextMenu({ open: true, x, y, target });
}

export function closeContextMenu(): void {
  setContextMenu({ open: false, x: 0, y: 0, target: null });
}

// ── File Viewer State ──

export interface FileViewerState {
  open: boolean;
  filePath: string | null;
  absPath: string | null;
  content: string | null;
  fileType: 'text' | 'markdown' | 'json' | 'image' | null;
}

const [fileViewer, setFileViewer] = createSignal<FileViewerState>({
  open: false,
  filePath: null,
  absPath: null,
  content: null,
  fileType: null,
});

export function openFileViewer(
  filePath: string,
  absPath: string,
  content: string | null,
  fileType: 'text' | 'markdown' | 'json' | 'image',
): void {
  setFileViewer({ open: true, filePath, absPath, content, fileType });
}

export function closeFileViewer(): void {
  setFileViewer({ open: false, filePath: null, absPath: null, content: null, fileType: null });
}

// ── Confirm Dialog State ──

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'danger';
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

const [confirmDialog, setConfirmDialog] = createSignal<ConfirmDialogState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  confirmVariant: 'primary',
  onConfirm: null,
  onCancel: null,
});

export function showConfirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel?: () => void;
}): void {
  setConfirmDialog({
    open: true,
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel ?? 'Confirm',
    confirmVariant: opts.confirmVariant ?? 'primary',
    onConfirm: opts.onConfirm,
    onCancel: opts.onCancel ?? null,
  });
}

export function closeConfirmDialog(): void {
  setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null, onCancel: null }));
}

// ── Inline Text Input State ──

export interface TextInputState {
  open: boolean;
  mode: 'create-file' | 'create-folder' | 'rename' | null;
  /** For rename: the original path */
  targetPath: string | null;
  /** For rename: the original name (pre-fill) */
  initialValue: string;
  /** For create: parent directory where the new item will be created */
  parentAbsPath: string | null;
  /** Screen position for floating input */
  x: number;
  y: number;
}

const [textInput, setTextInput] = createSignal<TextInputState>({
  open: false,
  mode: null,
  targetPath: null,
  initialValue: '',
  parentAbsPath: null,
  x: 0,
  y: 0,
});

export function openTextInput(opts: {
  mode: 'create-file' | 'create-folder' | 'rename';
  targetPath?: string;
  initialValue?: string;
  parentAbsPath?: string;
  x?: number;
  y?: number;
}): void {
  setTextInput({
    open: true,
    mode: opts.mode,
    targetPath: opts.targetPath ?? null,
    initialValue: opts.initialValue ?? '',
    parentAbsPath: opts.parentAbsPath ?? null,
    x: opts.x ?? window.innerWidth / 2 - 120,
    y: opts.y ?? window.innerHeight / 2,
  });
}

export function closeTextInput(): void {
  setTextInput({
    open: false,
    mode: null,
    targetPath: null,
    initialValue: '',
    parentAbsPath: null,
    x: 0,
    y: 0,
  });
}

// ── Tooltip State ──

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  size: string;
  type: string;
}

const [tooltip, setTooltip] = createSignal<TooltipState>({
  visible: false,
  x: 0,
  y: 0,
  name: '',
  size: '',
  type: '',
});

// ── Text Input Focused (for keyboard shortcut suppression) ──
const [isTextInputFocused, setIsTextInputFocused] = createSignal(false);

export {
  showSettings,
  setShowSettings,
  showAgentMind,
  setShowAgentMind,
  showSearch,
  setShowSearch,
  showMetadata,
  setShowMetadata,
  showChat,
  setShowChat,
  showWelcome,
  setShowWelcome,
  contextMenu,
  setContextMenu,
  fileViewer,
  setFileViewer,
  confirmDialog,
  setConfirmDialog,
  textInput,
  setTextInput,
  tooltip,
  setTooltip,
  isTextInputFocused,
  setIsTextInputFocused,
};
