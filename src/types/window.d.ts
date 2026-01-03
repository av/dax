// Global type declarations for Electron IPC APIs exposed via contextBridge

interface ElectronFsAPI {
  selectFolder(): Promise<string | null>;
  readDir(path: string): Promise<any[]>;
  readFile(path: string, encoding?: string): Promise<string>;
  readFileBuffer(path: string): Promise<number[]>;
  stat(path: string): Promise<any>;
  exists(path: string): Promise<boolean>;
}

interface ElectronDbAPI {
  initialize(config: any): Promise<{ success: boolean; dbPath: string }>;
  execute(query: any): Promise<any>;
  close(): Promise<void>;
}

interface ElectronAPI {
  fs?: ElectronFsAPI;
  db?: ElectronDbAPI;
  send?: (channel: string, data: any) => void;
  receive?: (channel: string, func: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
