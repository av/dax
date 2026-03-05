/**
 * Agent→IPC bridge.
 *
 * Provides typed wrappers for agent-specific IPC calls to the main process.
 * This bridges the renderer-side agent with:
 * - OpenCode SDK (stub) for LLM prompts
 * - AgentRepo for state persistence and action logging
 */
import { ipcClient } from '../core/ipc-client';
import type { AgentStateRow, InstructionRow, ActionLogRow, ChatMessageRow } from '../db/types';
import type { AgentContext, AgentResponse } from '../../main/agent/opencode';
import type { CapabilityIPC } from './capabilities';

/**
 * Agent bridge for IPC communication with the main process.
 * All methods are fire-and-forget safe for non-critical operations.
 */
export const agentBridge = {
  // ── OpenCode SDK (via main process) ──

  /** Create a new LLM session */
  createSession: (): Promise<string> => ipcClient.agentCreateSession(),

  /** Send a prompt to the LLM */
  prompt: (sessionId: string, message: string, context: AgentContext): Promise<AgentResponse> =>
    ipcClient.agentPrompt(sessionId, message, context),

  /** Check LLM health */
  health: (): Promise<boolean> => ipcClient.agentHealth(),

  // ── Agent State DB ──

  /** Load persisted agent state */
  getState: (): Promise<AgentStateRow | null> => ipcClient.dbAgentGetState(),

  /** Persist agent state */
  saveState: (state: AgentStateRow): Promise<void> => ipcClient.dbAgentSaveState(state),

  // ── Agent Instructions DB ──

  /** Get all learned instructions */
  getInstructions: (): Promise<InstructionRow[]> => ipcClient.dbAgentGetInstructions(),

  /** Save an instruction */
  saveInstruction: (inst: InstructionRow): Promise<void> =>
    ipcClient.dbAgentSaveInstruction(inst),

  /** Delete an instruction */
  deleteInstruction: (id: string): Promise<void> =>
    ipcClient.dbAgentDeleteInstruction(id),

  // ── Action Log ──

  /** Log an agent action (fire-and-forget: swallows errors) */
  logAction: async (log: ActionLogRow): Promise<void> => {
    try {
      await ipcClient.dbAgentLogAction(log);
    } catch (err) {
      console.error('[agent-bridge] Failed to log action:', err);
    }
  },

  /** Query action log */
  getActionLog: (limit: number, offset: number): Promise<ActionLogRow[]> =>
    ipcClient.dbAgentGetActionLog(limit, offset),

  /** Prune old log entries */
  pruneLog: (olderThanMs: number): Promise<number> =>
    ipcClient.dbAgentPruneLog(olderThanMs),

  // ── Chat DB ──

  /** Load chat messages */
  getChatMessages: (limit: number, beforeTimestamp?: number): Promise<ChatMessageRow[]> =>
    ipcClient.dbChatGetMessages(limit, beforeTimestamp),

  /** Save a chat message */
  saveChatMessage: (msg: ChatMessageRow): Promise<void> =>
    ipcClient.dbChatSaveMessage(msg),

  // ── Crypto ──

  /** Encrypt a string (for API key storage) */
  encrypt: (plaintext: string): Promise<string> =>
    ipcClient.cryptoEncrypt(plaintext),

  /** Decrypt a string */
  decrypt: (ciphertext: string): Promise<string> =>
    ipcClient.cryptoDecrypt(ciphertext),
};

/**
 * Create a CapabilityIPC adapter that routes through the standard IPC client.
 * This allows capabilities to perform filesystem operations
 * using the same channels as user interactions.
 */
export function createCapabilityIPC(): CapabilityIPC {
  return {
    fsCreate: (filePath, type) => ipcClient.fsCreate(filePath, type),
    fsMove: (sourcePath, targetDir) => ipcClient.fsMove(sourcePath, targetDir),
    fsRename: (oldPath, newPath) => ipcClient.fsRename(oldPath, newPath),
    fsDelete: (filePath) => ipcClient.fsDelete(filePath),
    fsSearch: (query, dir, mode) => ipcClient.fsSearch(query, dir, mode),
  };
}
