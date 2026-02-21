import { ipcMain, shell } from 'electron';
export function registerShellHandlers() {
    ipcMain.handle('shell:openExternal', async (_event, filePath) => {
        const errorMessage = await shell.openPath(filePath);
        if (errorMessage) {
            throw new Error(errorMessage);
        }
    });
}
