/**
 * Tests for chat handler: message parsing, routing to capabilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock solid-js store
vi.mock('solid-js/store', () => ({
  createStore: (initial: Record<string, unknown>) => {
    const state = { ...initial };
    const setState = (...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        Object.assign(state, args[0]);
      } else if (args.length === 2 && typeof args[0] === 'string') {
        const key = args[0] as string;
        const val = args[1];
        if (typeof val === 'function') {
          (state as Record<string, unknown>)[key] = val((state as Record<string, unknown>)[key]);
        } else {
          (state as Record<string, unknown>)[key] = val;
        }
      }
    };
    return [state, setState];
  },
}));

vi.mock('solid-js', () => ({
  createSignal: (initial: unknown) => {
    let val = initial;
    return [() => val, (v: unknown) => { val = v; }];
  },
}));

// Mock agent-bridge
vi.mock('../../../src/renderer/agent/agent-bridge', () => ({
  agentBridge: {
    createSession: vi.fn(() => Promise.resolve('test-session-1')),
    prompt: vi.fn(() =>
      Promise.resolve({
        message: 'I organized 5 files into folders.',
        actions: [{ type: 'organize', reason: 'grouped' }],
        reasoning: 'test',
      }),
    ),
    health: vi.fn(() => Promise.resolve(true)),
    getState: vi.fn(() => Promise.resolve(null)),
    saveState: vi.fn(() => Promise.resolve()),
    getInstructions: vi.fn(() => Promise.resolve([])),
    saveInstruction: vi.fn(() => Promise.resolve()),
    deleteInstruction: vi.fn(() => Promise.resolve()),
    logAction: vi.fn(() => Promise.resolve()),
    getActionLog: vi.fn(() => Promise.resolve([])),
    pruneLog: vi.fn(() => Promise.resolve(0)),
    getChatMessages: vi.fn(() => Promise.resolve([])),
    saveChatMessage: vi.fn(() => Promise.resolve()),
    encrypt: vi.fn((text: string) => Promise.resolve(`enc:${text}`)),
    decrypt: vi.fn((text: string) => Promise.resolve(text.replace('enc:', ''))),
  },
  createCapabilityIPC: vi.fn(() => ({
    fsCreate: vi.fn(),
    fsMove: vi.fn(),
    fsRename: vi.fn(),
    fsDelete: vi.fn(),
    fsSearch: vi.fn(() => Promise.resolve([])),
  })),
}));

import {
  processUserMessage,
  addChatMessage,
  loadChatHistory,
  loadInstructions,
  proposeAutoLearn,
  acceptAutoLearn,
  dismissAutoLearn,
  checkLLMHealth,
} from '../../../src/renderer/agent/chat-handler';
import { agentState, setAgentState } from '../../../src/renderer/state/agent';
import { agentBridge } from '../../../src/renderer/agent/agent-bridge';

describe('Chat Handler', () => {
  beforeEach(() => {
    // Reset state
    setAgentState({
      chatMessages: [],
      instructions: [],
      actionLog: [],
      llmHealthy: true,
      autoLearnProposal: null,
      beliefs: {},
      desires: [],
      currentIntention: null,
      status: 'idle',
      positionX: 0,
      positionZ: 0,
    });
    vi.clearAllMocks();
  });

  describe('processUserMessage', () => {
    it('detects teaching pattern and saves instruction', async () => {
      const result = await processUserMessage(
        'when I say organize, do group files by type',
        'session-1',
      );

      expect(result.type).toBe('teaching_confirmed');
      expect(result.message).toContain('Got it!');
      expect(result.instruction).toBeDefined();
      expect(result.instruction!.triggerPattern).toBe('organize');
      expect(result.instruction!.actionDescription).toBe('group files by type');
      expect(agentBridge.saveInstruction).toHaveBeenCalledTimes(1);
    });

    it('detects "remember:" teaching pattern', async () => {
      const result = await processUserMessage(
        'remember: when I say cleanup, do delete temp files',
        'session-1',
      );

      expect(result.type).toBe('teaching_confirmed');
      expect(result.message).toContain('Got it!');
    });

    it('matches a learned instruction', async () => {
      // Pre-populate instructions in state
      setAgentState('instructions', [
        {
          id: 'inst-1',
          triggerPattern: 'sort files',
          actionDescription: 'sort files alphabetically',
          embedding: null,
          confidence: 1.0,
          usageCount: 0,
          lastUsed: null,
          isUserCreated: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      const result = await processUserMessage('sort files', 'session-1');

      expect(result.type).toBe('match_found');
      expect(result.message).toContain('I remember!');
      expect(result.message).toContain('sort files alphabetically');
    });

    it('routes to agent prompt for regular commands', async () => {
      const result = await processUserMessage('find all TypeScript files', 'session-1');

      expect(result.type).toBe('command_result');
      expect(result.agentResponse).toBeDefined();
      expect(agentBridge.prompt).toHaveBeenCalledTimes(1);
    });

    it('returns error when LLM is unhealthy', async () => {
      setAgentState({ llmHealthy: false });

      const result = await processUserMessage('do something', 'session-1');

      expect(result.type).toBe('error');
      expect(result.message).toContain('unreachable');
    });

    it('creates a session if none provided', async () => {
      const result = await processUserMessage('find files', null);

      expect(result.type).toBe('command_result');
      expect(agentBridge.createSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('addChatMessage', () => {
    it('adds a user message to state and DB', async () => {
      const msg = await addChatMessage('user', 'Hello agent');

      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello agent');
      expect(msg.id).toBeTruthy();
      expect(msg.timestamp).toBeGreaterThan(0);
      expect(agentBridge.saveChatMessage).toHaveBeenCalledTimes(1);
      expect(agentState.chatMessages).toHaveLength(1);
    });

    it('adds an agent message to state', async () => {
      const msg = await addChatMessage('agent', 'Done!', 'sess-1');

      expect(msg.role).toBe('agent');
      expect(msg.sessionId).toBe('sess-1');
    });
  });

  describe('loadChatHistory', () => {
    it('loads messages from DB into state', async () => {
      const mockMsgs = [
        { id: 'm1', role: 'user' as const, content: 'hi', timestamp: 1000, sessionId: null },
        { id: 'm2', role: 'agent' as const, content: 'hello', timestamp: 2000, sessionId: null },
      ];
      vi.mocked(agentBridge.getChatMessages).mockResolvedValueOnce(mockMsgs);

      await loadChatHistory(50);

      expect(agentState.chatMessages).toHaveLength(2);
      expect(agentState.chatMessages[0].content).toBe('hi');
    });
  });

  describe('loadInstructions', () => {
    it('loads instructions from DB into state', async () => {
      const mockInsts = [
        {
          id: 'i1',
          triggerPattern: 'test',
          actionDescription: 'run tests',
          embedding: null,
          confidence: 1.0,
          usageCount: 3,
          lastUsed: Date.now(),
          isUserCreated: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      vi.mocked(agentBridge.getInstructions).mockResolvedValueOnce(mockInsts);

      await loadInstructions();

      expect(agentState.instructions).toHaveLength(1);
      expect(agentState.instructions[0].triggerPattern).toBe('test');
    });
  });

  describe('auto-learn', () => {
    it('proposeAutoLearn sets proposal in state', () => {
      proposeAutoLearn('organize', 'group by type');

      expect(agentState.autoLearnProposal).toEqual({
        trigger: 'organize',
        action: 'group by type',
      });
    });

    it('acceptAutoLearn saves instruction and clears proposal', async () => {
      proposeAutoLearn('organize', 'group by type');

      await acceptAutoLearn();

      expect(agentBridge.saveInstruction).toHaveBeenCalledTimes(1);
      expect(agentState.autoLearnProposal).toBeNull();
      expect(agentState.instructions).toHaveLength(1);
    });

    it('dismissAutoLearn clears proposal', () => {
      proposeAutoLearn('organize', 'group by type');

      dismissAutoLearn();

      expect(agentState.autoLearnProposal).toBeNull();
    });
  });

  describe('checkLLMHealth', () => {
    it('returns true when LLM is healthy', async () => {
      vi.mocked(agentBridge.health).mockResolvedValueOnce(true);

      const healthy = await checkLLMHealth();

      expect(healthy).toBe(true);
      expect(agentState.llmHealthy).toBe(true);
    });

    it('returns false and updates state when LLM is unhealthy', async () => {
      vi.mocked(agentBridge.health).mockResolvedValueOnce(false);

      const healthy = await checkLLMHealth();

      expect(healthy).toBe(false);
      expect(agentState.llmHealthy).toBe(false);
    });

    it('handles errors gracefully', async () => {
      vi.mocked(agentBridge.health).mockRejectedValueOnce(new Error('Network error'));

      const healthy = await checkLLMHealth();

      expect(healthy).toBe(false);
      expect(agentState.llmHealthy).toBe(false);
    });
  });
});
