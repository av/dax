import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerFilesystemHandlers } from './ipc/filesystem';
import { registerShellHandlers } from './ipc/shell';
import { registerLLMHandlers } from './ipc/llm';
import { FileWatcherService } from './services/fileWatcher';
const isDev = !app.isPackaged;
let mainWindow = null;
const fileWatcher = new FileWatcherService();
let store = null;
const ENCRYPTION_KEY = 'dax-settings-v1-enc';
const defaultSettings = {
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
async function initStore() {
    if (store)
        return store;
    const { default: Store } = await import('electron-store');
    store = new Store({
        name: 'dax-settings',
        encryptionKey: ENCRYPTION_KEY,
        defaults: {
            settings: defaultSettings,
        },
    });
    return store;
}
function createWindow() {
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function registerSettingsHandlers() {
    ipcMain.handle('settings:get', async () => {
        const s = await initStore();
        return s.get('settings') ?? defaultSettings;
    });
    ipcMain.handle('settings:save', async (_event, settings) => {
        const s = await initStore();
        s.set('settings', settings);
    });
}
app.whenReady().then(() => {
    createWindow();
    registerFilesystemHandlers(() => mainWindow, fileWatcher);
    registerShellHandlers();
    registerLLMHandlers();
    registerSettingsHandlers();
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
app.on('before-quit', () => {
    fileWatcher.stop();
});
