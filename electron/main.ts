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
    const db = databaseService.db;
    const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get('app') as { value: string } | null;
    if (!row) return defaultSettings;
    try {
      return JSON.parse(row.value) as AppSettings;
    } catch {
      return defaultSettings;
    }
  });

  ipcMain.handle('settings:save', async (_event, settings: AppSettings): Promise<void> => {
    const db = databaseService.db;
    await db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run('app', JSON.stringify(settings));
  });
}

app.whenReady().then(async () => {
  createWindow();

  registerFilesystemHandlers(() => mainWindow, fileWatcher);
  registerShellHandlers();
  registerLLMHandlers();
  await databaseService.initialize();
  registerSettingsHandlers();
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
