import type { DaxBridge } from '../../src/shared/ipc-api';

/**
 * Creates a mock IPC bridge for testing renderer code.
 * Provides type-safe stubs that can be overridden per-test.
 */
export function createMockBridge(overrides?: Partial<DaxBridge>): DaxBridge {
  return {
    getVersion: async () => '0.1.0',
    getPlatform: async () => 'linux',
    getDataPath: async () => '/tmp/dax-test/userData',
    selectDirectory: async () => null,
    configGet: async () => null,
    configSet: async () => {},
    fsAccess: async () => true,
    fsScan: async () => [],
    fsValidateName: async () => ({ valid: true }),
    watcherStart: async () => {},
    watcherStop: async () => {},
    onWatcherEvents: () => () => {},
    dbSceneGetAll: async () => [],
    dbSceneUpsert: async () => {},
    dbSceneUpsertBatch: async () => {},
    dbSceneDelete: async () => {},
    dbSceneDeleteOrphans: async () => 0,
    // M5 file operations
    fsCreate: async () => {},
    fsRename: async () => {},
    fsMove: async () => {},
    fsDelete: async () => {},
    fsOpen: async () => {},
    fsStat: async () => ({
      path: '/tmp/test/file.txt',
      name: 'file.txt',
      extension: 'txt',
      type: 'file' as const,
      sizeBytes: 1024,
      sizeHuman: '1 KB',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      permissions: 'rw-r--r--',
    }),
    fsReadText: async () => 'mock content',
    fsFolderSize: async () => 4096,
    clipboardWriteText: async () => {},
    fsSearch: async () => [],
    // M7 agent operations
    agentPrompt: async () => ({ message: 'mock response', actions: [], reasoning: '' }),
    agentCreateSession: async () => 'mock-session-1',
    agentHealth: async () => true,
    dbAgentGetState: async () => null,
    dbAgentSaveState: async () => {},
    dbAgentGetInstructions: async () => [],
    dbAgentSaveInstruction: async () => {},
    dbAgentDeleteInstruction: async () => {},
    dbAgentLogAction: async () => {},
    dbAgentGetActionLog: async () => [],
    dbAgentPruneLog: async () => 0,
    // M8 chat & crypto
    dbChatGetMessages: async () => [],
    dbChatSaveMessage: async () => {},
    cryptoEncrypt: async (text: string) => `enc:${text}`,
    cryptoDecrypt: async (text: string) => text.replace('enc:', ''),
    // M9 shortcuts
    dbShortcutsGetAll: async () => [],
    dbShortcutsSave: async () => {},
    dbShortcutsReset: async () => {},
    // M9 menu events
    onMenuEvent: () => () => {},
    ...overrides,
  };
}

/**
 * Installs the mock bridge on the global window object.
 */
export function installMockBridge(overrides?: Partial<DaxBridge>): DaxBridge {
  const bridge = createMockBridge(overrides);
  (globalThis as Record<string, unknown>).window = {
    ...(globalThis as Record<string, unknown>).window as object,
    dax: bridge,
  };
  return bridge;
}
