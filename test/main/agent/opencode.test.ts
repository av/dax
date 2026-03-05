/**
 * Tests for the OpenCode SDK stub.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentSession,
  sendPrompt,
  checkHealth,
  closeSession,
} from '../../../src/main/agent/opencode';
import type { AgentContext } from '../../../src/main/agent/opencode';

describe('OpenCode SDK stub', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = createAgentSession();
  });

  it('should create a session with a valid ID', () => {
    expect(sessionId).toBeTruthy();
    expect(sessionId).toContain('stub-session-');
  });

  it('should create unique session IDs', () => {
    const id2 = createAgentSession();
    expect(id2).not.toBe(sessionId);
  });

  it('should report healthy', async () => {
    const healthy = await checkHealth();
    expect(healthy).toBe(true);
  });

  it('should return an organized response for organize messages', async () => {
    const context: AgentContext = {
      workspacePath: '/tmp/test',
      beliefs: { clutter_level: 0.8 },
      fileCount: 50,
    };
    const response = await sendPrompt(sessionId, 'Please organize my workspace', context);
    expect(response.message).toBeTruthy();
    expect(response.actions).toBeDefined();
    expect(response.actions!.length).toBeGreaterThan(0);
    expect(response.actions![0].type).toBe('organize');
  });

  it('should return a search response for search messages', async () => {
    const context: AgentContext = { workspacePath: '/tmp/test' };
    const response = await sendPrompt(sessionId, 'Search for config files', context);
    expect(response.actions).toBeDefined();
    expect(response.actions![0].type).toBe('search');
  });

  it('should return a create response for create messages', async () => {
    const context: AgentContext = { workspacePath: '/tmp/test' };
    const response = await sendPrompt(sessionId, 'Create a new file', context);
    expect(response.actions).toBeDefined();
    expect(response.actions![0].type).toBe('create');
  });

  it('should return no-action for generic messages', async () => {
    const context: AgentContext = {};
    const response = await sendPrompt(sessionId, 'Hello', context);
    expect(response.message).toBeTruthy();
    expect(response.actions).toBeDefined();
    expect(response.actions![0].type).toBe('none');
  });

  it('should throw on invalid session', async () => {
    await expect(
      sendPrompt('invalid-session', 'hello', {}),
    ).rejects.toThrow('Invalid session ID');
  });

  it('should close a session', () => {
    const result = closeSession(sessionId);
    expect(result).toBe(true);
  });

  it('should return false when closing non-existent session', () => {
    const result = closeSession('non-existent');
    expect(result).toBe(false);
  });

  it('should evaluate beliefs and produce contextual response', async () => {
    const context: AgentContext = {
      beliefs: { file_count: 100, clutter_level: 0.9 },
    };
    const response = await sendPrompt(sessionId, 'Evaluate my workspace beliefs', context);
    expect(response.message).toContain('100');
    expect(response.reasoning).toBeTruthy();
  });

  it('should evaluate beliefs for organized workspace', async () => {
    const context: AgentContext = {
      beliefs: { file_count: 10, clutter_level: 0.1 },
    };
    const response = await sendPrompt(sessionId, 'Evaluate my belief state', context);
    expect(response.message).toContain('well-organized');
    expect(response.actions![0].type).toBe('none');
  });
});
