import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerIPCHandlers } from './ipc';
import { buildApplicationMenu } from './menu';

let _mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  registerIPCHandlers();
  buildApplicationMenu();
  _mainWindow = createMainWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked and no windows exist.
    if (BrowserWindow.getAllWindows().length === 0) {
      _mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
