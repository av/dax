import { contextBridge, ipcRenderer } from 'electron';
import type { FileNode, FileChangeEvent, AppSettings, LLMConfig, LLMMessage, DaxAPI } from '../src/types/index';

const api: DaxAPI = {
  openFolder(): Promise<string | null> {
    return ipcRenderer.invoke('dialog:openFolder');
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

  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: FileChangeEvent): void => {
      callback(data);
    };
    ipcRenderer.on('fs:fileChange', handler);
    return () => {
      ipcRenderer.removeListener('fs:fileChange', handler);
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
};

contextBridge.exposeInMainWorld('electronAPI', api);
