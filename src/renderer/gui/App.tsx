import { type Component, Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { ipcClient } from '../core/ipc-client';
import { bootstrapWorkspace } from '../core/bootstrap';
import { appConfig, setAppConfig } from '../state/config';
import { showWelcome, setShowWelcome, showMetadata, showSettings, setShowSettings } from '../state/ui';
import {
  openTextInput,
  showConfirmDialog,
  openFileViewer,
  closeContextMenu,
  setShowMetadata,
} from '../state/ui';
import { selectedIds, clearSelection } from '../state/selection';
import { WelcomePanel } from './panels/WelcomePanel';
import { MetadataPanel } from './panels/MetadataPanel';
import type { MetadataInfo } from './panels/MetadataPanel';
import { ToastContainer, toast } from './overlays/Toast';
import { ContextMenu } from './overlays/ContextMenu';
import type { ContextMenuCallbacks } from './overlays/ContextMenu';
import { FileViewer } from './overlays/FileViewer';
import { ConfirmDialog } from './overlays/ConfirmDialog';
import { TextInputOverlay } from './overlays/TextInput';
import type { TextInputCallbacks } from './overlays/TextInput';
import { Tooltip } from './overlays/Tooltip';
import {
  createFile,
  renameFile,
  moveFile,
  deleteFile,
  openFile,
  getFileStat,
  readTextFile,
  copyToClipboard,
} from '../fs/fs-service';
import { initKeyboardShortcuts, disposeKeyboardShortcuts } from '../core/keyboard';
import { SearchPanel } from './panels/SearchPanel';
import type { SearchPanelCallbacks } from './panels/SearchPanel';
import { ChatPanel } from './panels/ChatPanel';
import { AgentMindPanel } from './panels/AgentMindPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { searchFiles } from '../fs/fs-service';
import { getMeshByPath, applySearchHighlights, clearSearchHighlights, flyToPosition } from '../engine';
import { getScene } from '../engine/scene';
import { fileTree } from '../state/file-tree';
import type { SearchResult } from '@shared/file-types';

/**
 * Root Solid.js component.
 * Renders the overlay container on top of the Babylon.js canvas.
 *
 * - On mount: checks for stored workspace_path in config DB
 * - If no workspace stored: shows WelcomePanel
 * - If stored workspace doesn't exist on disk: shows warning toast + re-prompts
 * - After workspace is set: bootstraps the scene (scan + mesh creation + watcher)
 */
const App: Component = () => {
  const [version, setVersion] = createSignal<string>('...');
  const [bootstrapping, setBootstrapping] = createSignal(true);
  const [sceneLoading, setSceneLoading] = createSignal(false);
  const [agentSessionId, setAgentSessionId] = createSignal<string | null>(null);

  // ── File operation helpers ──

  async function handleOpenFile(path: string): Promise<void> {
    try {
      await openFile(path);
    } catch (err) {
      toast.error(`Failed to open: ${(err as Error).message}`);
    }
  }

  async function handleViewFile(path: string): Promise<void> {
    try {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'];
      const isImage = imageExts.includes(ext);

      let content: string | null = null;
      let fileType: 'text' | 'markdown' | 'json' | 'image' = 'text';

      if (isImage) {
        fileType = 'image';
      } else {
        content = await readTextFile(path);
        if (ext === 'md' || ext === 'markdown') {
          fileType = 'markdown';
        } else if (ext === 'json') {
          fileType = 'json';
        }
      }

      openFileViewer(path, path, content, fileType);
    } catch (err) {
      toast.error(`Failed to read file: ${(err as Error).message}`);
    }
  }

  function handleDeleteRequest(paths: string[]): void {
    const count = paths.length;
    const message =
      count === 1
        ? `Move "${paths[0].split('/').pop()}" to trash?`
        : `Move ${count} items to trash?`;

    showConfirmDialog({
      title: 'Delete',
      message,
      confirmLabel: 'Move to Trash',
      confirmVariant: 'danger',
      onConfirm: async () => {
        for (const p of paths) {
          try {
            await deleteFile(p);
          } catch (err) {
            toast.error(`Delete failed: ${(err as Error).message}`);
          }
        }
        clearSelection();
        toast.success(count === 1 ? 'Item deleted' : `${count} items deleted`);
      },
    });
  }

  function handleRenameRequest(path: string): void {
    const name = path.split('/').pop() ?? '';
    openTextInput({
      mode: 'rename',
      targetPath: path,
      initialValue: name,
    });
  }

  async function handleCopyPath(path: string): Promise<void> {
    try {
      await copyToClipboard(path);
      toast.success('Path copied');
    } catch (err) {
      toast.error(`Copy failed: ${(err as Error).message}`);
    }
  }

  function handleShowMetadata(path: string): void {
    // Select the item and open properties panel
    setShowMetadata(true);
  }

  // ── Context menu callbacks ──

  const contextMenuCallbacks: ContextMenuCallbacks = {
    onOpenFile: handleOpenFile,
    onViewFile: handleViewFile,
    onDelete: (path) => handleDeleteRequest([path]),
    onCopyPath: handleCopyPath,
    onShowMetadata: handleShowMetadata,
  };

  // ── Text input callbacks ──

  const textInputCallbacks: TextInputCallbacks = {
    onCreateFile: async (name, parentAbsPath) => {
      try {
        const dir = parentAbsPath ?? appConfig.workspacePath ?? '';
        const fullPath = dir ? `${dir}/${name}` : name;
        await createFile(fullPath, 'file');
        toast.success(`Created ${name}`);
      } catch (err) {
        toast.error(`Create failed: ${(err as Error).message}`);
      }
    },
    onCreateFolder: async (name, parentAbsPath) => {
      try {
        const dir = parentAbsPath ?? appConfig.workspacePath ?? '';
        const fullPath = dir ? `${dir}/${name}` : name;
        await createFile(fullPath, 'folder');
        toast.success(`Created folder ${name}`);
      } catch (err) {
        toast.error(`Create failed: ${(err as Error).message}`);
      }
    },
    onRename: async (targetPath, newName) => {
      try {
        await renameFile(targetPath, newName);
        toast.success(`Renamed to ${newName}`);
      } catch (err) {
        toast.error(`Rename failed: ${(err as Error).message}`);
      }
    },
  };

  // ── Metadata callbacks ──

  const metadataCallbacks = {
    onLoadMetadata: async (path: string): Promise<MetadataInfo | null> => {
      try {
        const stat = await getFileStat(path);
        if (!stat) return null;
        return {
          name: stat.name,
          path: stat.path,
          absPath: stat.path,
          type: stat.type === 'folder' ? 'Folder' : stat.extension || 'File',
          size: stat.sizeHuman,
          created: new Date(stat.createdAt).toLocaleString(),
          modified: new Date(stat.modifiedAt).toLocaleString(),
        };
      } catch {
        return null;
      }
    },
  };

  // ── Search panel callbacks ──

  const searchCallbacks: SearchPanelCallbacks = {
    onContentSearch: async (query: string, dir: string): Promise<SearchResult[]> => {
      return searchFiles(query, dir, 'content');
    },
    onFlyToObject: (path: string) => {
      const scene = getScene();
      if (!scene) return;
      const node = getMeshByPath(path);
      if (node) {
        flyToPosition(node.position, scene);
      }
    },
    onApplyHighlights: (matchedPaths: Set<string>) => {
      const allPaths = fileTree.entries.map((e) => e.path);
      applySearchHighlights(matchedPaths, getMeshByPath, allPaths);
    },
    onClearHighlights: () => {
      clearSearchHighlights();
    },
  };

  // ── Custom events from interaction system ──

  function onDaxOpenFile(e: Event): void {
    const detail = (e as CustomEvent).detail;
    if (detail?.path) handleOpenFile(detail.path);
  }

  function onDaxMoveIntoFolder(e: Event): void {
    const detail = (e as CustomEvent).detail;
    if (detail?.sourcePath && detail?.targetFolderPath) {
      moveFile(detail.sourcePath, detail.targetFolderPath)
        .then(() => toast.success('Moved successfully'))
        .catch((err: Error) => toast.error(`Move failed: ${err.message}`));
    }
  }

  /**
   * Bootstrap the scene after a workspace path is confirmed.
   */
  async function initWorkspace(dirPath: string): Promise<void> {
    setSceneLoading(true);
    try {
      await bootstrapWorkspace(dirPath);
      toast.success('Workspace loaded');
    } catch (err) {
      console.error('Bootstrap workspace failed:', err);
      toast.error(`Failed to load workspace: ${(err as Error).message}`);
    } finally {
      setSceneLoading(false);
    }
  }

  onMount(async () => {
    // Register custom event listeners
    window.addEventListener('dax:open-file', onDaxOpenFile);
    window.addEventListener('dax:move-into-folder', onDaxMoveIntoFolder);

    // Initialize keyboard shortcuts
    initKeyboardShortcuts({
      onDelete: handleDeleteRequest,
      onRename: handleRenameRequest,
      onOpenFile: handleOpenFile,
      onViewFile: handleViewFile,
    });

    try {
      // Get app version
      const v = await ipcClient.getVersion();
      setVersion(v);

      // Check for stored workspace path
      const storedPath = await ipcClient.configGet('workspace_path');

      if (!storedPath) {
        // First launch — show welcome panel
        setShowWelcome(true);
      } else {
        // Verify directory still exists
        const exists = await ipcClient.fsAccess(storedPath);
        if (exists) {
          setAppConfig({ workspacePath: storedPath, workspaceVerified: true });
          setShowWelcome(false);
          // Bootstrap the scene with the stored workspace
          await initWorkspace(storedPath);
        } else {
          // Directory no longer exists — warn and re-prompt
          toast.warning(
            `Directory not found: ${storedPath} — please select a new one`,
            6000,
          );
          setShowWelcome(true);
        }
      }
    } catch (err) {
      console.error('Bootstrap failed:', err);
      toast.error(`Startup error: ${(err as Error).message}`);
      setShowWelcome(true);
    } finally {
      setBootstrapping(false);
    }
  });

  onCleanup(() => {
    window.removeEventListener('dax:open-file', onDaxOpenFile);
    window.removeEventListener('dax:move-into-folder', onDaxMoveIntoFolder);
    disposeKeyboardShortcuts();
  });

  return (
    <div style={overlayStyle}>
      <div style={titleBarStyle}>
        <h1 style={titleStyle}>DAX</h1>
        <span style={versionStyle}>v{version()}</span>
        <Show when={appConfig.workspacePath}>
          <span style={workspaceStyle}>{appConfig.workspacePath}</span>
        </Show>
      </div>

      {/* Welcome panel (first launch or directory missing) */}
      <Show when={showWelcome() && !bootstrapping()}>
        <WelcomePanel />
      </Show>

      {/* M5: Context menu overlay */}
      <ContextMenu callbacks={contextMenuCallbacks} />

      {/* M5: File viewer overlay */}
      <FileViewer />

      {/* M5: Confirm dialog overlay */}
      <ConfirmDialog />

      {/* M5: Inline text input overlay */}
      <TextInputOverlay callbacks={textInputCallbacks} />

      {/* M5: Hover tooltip */}
      <Tooltip />

      {/* M6: Search panel */}
      <SearchPanel callbacks={searchCallbacks} />

      {/* M8: Agent Mind panel */}
      <AgentMindPanel />

      {/* M8: Chat panel */}
      <ChatPanel sessionId={agentSessionId()} />

      {/* M9: Settings panel */}
      <SettingsPanel />

      {/* M5: Metadata sidebar */}
      <MetadataPanel callbacks={metadataCallbacks} />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};

// Inline styles for the overlay (pointer-events: auto on interactive elements)
const overlayStyle: Record<string, string> = {
  width: '100%',
  height: '100%',
  display: 'flex',
  'flex-direction': 'column',
};

const titleBarStyle: Record<string, string> = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '16px 24px',
  'pointer-events': 'auto',
};

const titleStyle: Record<string, string> = {
  'font-size': '20px',
  'font-weight': '700',
  color: '#e94560',
  'letter-spacing': '2px',
  margin: '0',
};

const versionStyle: Record<string, string> = {
  'font-size': '12px',
  color: '#8a8a9a',
  'font-family': 'monospace',
};

const workspaceStyle: Record<string, string> = {
  'font-size': '12px',
  color: '#6a6a7a',
  'font-family': 'monospace',
  'margin-left': 'auto',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  'max-width': '400px',
};

export { App };
