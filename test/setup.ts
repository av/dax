/**
 * Vitest global setup.
 * Mocks Electron native APIs that don't exist in the test environment.
 */
import { vi } from 'vitest';

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.0',
    getPath: (name: string) => `/tmp/dax-test/${name}`,
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: { openDevTools: vi.fn() },
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}));
