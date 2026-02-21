import { ipcMain, shell } from 'electron';

export function registerShellHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_event, filePath: string) => {
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  });
}
