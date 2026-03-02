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

// Enable remote debugging so DevTools can be opened via chrome://inspect
// (workaround for electron/electron#33684 — openDevTools() window not appearing on Linux/NVIDIA)
if (isDev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  console.log('[Dax] Remote debugging enabled on port 9222');
  console.log('[Dax] Open chrome://inspect in Chrome and add localhost:9222 to discover targets');
}

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
    backgroundColor: '#F7F5F2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });

  // Log renderer crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Dax] Renderer process gone:', details.reason, details.exitCode);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Dax] Failed to load:', errorCode, errorDescription);
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) { // warnings and errors
      console.error(`[Renderer] ${message} (${sourceId}:${line})`);
    }
  });

  // Toggle devtools with F12 or Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    const isF12 = input.key === 'F12' && !input.control && !input.alt && !input.shift;
    const isCtrlShiftI =
      input.key === 'I' && input.control && input.shift && !input.alt;
    if ((isF12 || isCtrlShiftI) && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('[Dax] loadURL failed:', err);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  // Open DevTools in detached window after DOM is ready
  if (isDev) {
    mainWindow.webContents.once('dom-ready', () => {
      setTimeout(() => {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
        console.log('[Dax] DevTools opened (detached window)');
      }, 500);
    });
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
  try {
    try {
      await databaseService.initialize();
    } catch (dbErr) {
      console.error('[Dax] Database initialization failed (continuing without DB):', dbErr);
    }

    registerFilesystemHandlers(() => mainWindow, fileWatcher);
    registerShellHandlers();
    registerLLMHandlers();
    registerSettingsHandlers();
    registerWorkspaceHandlers();

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error('[Dax] Startup error:', err);
  }
}).catch((err) => {
  console.error('[Dax] Fatal startup error:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await fileWatcher.stop();
  await databaseService.close();
});
