/**
 * Application menu bar for DAX.
 * Electron Menu built from template — File, View, Agent, Help.
 */
import { app, Menu, BrowserWindow, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

/**
 * Build and set the application menu bar.
 * Must be called after app.whenReady().
 */
export function buildApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Change Directory',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
              title: 'Select Workspace Directory',
            });
            if (!result.canceled && result.filePaths.length > 0) {
              win.webContents.send('menu:change-directory', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reset Layout',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:reset-layout');
          },
        },
        {
          label: 'Toggle Agent Mind',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-agent-mind');
          },
        },
        {
          label: 'Toggle Search',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-search');
          },
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:open-settings');
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { role: 'reload', label: 'Reload' },
      ],
    },
    {
      label: 'Agent',
      submenu: [
        {
          label: 'Pause/Resume Agent',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:toggle-agent');
          },
        },
        {
          label: 'Export Action Log',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu:export-action-log');
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About DAX',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'About DAX',
                message: `DAX v${app.getVersion()}`,
                detail:
                  'A desktop app that mirrors a filesystem as 3D objects in a physics-based environment with an autonomous AI agent.',
              });
            }
          },
        },
      ],
    },
  ];

  // macOS: prepend app-name menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'About DAX' },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide' },
        { role: 'hideOthers', label: 'Hide Others' },
        { role: 'unhide', label: 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
