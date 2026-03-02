import { contextBridge, ipcRenderer } from 'electron';
import type { FileNode, FileChangeEvent, AppSettings, LLMConfig, LLMMessage, DaxAPI, SceneSnapshot, SaveSceneObject, AttributeRow, TaggedObject, WatcherInitPayload, WatcherErrorEvent } from '../src/types/index';

const api: DaxAPI = {
  openFolder(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:openFolder');
  },

  watchFolder(path: string): Promise<WatcherInitPayload> {
    return ipcRenderer.invoke('fs:watchFolder', path);
  },

  readDirectory(path: string): Promise<FileNode[]> {
    return ipcRenderer.invoke('fs:readDirectory', path);
  },

  statFile(path: string): Promise<FileNode | null> {
    return ipcRenderer.invoke('fs:statFile', path);
  },

  readFileContent(path: string): Promise<string> {
    return ipcRenderer.invoke('fs:readFileContent', path);
  },

  readBinaryFile(path: string): Promise<string> {
    return ipcRenderer.invoke('fs:readBinaryFile', path);
  },

  writeFileContent(path: string, content: string): Promise<void> {
    return ipcRenderer.invoke('fs:writeFileContent', path, content);
  },

  moveFile(src: string, dest: string): Promise<void> {
    return ipcRenderer.invoke('fs:moveFile', src, dest);
  },

  deleteFile(path: string): Promise<void> {
    return ipcRenderer.invoke('fs:deleteFile', path);
  },

  renameFile(path: string, newName: string): Promise<void> {
    return ipcRenderer.invoke('fs:renameFile', path, newName);
  },

  openExternal(path: string): Promise<void> {
    return ipcRenderer.invoke('shell:openExternal', path);
  },

  onFileChange(callback: (event: { sessionId: number; events: FileChangeEvent[] }) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: number; events: FileChangeEvent[] }): void => {
      callback(data);
    };
    ipcRenderer.on('fs:fileChange', handler);
    return () => {
      ipcRenderer.removeListener('fs:fileChange', handler);
    };
  },

  onWatcherError(callback: (event: WatcherErrorEvent) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: WatcherErrorEvent): void => {
      callback(data);
    };
    ipcRenderer.on('fs:watcherError', handler);
    return () => {
      ipcRenderer.removeListener('fs:watcherError', handler);
    };
  },

  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke('settings:get');
  },

  saveSettings(settings: AppSettings): Promise<void> {
    return ipcRenderer.invoke('settings:save', settings);
  },

  testLLMConnection(config: LLMConfig): Promise<boolean> {
    return ipcRenderer.invoke('llm:testConnection', config);
  },

  sendLLMMessage(messages: LLMMessage[], config: LLMConfig): Promise<string> {
    return ipcRenderer.invoke('llm:sendMessage', messages, config);
  },

  abortLLM(): Promise<void> {
    return ipcRenderer.invoke('llm:abort');
  },

  // ── Workspace / Scene Persistence ─────────────────────
  workspaceOpen(wsPath: string, name: string): Promise<{ workspaceId: number }> {
    return ipcRenderer.invoke('workspace:open', { path: wsPath, name });
  },

  workspaceLoadScene(workspaceId: number): Promise<SceneSnapshot> {
    return ipcRenderer.invoke('workspace:loadScene', { workspaceId });
  },

  workspaceSaveScene(workspaceId: number, objects: SaveSceneObject[]): Promise<void> {
    return ipcRenderer.invoke('workspace:saveScene', { workspaceId, objects });
  },

  workspaceUpsertAttributes(sceneObjectId: number, attrs: Record<string, string>): Promise<void> {
    return ipcRenderer.invoke('workspace:upsertAttributes', { sceneObjectId, attrs });
  },

  workspaceLoadAttributes(sceneObjectId: number): Promise<AttributeRow[]> {
    return ipcRenderer.invoke('workspace:loadAttributes', { sceneObjectId });
  },

  workspaceSaveTags(sceneObjectId: number, tagIds: number[]): Promise<void> {
    return ipcRenderer.invoke('workspace:saveTags', { sceneObjectId, tagIds });
  },

  workspaceLoadTags(workspaceId: number): Promise<TaggedObject[]> {
    return ipcRenderer.invoke('workspace:loadTags', { workspaceId });
  },

  workspaceSaveEmbedding(fileId: number, model: string, vector: number[]): Promise<void> {
    return ipcRenderer.invoke('workspace:saveEmbedding', { fileId, model, vector });
  },

  workspaceSearchByEmbedding(vector: number[], limit?: number): Promise<{ fileId: number; distance: number }[]> {
    return ipcRenderer.invoke('workspace:searchByEmbedding', { vector, limit });
  },
};
contextBridge.exposeInMainWorld('electronAPI', api);
