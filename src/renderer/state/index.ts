/**
 * State barrel — re-exports all signal stores.
 */
export { fileTree, setFileTree, addEntry, removeEntry, updateEntry, replaceTree } from './file-tree';
export type { FileTreeState } from './file-tree';

export {
  sceneObjects,
  setSceneObjects,
  upsertSceneObject,
  removeSceneObject,
  replaceSceneObjects,
  getSceneObjectsList,
} from './scene-objects';
export type { SceneObjectsState } from './scene-objects';

export {
  selectedIds,
  setSelectedIds,
  selectOne,
  addToSelection,
  removeFromSelection,
  toggleSelection,
  clearSelection,
  isSelected,
} from './selection';

export { cameraState, setCameraState, resetCamera } from './camera';
export type { CameraState } from './camera';

export { agentState, setAgentState } from './agent';
export type { AgentBDIState } from './agent';

export {
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
  searchResults,
  setSearchResults,
  clearSearch,
} from './search';
export type { SearchResultsState } from './search';

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
  openContextMenu,
  closeContextMenu,
  fileViewer,
  setFileViewer,
  openFileViewer,
  closeFileViewer,
  confirmDialog,
  setConfirmDialog,
  showConfirmDialog,
  closeConfirmDialog,
  textInput,
  setTextInput,
  openTextInput,
  closeTextInput,
  tooltip,
  setTooltip,
  isTextInputFocused,
  setIsTextInputFocused,
} from './ui';

export type {
  ContextMenuTarget,
  ContextMenuState,
  FileViewerState,
  ConfirmDialogState,
  TextInputState,
  TooltipState,
} from './ui';

export { appConfig, setAppConfig } from './config';
export type { AppConfig } from './config';
