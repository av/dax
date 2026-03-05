import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';

describe('IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerIPCHandlers', () => {
    it('registers app:getVersion handler', async () => {
      const { registerIPCHandlers } = await import('../../src/main/ipc');
      registerIPCHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('app:getVersion', expect.any(Function));
    });

    it('registers app:getPlatform handler', async () => {
      const { registerIPCHandlers } = await import('../../src/main/ipc');
      registerIPCHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('app:getPlatform', expect.any(Function));
    });

    it('registers app:getDataPath handler', async () => {
      const { registerIPCHandlers } = await import('../../src/main/ipc');
      registerIPCHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith('app:getDataPath', expect.any(Function));
    });

    it('app:getVersion handler returns the app version', async () => {
      const { registerIPCHandlers } = await import('../../src/main/ipc');
      registerIPCHandlers();

      // Extract the handler function that was registered
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const versionCall = handleCalls.find(([channel]) => channel === 'app:getVersion');
      expect(versionCall).toBeDefined();

      const handler = versionCall![1] as () => string;
      const result = handler();
      expect(result).toBe('0.1.0');
    });
  });
});
