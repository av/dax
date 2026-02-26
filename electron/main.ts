import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerFilesystemHandlers } from './ipc/filesystem';
import { registerShellHandlers } from './ipc/shell';
import { registerLLMHandlers } from './ipc/llm';
import { registerWorkspaceHandlers } from './ipc/workspace';
import { FileWatcherService } from './services/fileWatcher';
import { databaseService } from './services/database';
import type { AppSettings } from '../src/types/index';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
const fileWatcher = new FileWatcherService();

// electron-store is ESM-only; we dynamically import it.
// Under CommonJS moduleResolution the generic types don't resolve,
// so we define a minimal interface for the methods we use.
interface SettingsStore {
  get(key: 'settings'): AppSettings | undefined;
  set(key: 'settings', value: AppSettings): void;
}
let store: SettingsStore | null = null;

const ENCRYPTION_KEY = 'dax-settings-v1-enc';

const defaultSettings: AppSettings = {
  llm: {
    apiEndpoint: '',
    apiKey: '',
    modelName: '',
    temperature: 0.7,
    maxTokens: 4096,
    systemPromptOverride: null,
  },
  theme: 'dark',
  cameraSpeed: 1.0,
  lastOpenedFolder: null,
};

async function initStore(): Promise<SettingsStore> {
  if (store) return store;
  const { default: Store } = await import('electron-store');
  store = new Store({
    name: 'dax-settings',
    encryptionKey: ENCRYPTION_KEY,
    defaults: {
      settings: defaultSettings,
    },
  }) as unknown as SettingsStore;
  return store;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Dax',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const s = await initStore();
    return (s.get('settings') as AppSettings | undefined) ?? defaultSettings;
  });

  ipcMain.handle('settings:save', async (_event, settings: AppSettings): Promise<void> => {
    const s = await initStore();
    s.set('settings', settings);
  });
}

app.whenReady().then(async () => {
  createWindow();

  registerFilesystemHandlers(() => mainWindow, fileWatcher);
  registerShellHandlers();
  registerLLMHandlers();
  registerSettingsHandlers();
  await databaseService.initialize();
  registerWorkspaceHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  fileWatcher.stop();
  await databaseService.close();
});
