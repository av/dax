/**
 * Agent main-process service.
 *
 * Exposes IPC handlers for agent operations:
 * - OpenCode SDK session management (stub)
 * - Agent state persistence (via AgentRepo)
 * - Action logging
 * - Instruction management
 */
import { ipcMain } from 'electron';
import { AgentRepo } from '../db/agent-repo';
import { ChatRepo } from '../db/chat-repo';
import {
  createAgentSession,
  sendPrompt,
  checkHealth,
  closeSession,
} from './opencode';
import { encryptApiKey, decryptApiKey } from './crypto';
import type { AgentContext, AgentResponse } from './opencode';
import type { TursoDB } from '../db/index';
import type { AgentStateRow, InstructionRow, ActionLogRow, ChatMessageRow, ShortcutRow } from '../../renderer/db/types';
import { DEFAULT_SHORTCUTS } from '@shared/constants';

let agentRepo: AgentRepo | null = null;
let chatRepo: ChatRepo | null = null;
let currentSessionId: string | null = null;
let db: TursoDB | null = null;

/**
 * Initialize the agent service with a database connection.
 * Must be called after the database is initialized.
 */
export function initAgentService(_db: TursoDB): void {
  db = _db;
  agentRepo = new AgentRepo(_db);
  chatRepo = new ChatRepo(_db);
}

/** Lazy DB initializer passed from ipc.ts */
let ensureInitialized: (() => Promise<void>) | null = null;

async function ensureReady(): Promise<void> {
  if (db) return;
  if (ensureInitialized) await ensureInitialized();
  if (!db) throw new Error('Agent service not initialized');
}

/**
 * Register all agent-related IPC handlers.
 * These channels are defined in shared/ipc-api.ts under the agent section.
 *
 * @param lazyInit - callback that ensures the DB is initialized (calls ensureDB)
 */
export function registerAgentIPCHandlers(lazyInit: () => Promise<void>): void {
  ensureInitialized = lazyInit;
  // ── OpenCode SDK (stub) ──

  ipcMain.handle('agent:createSession', async () => {
    const sessionId = createAgentSession();
    currentSessionId = sessionId;
    return sessionId;
  });

  ipcMain.handle(
    'agent:prompt',
    async (_event, sessionId: string, message: string, context: AgentContext) => {
      return sendPrompt(sessionId, message, context);
    },
  );

  ipcMain.handle('agent:health', async () => {
    return checkHealth();
  });

  // ── Agent State DB ──

  ipcMain.handle('db:agent:getState', async () => {
    await ensureReady();
    return agentRepo!.getState();
  });

  ipcMain.handle('db:agent:saveState', async (_event, state: AgentStateRow) => {
    await ensureReady();
    await agentRepo!.saveState(state);
  });

  // ── Agent Instructions DB ──

  ipcMain.handle('db:agent:getInstructions', async () => {
    await ensureReady();
    return agentRepo!.getInstructions();
  });

  ipcMain.handle('db:agent:saveInstruction', async (_event, inst: InstructionRow) => {
    await ensureReady();
    await agentRepo!.saveInstruction(inst);
  });

  ipcMain.handle('db:agent:deleteInstruction', async (_event, id: string) => {
    await ensureReady();
    await agentRepo!.deleteInstruction(id);
  });

  // ── Agent Action Log DB ──

  ipcMain.handle('db:agent:logAction', async (_event, log: ActionLogRow) => {
    await ensureReady();
    // Log write failures should not block agent execution
    try {
      await agentRepo!.logAction(log);
    } catch (err) {
      console.error('[agent] Failed to log action:', err);
    }
  });

  ipcMain.handle('db:agent:getActionLog', async (_event, limit: number, offset: number) => {
    await ensureReady();
    return agentRepo!.getActionLog(limit, offset);
  });

  ipcMain.handle('db:agent:pruneLog', async (_event, olderThanMs: number) => {
    await ensureReady();
    return agentRepo!.pruneLog(olderThanMs);
  });

  // ── Chat DB ──

  ipcMain.handle('db:chat:getMessages', async (_event, limit: number, beforeTimestamp?: number) => {
    await ensureReady();
    return chatRepo!.getMessages(limit, beforeTimestamp);
  });

  ipcMain.handle('db:chat:saveMessage', async (_event, msg: ChatMessageRow) => {
    await ensureReady();
    await chatRepo!.saveMessage(msg);
  });

  // ── Crypto ──

  ipcMain.handle('crypto:encrypt', async (_event, plaintext: string) => {
    return encryptApiKey(plaintext);
  });

  ipcMain.handle('crypto:decrypt', async (_event, ciphertext: string) => {
    return decryptApiKey(ciphertext);
  });

  // ── Keyboard Shortcuts DB ──

  ipcMain.handle('db:shortcuts:getAll', async () => {
    await ensureReady();
    const rows = await db!
      .prepare('SELECT action, key_combo as keyCombo, is_default as isDefault FROM keyboard_shortcuts')
      .all() as Array<{ action: string; keyCombo: string; isDefault: number }>;
    return rows.map((r) => ({
      action: r.action,
      keyCombo: r.keyCombo,
      isDefault: r.isDefault === 1,
    }));
  });

  ipcMain.handle('db:shortcuts:save', async (_event, shortcut: ShortcutRow) => {
    await ensureReady();
    await db!
      .prepare(
        'INSERT OR REPLACE INTO keyboard_shortcuts (action, key_combo, is_default) VALUES (?, ?, ?)',
      )
      .run(shortcut.action, shortcut.keyCombo, shortcut.isDefault ? 1 : 0);
  });

  ipcMain.handle('db:shortcuts:reset', async (_event, action: string) => {
    await ensureReady();
    const defaultCombo = DEFAULT_SHORTCUTS[action];
    if (defaultCombo) {
      await db!
        .prepare(
          'INSERT OR REPLACE INTO keyboard_shortcuts (action, key_combo, is_default) VALUES (?, ?, 1)',
        )
        .run(action, defaultCombo);
    } else {
      await db!.prepare('DELETE FROM keyboard_shortcuts WHERE action = ?').run(action);
    }
  });
}

/**
 * Clean up agent resources (close sessions, etc.)
 */
export function disposeAgentService(): void {
  if (currentSessionId) {
    closeSession(currentSessionId);
    currentSessionId = null;
  }
  agentRepo = null;
  chatRepo = null;
  db = null;
}
